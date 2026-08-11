// Package tts 使用阿里云 DashScope Qwen-TTS realtime（WebSocket）合成 PCM16LE。
// 与 cmd/tts-gen 共用同一协议，供 CLI 与管理端 API 调用。
//
// 协议参考：https://www.alibabacloud.com/help/en/model-studio/qwen-tts-realtime
package tts

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/utils"
	"github.com/gorilla/websocket"
)

const (
	DefaultBaseURL    = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
	DefaultModel      = "qwen3-tts-flash-realtime"
	DefaultVoice      = "Cherry"
	DefaultLang       = "Auto"
	DefaultMode       = "server_commit"
	DefaultSampleRate = 24000
)

// Options 合成参数。
type Options struct {
	APIKey      string
	BaseURL     string
	Model       string
	Voice       string
	Lang        string
	Mode        string
	SampleRate  int
	Instruct    string
	OptInstruct bool
	DialTimeout time.Duration
	Verbose     bool
	Logf        func(format string, args ...any)
}

// DefaultOptions 返回可用的默认配置（不含 API Key）。
func DefaultOptions() Options {
	return Options{
		BaseURL:     DefaultBaseURL,
		Model:       DefaultModel,
		Voice:       DefaultVoice,
		Lang:        DefaultLang,
		Mode:        DefaultMode,
		SampleRate:  DefaultSampleRate,
		DialTimeout: 10 * time.Second,
	}
}

// ResolveAPIKey 按优先级解析 API Key。
func ResolveAPIKey(explicit string) string {
	if v := strings.TrimSpace(explicit); v != "" {
		return v
	}
	for _, key := range []string{"DASHSCOPE_API_KEY", "REALTIME_API_KEY", "LLM_API_KEY"} {
		if v := strings.TrimSpace(utils.GetEnv(key)); v != "" {
			return v
		}
	}
	return ""
}

// Normalize 填充默认值并校验关键参数。
func (o *Options) Normalize() error {
	if o.APIKey == "" {
		o.APIKey = ResolveAPIKey("")
	}
	if o.APIKey == "" {
		return errors.New("缺少 API Key：请设置 DASHSCOPE_API_KEY 或 REALTIME_API_KEY")
	}
	if strings.TrimSpace(o.BaseURL) == "" {
		o.BaseURL = DefaultBaseURL
	}
	if strings.TrimSpace(o.Model) == "" {
		o.Model = DefaultModel
	}
	if strings.TrimSpace(o.Voice) == "" {
		o.Voice = DefaultVoice
	}
	if strings.TrimSpace(o.Lang) == "" {
		o.Lang = DefaultLang
	}
	if o.Mode == "" {
		o.Mode = DefaultMode
	}
	if o.Mode != "server_commit" && o.Mode != "commit" {
		return fmt.Errorf("mode 必须是 server_commit 或 commit，当前 %q", o.Mode)
	}
	if o.SampleRate == 0 {
		o.SampleRate = DefaultSampleRate
	}
	if o.SampleRate != 16000 && o.SampleRate != 22050 && o.SampleRate != 24000 {
		return fmt.Errorf("rate 必须是 16000 / 22050 / 24000，当前 %d", o.SampleRate)
	}
	if o.DialTimeout <= 0 {
		o.DialTimeout = 10 * time.Second
	}
	return nil
}

