package voice

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/LingByte/ling-base/logger"
	"github.com/LingByte/ling-base/voice/realtime"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

var realtimeUpgrader = websocket.Upgrader{
	CheckOrigin:     func(_ *http.Request) bool { return true },
	ReadBufferSize:  4 * 1024,
	WriteBufferSize: 16 * 1024,
}

// ServeRealtimeWS upgrades the HTTP request and bridges PCM frames to a
// ling-base realtime.Agent. Protocol (JSON text + binary PCM16LE):
//
//	server → client: {"type":"ready","input_sample_rate":16000,"output_sample_rate":24000}
//	server → client: {"type":"stt","text":"...","final":true}
//	server → client: {"type":"assistant","text":"...","final":false|true}
//	server → client: binary PCM16LE @ output_sample_rate
//	server → client: {"type":"error","message":"...","fatal":true}
//	client → server: binary PCM16LE @ input_sample_rate
//	client → server: {"type":"abort"}  // barge-in
func (f *RealtimeFactory) ServeRealtimeWS(w http.ResponseWriter, r *http.Request, callID string) {
	conn, err := realtimeUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	var writeMu sync.Mutex
	writeJSON := func(v any) {
		writeMu.Lock()
		defer writeMu.Unlock()
		_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		_ = conn.WriteJSON(v)
	}
	writeBinary := func(b []byte) {
		if len(b) == 0 {
			return
		}
		writeMu.Lock()
		defer writeMu.Unlock()
		_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		_ = conn.WriteMessage(websocket.BinaryMessage, b)
	}

	agent, inSR, outSR, err := f.NewAgent(ctx, callID, func(ev realtime.Event) {
		switch ev.Type {
		case realtime.EventUserSpeechStarted:
			writeJSON(map[string]any{"type": "barge_in"})
		case realtime.EventUserTranscript:
			if ev.Text == "" {
				return
			}
			writeJSON(map[string]any{
				"type":  "stt",
				"text":  ev.Text,
				"final": ev.Final,
			})
		case realtime.EventAssistantText:
			if ev.Text == "" && !ev.Final {
				return
			}
			writeJSON(map[string]any{
				"type":  "assistant",
				"text":  ev.Text,
				"final": ev.Final,
			})
		case realtime.EventAssistantAudio:
			writeBinary(ev.AudioPC)
		case realtime.EventError:
			msg := "realtime error"
			if ev.Err != nil {
				msg = ev.Err.Error()
			}
			writeJSON(map[string]any{
				"type":    "error",
				"message": msg,
				"fatal":   ev.Fatal,
			})
			if ev.Fatal {
				cancel()
			}
		case realtime.EventSessionClose:
			cancel()
		}
	})
	if err != nil {
		logger.Lg.Error("realtime agent create failed", zap.Error(err), zap.String("callID", callID))
		writeJSON(map[string]any{
			"type":    "error",
			"message": err.Error(),
			"fatal":   true,
		})
		return
	}
	defer func() {
		_ = agent.Close()
		f.UnregisterCall(callID)
	}()

	writeJSON(map[string]any{
		"type":               "ready",
		"input_sample_rate":  inSR,
		"output_sample_rate": outSR,
	})

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Minute))
		mt, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		switch mt {
		case websocket.BinaryMessage:
			if len(data) > 0 {
				_ = agent.PushAudio(data)
			}
		case websocket.TextMessage:
			var msg struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			switch msg.Type {
			case "abort":
				_ = agent.Cancel()
			case "stop", "close":
				return
			}
		}
	}
}
