package handlers

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/CloudStepsGo/pkg/imagegen"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const wordbookCoverMaxRefBytes = 8 << 20 // 8MB

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
		"defaultSize":    "1024x1024",
	})
}

func (h *Handlers) adminWordBookCoverTest(c *gin.Context) {
	cfg := imagegen.FromGlobal()
	if strings.TrimSpace(cfg.APIKey) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "未配置 IMAGE_GEN_API_KEY"})
		return
	}
	ctx := c.Request.Context()
	res, err := imagegen.Generate(ctx, cfg, imagegen.GenerateRequest{
		Prompt: "A simple blue circle on white background, minimal flat illustration, no text.",
		Size:   "1024x1024",
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

func (h *Handlers) adminGenerateWordBookCover(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	bookID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || bookID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效词库 id"})
		return
	}
	var book models.WordBook
	if err := db.Where("id = ? AND is_deleted = ?", bookID, models.SoftDeleteStatusActive).First(&book).Error; err != nil {
		response.Fail(c, "词库不存在", err)
		return
	}

	cfg := imagegen.FromGlobal()
	if strings.TrimSpace(cfg.APIKey) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "未配置图片生成（IMAGE_GEN_API_KEY）"})
		return
	}

	prompt := strings.TrimSpace(c.PostForm("prompt"))
	size := strings.TrimSpace(c.PostForm("size"))
	save := true

	if strings.HasPrefix(c.GetHeader("Content-Type"), "application/json") {
		var body struct {
			Prompt string `json:"prompt"`
			Size   string `json:"size"`
			Save   *bool  `json:"save"`
		}
		if err := c.ShouldBindJSON(&body); err == nil {
			if body.Prompt != "" {
				prompt = strings.TrimSpace(body.Prompt)
			}
			if body.Size != "" {
				size = strings.TrimSpace(body.Size)
			}
			if body.Save != nil {
				save = *body.Save
			}
		}
	}
	if prompt == "" {
		prompt = imagegen.BuildPrompt(imagegen.DefaultPromptTemplate, book.Name, book.Level, book.Description)
	}
	if size == "" {
		size = "1024x1024"
	}
	if v := strings.TrimSpace(c.PostForm("save")); v == "false" || v == "0" {
		save = false
	}

	var refImage []byte
	file, header, fileErr := c.Request.FormFile("referenceImage")
	if fileErr == nil {
		defer file.Close()
		if header.Size > wordbookCoverMaxRefBytes {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参考图不能超过 8MB"})
			return
		}
		refImage, err = io.ReadAll(io.LimitReader(file, wordbookCoverMaxRefBytes+1))
		if err != nil {
			response.Fail(c, "读取参考图失败", err)
			return
		}
		if len(refImage) > wordbookCoverMaxRefBytes {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参考图不能超过 8MB"})
			return
		}
	}

	ctx := c.Request.Context()
	genRes, err := imagegen.Generate(ctx, cfg, imagegen.GenerateRequest{
		Prompt:         prompt,
		Size:           size,
		ReferenceImage: refImage,
	})
	if err != nil {
		response.Fail(c, "生成封面失败", err.Error())
		return
	}

	out := gin.H{
		"prompt":        prompt,
		"revisedPrompt": genRes.RevisedPrompt,
		"bytes":         len(genRes.Data),
		"previewBase64": encodePreviewBase64(genRes.Data, genRes.Ext),
	}

	if !save {
		response.SuccessMsg(c, "ok", out)
		return
	}

	store := stores.Default()
	key := fmt.Sprintf("wordbooks/covers/%d_%d%s", bookID, time.Now().Unix(), genRes.Ext)
	if err := store.Write(key, bytes.NewReader(genRes.Data)); err != nil {
		response.Fail(c, "封面上传存储失败", err.Error())
		return
	}
	coverURL := store.PublicURL(key)

	updates := map[string]any{"cover_url": coverURL}
	if user != nil {
		operator := user.DisplayName
		if operator == "" {
			operator = user.Username
		}
		if operator == "" {
			operator = fmt.Sprintf("%d", user.ID)
		}
		updates["update_by"] = operator
	}
	if err := models.UpdateWordBook(db, uint(bookID), updates); err != nil {
		response.Fail(c, "更新词库封面失败", err)
		return
	}

	out["coverUrl"] = coverURL
	response.SuccessMsg(c, "封面已生成并保存", out)
}

func encodePreviewBase64(data []byte, ext string) string {
	mime := "image/png"
	switch ext {
	case ".jpg", ".jpeg":
		mime = "image/jpeg"
	case ".webp":
		mime = "image/webp"
	}
	return fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(data))
}
