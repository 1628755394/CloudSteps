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
	"github.com/LingByte/CloudStepsGo/pkg/response"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	"github.com/LingByte/CloudStepsGo/pkg/tts"
	"github.com/gin-gonic/gin"
)

type ttsRequest struct {
	Text  string `json:"text"`
	Voice string `json:"voice"`
	Lang  string `json:"lang"`
}

func (h *Handlers) registerTTSRoutes(r *gin.RouterGroup) {
	admin := r.Group("/admin")
	admin.Use(models.AuthRequired, staffRequired)
	{
		admin.POST("/tts", h.handleAdminTTS)
	}
}

// handleAdminTTS 使用与 cmd/tts-gen 相同的 DashScope Qwen-TTS 合成语音并写入对象存储。
// POST /api/admin/tts  body: { text, voice?, lang? }  → { url }
func (h *Handlers) handleAdminTTS(c *gin.Context) {
	var req ttsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err.Error())
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		response.Fail(c, "文本不能为空", nil)
		return
	}
	if len([]rune(text)) > 500 {
		response.Fail(c, "文本过长（最多 500 字）", nil)
		return
	}

	opt := tts.DefaultOptions()
	opt.APIKey = tts.ResolveAPIKey("")
	if v := strings.TrimSpace(req.Voice); v != "" {
		opt.Voice = v
	}
	if v := strings.TrimSpace(req.Lang); v != "" {
		opt.Lang = v
	}
	// 管理端词表多为英文单词/中英混读
	if opt.Lang == tts.DefaultLang {
		opt.Lang = "Auto"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	pcm, err := tts.Synthesize(ctx, opt, text)
	if err != nil {
		response.Fail(c, "语音合成失败", err.Error())
		return
	}
	wav, err := tts.EncodeWAV(pcm, opt.SampleRate)
	if err != nil {
		response.Fail(c, "编码音频失败", err.Error())
		return
	}

	sum := sha1.Sum([]byte(text + "|" + opt.Voice + "|" + opt.Lang))
	hash := hex.EncodeToString(sum[:8])
	key := fmt.Sprintf("tts/%s_%d.wav", hash, time.Now().UnixMilli())

	store := stores.Default()
	if err := store.Write(key, bytes.NewReader(wav)); err != nil {
		response.Fail(c, "音频保存失败", err.Error())
		return
	}

	url := store.PublicURL(key)
	response.Success(c, "ok", gin.H{"url": url})
}