type event struct {
	Type  string `json:"type"`
	Delta string `json:"delta,omitempty"`
	Error *struct {
		Type    string `json:"type"`
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Synthesize 走 WebSocket 协议合成 PCM16LE（mono）。
func Synthesize(ctx context.Context, opt Options, text string) ([]byte, error) {
	if err := opt.Normalize(); err != nil {
		return nil, err
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, errors.New("文本为空")
	}

	wsURL, err := buildWSURL(opt.BaseURL, opt.Model)
	if err != nil {
		return nil, err
	}

	dialer := *websocket.DefaultDialer
	dialer.HandshakeTimeout = opt.DialTimeout
	headers := http.Header{}
	headers.Set("Authorization", "Bearer "+opt.APIKey)

	if opt.Verbose && opt.Logf != nil {
		opt.Logf("dial %s model=%s voice=%s lang=%s mode=%s rate=%d",
			wsURL, opt.Model, opt.Voice, opt.Lang, opt.Mode, opt.SampleRate)
	}
	conn, resp, err := dialer.DialContext(ctx, wsURL, headers)
	if err != nil {
		status := -1
		if resp != nil {
			status = resp.StatusCode
			_ = resp.Body.Close()
		}
		return nil, fmt.Errorf("dial %s (status=%d): %w", wsURL, status, err)
	}
	defer conn.Close()

	done := make(chan struct{})
	defer close(done)
	go func() {
		select {
		case <-ctx.Done():
			_ = conn.Close()
		case <-done:
		}
	}()

	if err := sendSessionUpdate(conn, opt); err != nil {
		return nil, fmt.Errorf("session.update: %w", err)
	}
	if err := sendEvent(conn, map[string]any{
		"type": "input_text_buffer.append",
		"text": text,
	}); err != nil {
		return nil, fmt.Errorf("append text: %w", err)
	}
	if opt.Mode == "commit" {
		if err := sendEvent(conn, map[string]any{"type": "input_text_buffer.commit"}); err != nil {
			return nil, fmt.Errorf("commit: %w", err)
		}
	}
	if err := sendEvent(conn, map[string]any{"type": "session.finish"}); err != nil {
		return nil, fmt.Errorf("session.finish: %w", err)
	}

	var pcm []byte
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				return pcm, nil
			}
			return nil, fmt.Errorf("read: %w", err)
		}
		var evt event
		if err := json.Unmarshal(raw, &evt); err != nil {
			continue
		}
		if opt.Verbose && opt.Logf != nil {
			opt.Logf("event: %s", evt.Type)
		}
		switch evt.Type {
		case "response.audio.delta":
			if evt.Delta == "" {
				continue
			}
			chunk, err := base64.StdEncoding.DecodeString(evt.Delta)
			if err != nil {
				continue
			}
			pcm = append(pcm, chunk...)
		case "response.done", "session.finished":
			if evt.Type == "session.finished" {
				return pcm, nil
			}
		case "error":
			msg := "unknown error"
			if evt.Error != nil {
				if evt.Error.Message != "" {
					msg = evt.Error.Message
				} else if evt.Error.Code != "" {
					msg = evt.Error.Code
				}
			}
			return nil, fmt.Errorf("server error: %s", msg)
		}
	}
}

func buildWSURL(base, model string) (string, error) {
	if base == "" {
		base = DefaultBaseURL
	}
	u, err := url.Parse(base)
	if err != nil {
		return "", fmt.Errorf("parse base_url: %w", err)
	}
	if u.Scheme != "ws" && u.Scheme != "wss" {
		return "", fmt.Errorf("base_url 必须 ws:// 或 wss://，当前 %q", u.Scheme)
	}
	q := u.Query()
	if q.Get("model") == "" && model != "" {
		q.Set("model", model)
		u.RawQuery = q.Encode()
	}
	return u.String(), nil
}

func sendSessionUpdate(conn *websocket.Conn, opt Options) error {
	session := map[string]any{
		"mode":            opt.Mode,
		"voice":           opt.Voice,
		"language_type":   opt.Lang,
		"response_format": "pcm",
		"sample_rate":     opt.SampleRate,
	}
	if opt.Instruct != "" {
		session["instructions"] = opt.Instruct
		session["optimize_instructions"] = opt.OptInstruct
	}
	return sendEvent(conn, map[string]any{
		"type":    "session.update",
		"session": session,
	})
}

func sendEvent(conn *websocket.Conn, event map[string]any) error {
	event["event_id"] = fmt.Sprintf("event_%d", time.Now().UnixMilli())
	buf, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, buf)
}

