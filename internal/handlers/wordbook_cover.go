package handlers

import (
	"context"
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
	response.SuccessI18n(c, "common.ok", gin.H{
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
		response.FailI18n(c, "image.not_configured", nil)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Minute)
	defer cancel()
	res, err := imagegen.Generate(ctx, cfg, imagegen.GenerateRequest{
		Prompt: "A simple blue circle on white background, minimal flat illustration, no text.",
		Size:   imagegen.DefaultCoverSize,
	})
	if err != nil {
		response.FailI18n(c, "image.test_failed", err.Error())
		return
	}
	response.SuccessI18n(c, "image.available", gin.H{
		"bytes":  len(res.Data),
		"format": strings.TrimPrefix(res.Ext, "."),
		"model":  cfg.Model,
	})
}
