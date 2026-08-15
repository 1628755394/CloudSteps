// Package tts 使用腾讯云语音合成（流式 PCM）生成音频。
// 与 cmd/tts-gen 共用，供 CLI 与管理端 API 调用。
//
// 协议对齐腾讯云 TextToStreamAudio（https://tts.cloud.tencent.com/stream）。
package tts

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	// DefaultVoiceType 腾讯云音色 ID（1005 为常用女声，可按产品需要调整）
	DefaultVoiceType = int64(1005)
	// DefaultSampleRate 腾讯云流式 TTS 常用 16k
	DefaultSampleRate = 16000
	DefaultCodec      = "pcm"
	DefaultModelType  = int64(1)

	qcloudTTSHost   = "tts.cloud.tencent.com"
	qcloudTTSPath   = "/stream"
	qcloudTTSAction = "TextToStreamAudio"
)

// Options 腾讯云 TTS 合成参数。
type Options struct {
	AppID      int64
	SecretID   string
	SecretKey  string
	VoiceType  int64
	// Voice 兼容旧管理端字段：可传数字音色 ID（如 "1005"）；非数字则忽略。
	Voice string
	// Lang 仅用于缓存键/日志区分，腾讯云流式接口靠 VoiceType 区分语言。
	Lang       string
	SampleRate int
	Codec      string
	Speed      int64
	ModelType  int64
	Verbose    bool
	Logf       func(format string, args ...any)
}

// DefaultOptions 返回可用的默认配置（不含密钥）。
func DefaultOptions() Options {
	return Options{
		VoiceType:  DefaultVoiceType,
		SampleRate: DefaultSampleRate,
		Codec:      DefaultCodec,
		ModelType:  DefaultModelType,
		Speed:      0,
	}
}

// ResolveCredentials 从显式参数与环境变量解析腾讯云凭证。
// 环境变量：QCLOUD_APP_ID / QCLOUD_SECRET_ID / QCLOUD_SECRET（或 QCLOUD_SECRET_KEY）
func ResolveCredentials(appID, secretID, secretKey string) (int64, string, string) {
	appID = strings.TrimSpace(appID)
	if appID == "" || appID == "0" {
		appID = os.Getenv("QCLOUD_APP_ID")
	}
	if strings.TrimSpace(secretID) == "" {
		secretID = os.Getenv("QCLOUD_SECRET_ID")
	}
	if strings.TrimSpace(secretKey) == "" {
		secretKey = os.Getenv("QCLOUD_SECRET")
		if strings.TrimSpace(secretKey) == "" {
			secretKey = os.Getenv("QCLOUD_SECRET_KEY")
		}
	}
	id, _ := strconv.ParseInt(strings.TrimSpace(appID), 10, 64)
	return id, strings.TrimSpace(secretID), strings.TrimSpace(secretKey)
}

// ResolveAPIKey 兼容旧调用名：返回 SecretKey（若已配置完整凭证则非空）。
func ResolveAPIKey(explicit string) string {
	_, _, sk := ResolveCredentials("", "", explicit)
	return sk
}

// Normalize 填充默认值并校验关键参数。
func (o *Options) Normalize() error {
	if o.AppID == 0 || o.SecretID == "" || o.SecretKey == "" {
		appIDStr := ""
		if o.AppID != 0 {
			appIDStr = strconv.FormatInt(o.AppID, 10)
		}
		id, sid, sk := ResolveCredentials(appIDStr, o.SecretID, o.SecretKey)
		if o.AppID == 0 {
			o.AppID = id
		}
		if o.SecretID == "" {
			o.SecretID = sid
		}
		if o.SecretKey == "" {
			o.SecretKey = sk
		}
	}
	if o.AppID == 0 || o.SecretID == "" || o.SecretKey == "" {
		return errors.New("缺少腾讯云 TTS 凭证：请设置 QCLOUD_APP_ID / QCLOUD_SECRET_ID / QCLOUD_SECRET")
	}

	if o.VoiceType == 0 {
		if v := strings.TrimSpace(o.Voice); v != "" {
			if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
				o.VoiceType = n
			}
		}
	}
	if o.VoiceType == 0 {
		if v := strings.TrimSpace(os.Getenv("QCLOUD_VOICE_TYPE")); v != "" {
			if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
				o.VoiceType = n
			}
		}
	}
	if o.VoiceType == 0 {
		o.VoiceType = DefaultVoiceType
	}

	if o.SampleRate == 0 {
		o.SampleRate = DefaultSampleRate
	}
	switch o.SampleRate {
	case 8000, 16000:
		// ok
	default:
		return fmt.Errorf("sampleRate 必须是 8000 或 16000，当前 %d", o.SampleRate)
	}
	if strings.TrimSpace(o.Codec) == "" {
		o.Codec = DefaultCodec
	}
	if o.ModelType == 0 {
		o.ModelType = DefaultModelType
	}
	return nil
}

