package handlers

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	"github.com/LingByte/CloudStepsGo/pkg/synthesizer"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
)

type ttsRequest struct {
	Text  string `json:"text"`
	Voice string `json:"voice"` // 腾讯云 VoiceType 数字字符串，如 "1005"
	Lang  string `json:"lang"`  // 仅作缓存区分，可选
}

// synthesizeTextToURL 合成语音并写入对象存储，返回公开 URL。
func synthesizeTextToURL(ctx context.Context, text, voice, lang string) (string, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return "", fmt.Errorf("文本为空")
	}
	if len([]rune(text)) > 500 {
		return "", fmt.Errorf("文本过长（最多 500 字）")
	}

	cfg, err := synthesizer.NewQCloudConfig(synthesizer.QCloudOverrides{
		VoiceType: strings.TrimSpace(voice),
		Lang:      strings.TrimSpace(lang),
	})
	if err != nil {
		return "", err
	}

	svc, err := synthesizer.NewWithConfig(cfg)
	if err != nil {
		return "", err
	}
	defer func() { _ = svc.Close() }()

	pcm, err := svc.Synthesize(ctx, text)
	if err != nil {
		return "", err
	}
	sampleRate := int(cfg.SampleRate)
	if sampleRate <= 0 {
		sampleRate = synthesizer.DefaultSampleRate
	}
	wav, err := synthesizer.EncodeWAV(pcm, sampleRate)
	if err != nil {
		return "", err
	}

	sum := sha1.Sum([]byte(fmt.Sprintf("%s|%d|%s", text, cfg.VoiceType, cfg.Language)))
	hash := hex.EncodeToString(sum[:8])
	key := fmt.Sprintf("tts/%s_%d.wav", hash, time.Now().UnixMilli())

	store := stores.Default()
	if err := store.Write(key, bytes.NewReader(wav)); err != nil {
		return "", err
	}
	return store.PublicURL(key), nil
}

func (h *Handlers) registerTTSRoutes(r *gin.RouterGroup) {
	admin := r.Group("/admin")
	admin.Use(models.AuthRequired, staffRequired)
	{
		admin.POST("/tts", h.handleAdminTTS)
	}
}

// handleAdminTTS 使用 pkg/synthesizer 合成语音并写入对象存储。
// POST /api/admin/tts  body: { text, voice?, lang? }  → { url }
func (h *Handlers) handleAdminTTS(c *gin.Context) {
	var req ttsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	url, err := synthesizeTextToURL(ctx, req.Text, req.Voice, req.Lang)
	if err != nil {
		response.Fail(c, "语音合成失败", err.Error())
		return
	}

	response.SuccessMsg(c, "ok", gin.H{"url": url})
}
