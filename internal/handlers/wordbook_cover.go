package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/imagegen"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
)

func (h *Handlers) adminWordBookCoverDefaults(c *gin.Context) {
	cfg := imagegen.FromGlobal()
	name := strings.TrimSpace(c.Query("name"))
	level := strings.TrimSpace(c.Query("level"))
	description := strings.TrimSpace(c.Query("description"))
	prompt := imagegen.BuildPrompt(imagegen.DefaultPromptTemplate, name, level, description)
	response.SuccessMsg(c, "ok", gin.H{
		"promptTemplate": imagegen.DefaultPromptTemplate,
		"prompt":         prompt,
		"model":          cfg.Model,
		"baseUrl":        cfg.BaseURL,
		"configured":     strings.TrimSpace(cfg.APIKey) != "",
		"defaultSize":    imagegen.DefaultCoverSize,
		"sizeOptions":    imagegen.CoverSizeOptions,
	})
}

func (h *Handlers) adminWordBookCoverTest(c *gin.Context) {
	cfg := imagegen.FromGlobal()
	if strings.TrimSpace(cfg.APIKey) == "" {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("未配置 IMAGE_GEN_API_KEY"))
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Minute)
	defer cancel()
	res, err := imagegen.Generate(ctx, cfg, imagegen.GenerateRequest{
		Prompt: "A simple blue circle on white background, minimal flat illustration, no text.",
		Size:   imagegen.DefaultCoverSize,
	})
	if err != nil {
		response.Fail(c, "图片生成测试失败", err.Error())
		return
	}
	response.SuccessMsg(c, "图片生成接口可用", gin.H{
		"bytes":  len(res.Data),
		"format": strings.TrimPrefix(res.Ext, "."),
		"model":  cfg.Model,
	})
}