type qcloudTTSRequest struct {
	Action     string `json:"Action"`
	AppID      int64  `json:"AppId"`
	SecretID   string `json:"SecretId"`
	Timestamp  int64  `json:"Timestamp"`
	Expired    int64  `json:"Expired"`
	Text       string `json:"Text"`
	SessionID  string `json:"SessionId"`
	ModelType  int64  `json:"ModelType"`
	VoiceType  int64  `json:"VoiceType"`
	SampleRate int64  `json:"SampleRate"`
	Codec      string `json:"Codec"`
	Speed      int64  `json:"Speed,omitempty"`
}

// Synthesize 调用腾讯云流式 TTS，返回 PCM16LE mono。
func Synthesize(ctx context.Context, opt Options, text string) ([]byte, error) {
	if err := opt.Normalize(); err != nil {
		return nil, err
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, errors.New("文本为空")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	if opt.Verbose && opt.Logf != nil {
		opt.Logf("qcloud tts: voiceType=%d sampleRate=%d codec=%s text=%q",
			opt.VoiceType, opt.SampleRate, opt.Codec, text)
	}

	now := time.Now().Unix()
	req := qcloudTTSRequest{
		Action:     qcloudTTSAction,
		AppID:      opt.AppID,
		SecretID:   opt.SecretID,
		Timestamp:  now,
		Expired:    now + 24*60*60,
		Text:       text,
		SessionID:  uuid.NewString(),
		ModelType:  opt.ModelType,
		VoiceType:  opt.VoiceType,
		SampleRate: int64(opt.SampleRate),
		Codec:      opt.Codec,
	}
	if opt.Speed != 0 {
		req.Speed = opt.Speed
	}

	signURL := qcloudTTSHost + qcloudTTSPath
	signature := signQCloudTTS(signURL, &req, opt.SecretKey)
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://"+signURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json; charset=UTF-8")
	httpReq.Header.Set("Authorization", signature)

	client := &http.Client{
		Transport: &http.Transport{
			DialContext: (&net.Dialer{Timeout: 3 * time.Second}).DialContext,
			ResponseHeaderTimeout: 10 * time.Second,
		},
		Timeout: 60 * time.Second,
	}
	rsp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("qcloud tts request: %w", err)
	}
	defer rsp.Body.Close()

	ct := rsp.Header.Get("Content-Type")
	if rsp.StatusCode != http.StatusOK || !strings.Contains(ct, "application/octet-stream") {
		errBody, _ := io.ReadAll(io.LimitReader(rsp.Body, 4096))
		if len(errBody) == 0 {
			return nil, fmt.Errorf("qcloud tts failed: status=%d content-type=%s", rsp.StatusCode, ct)
		}
		return nil, fmt.Errorf("qcloud tts failed: status=%d %s", rsp.StatusCode, strings.TrimSpace(string(errBody)))
	}

	pcm, err := io.ReadAll(rsp.Body)
	if err != nil {
		return nil, fmt.Errorf("qcloud tts read: %w", err)
	}
	if len(pcm) == 0 {
		return nil, errors.New("qcloud tts: 未收到音频数据")
	}
	return pcm, nil
}

func signQCloudTTS(pathWithHost string, request *qcloudTTSRequest, secretKey string) string {
	queryMap := map[string]string{
		"Action":     request.Action,
		"AppId":      strconv.FormatInt(request.AppID, 10),
		"SecretId":   request.SecretID,
		"Timestamp":  strconv.FormatInt(request.Timestamp, 10),
		"Expired":    strconv.FormatInt(request.Expired, 10),
		"Text":       request.Text,
		"SessionId":  request.SessionID,
		"ModelType":  strconv.FormatInt(request.ModelType, 10),
		"VoiceType":  strconv.FormatInt(request.VoiceType, 10),
		"SampleRate": strconv.FormatInt(request.SampleRate, 10),
		"Codec":      request.Codec,
	}
	if request.Speed != 0 {
		queryMap["Speed"] = strconv.FormatInt(request.Speed, 10)
	}

	keys := make([]string, 0, len(queryMap))
	for k := range queryMap {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var queryStr bytes.Buffer
	for i, k := range keys {
		if i > 0 {
			queryStr.WriteByte('&')
		}
		queryStr.WriteString(k)
		queryStr.WriteByte('=')
		queryStr.WriteString(queryMap[k])
	}

	signPayload := "POST" + pathWithHost + "?" + queryStr.String()
	mac := hmac.New(sha1.New, []byte(secretKey))
	_, _ = mac.Write([]byte(signPayload))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}
