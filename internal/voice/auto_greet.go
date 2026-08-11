package voice

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"sync"
	"time"
	"unsafe"

	"github.com/LingByte/lingllm/realtime"
	"github.com/LingByte/lingllm/realtime/aliyunomni"
)

func init() {
	// Override aliyunomni registration so every Omni session greets first.
	realtime.Register(newAutoGreetAliyun, aliyunomni.ProviderSlug, "qwen_omni", "dashscope_omni")
}

func newAutoGreetAliyun(cfg map[string]any, opts realtime.Options) (realtime.Agent, error) {
	inner, err := aliyunomni.New(cfg, opts)
	if err != nil {
		return nil, err
	}
	return &autoGreetAgent{Agent: inner}, nil
}

// autoGreetAgent triggers response.create shortly after Start so the model
// speaks first (greeting) instead of waiting for user audio.
type autoGreetAgent struct {
	realtime.Agent
	once sync.Once
}

func (a *autoGreetAgent) Start(ctx context.Context) error {
	if err := a.Agent.Start(ctx); err != nil {
		return err
	}
	go a.once.Do(func() {
		// Wait for session.updated handshake on the Omni wire.
		time.Sleep(700 * time.Millisecond)
		if err := sendOmniResponseCreate(a.Agent); err != nil {
			// Best-effort; session still works if user speaks first.
			_ = err
		}
	})
	return nil
}

func sendOmniResponseCreate(agent realtime.Agent) error {
	raw, err := json.Marshal(map[string]any{"type": "response.create"})
	if err != nil {
		return err
	}
	return enqueueAgentJSON(agent, raw)
}

func enqueueAgentJSON(agent realtime.Agent, raw []byte) error {
	v := reflect.ValueOf(agent)
	for v.IsValid() {
		if v.Kind() == reflect.Interface {
			v = v.Elem()
			continue
		}
		if v.Kind() != reflect.Ptr || v.IsNil() {
			return fmt.Errorf("unexpected agent kind %v", v.Kind())
		}
		elem := v.Elem()
		if err := tryEnqueueSendCh(elem, raw); err == nil {
			return nil
		}
		if emb := elem.FieldByName("Agent"); emb.IsValid() {
			v = emb
			continue
		}
		return fmt.Errorf("agent sendCh not found")
	}
	return fmt.Errorf("invalid agent")
}

func tryEnqueueSendCh(structVal reflect.Value, raw []byte) error {
	f := structVal.FieldByName("sendCh")
	if !f.IsValid() || f.Kind() != reflect.Chan || !structVal.CanAddr() {
		return fmt.Errorf("no sendCh")
	}
	ch := *(*chan []byte)(unsafe.Pointer(f.UnsafeAddr()))
	if ch == nil {
		return fmt.Errorf("nil sendCh")
	}
	select {
	case ch <- raw:
		return nil
	case <-time.After(2 * time.Second):
		return fmt.Errorf("sendCh timeout")
	}
}