// EncodeWAV 将 PCM16LE mono 编码为完整 WAV 字节。
func EncodeWAV(pcm []byte, sampleRate int) ([]byte, error) {
	if len(pcm) == 0 {
		return nil, errors.New("PCM 数据为空")
	}
	if sampleRate <= 0 {
		sampleRate = DefaultSampleRate
	}
	dataLen := uint32(len(pcm))
	byteRate := uint32(sampleRate) * 2
	totalLen := 36 + dataLen

	buf := make([]byte, 0, 44+len(pcm))
	w := &binaryWriter{b: buf}
	w.bytes([]byte("RIFF"))
	w.u32(totalLen)
	w.bytes([]byte("WAVE"))
	w.bytes([]byte("fmt "))
	w.u32(16)
	w.u16(1) // PCM
	w.u16(1) // mono
	w.u32(uint32(sampleRate))
	w.u32(byteRate)
	w.u16(2)
	w.u16(16)
	w.bytes([]byte("data"))
	w.u32(dataLen)
	w.bytes(pcm)
	return w.b, nil
}

type binaryWriter struct{ b []byte }

func (w *binaryWriter) bytes(p []byte) { w.b = append(w.b, p...) }
func (w *binaryWriter) u16(v uint16) {
	var tmp [2]byte
	binary.LittleEndian.PutUint16(tmp[:], v)
	w.b = append(w.b, tmp[:]...)
}
func (w *binaryWriter) u32(v uint32) {
	var tmp [4]byte
	binary.LittleEndian.PutUint32(tmp[:], v)
	w.b = append(w.b, tmp[:]...)
}

// WriteAudioFile 根据后缀写出 .pcm / .wav / .mp3（mp3 需系统 ffmpeg）。
func WriteAudioFile(path string, pcm []byte, sampleRate int) error {
	if len(pcm) == 0 {
		return errors.New("PCM 数据为空")
	}
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".pcm":
		return os.WriteFile(path, pcm, 0o644)
	case ".wav":
		wav, err := EncodeWAV(pcm, sampleRate)
		if err != nil {
			return err
		}
		return os.WriteFile(path, wav, 0o644)
	case ".mp3":
		return writeMP3ViaFFmpeg(path, pcm, sampleRate)
	default:
		return fmt.Errorf("不支持的输出格式 %q（支持 .pcm/.wav/.mp3）", ext)
	}
}

func writeMP3ViaFFmpeg(path string, pcm []byte, sampleRate int) error {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return fmt.Errorf("未找到 ffmpeg，请先安装（brew install ffmpeg）：%w", err)
	}
	tmpWAV, err := os.CreateTemp("", "tts-*.wav")
	if err != nil {
		return err
	}
	tmpWAVPath := tmpWAV.Name()
	_ = tmpWAV.Close()
	defer os.Remove(tmpWAVPath)

	wav, err := EncodeWAV(pcm, sampleRate)
	if err != nil {
		return err
	}
	if err := os.WriteFile(tmpWAVPath, wav, 0o644); err != nil {
		return fmt.Errorf("写临时 wav: %w", err)
	}
	cmd := exec.Command("ffmpeg", "-y", "-i", tmpWAVPath, "-codec:a", "libmp3lame", "-b:a", "64k", path)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg 转码: %w", err)
	}
	return nil
}

// SanitizeFilename 将文本转为安全文件名片段。
func SanitizeFilename(s string, maxLen int) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "tts"
	}
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9',
			r >= 0x4e00 && r <= 0x9fff:
			b.WriteRune(r)
		case r == ' ' || r == '-':
			b.WriteRune('_')
		default:
			b.WriteRune('_')
		}
	}
	out := strings.Trim(b.String(), "_")
	if out == "" {
		out = "tts"
	}
	if maxLen > 0 && len([]rune(out)) > maxLen {
		out = string([]rune(out)[:maxLen])
	}
	return out
}
