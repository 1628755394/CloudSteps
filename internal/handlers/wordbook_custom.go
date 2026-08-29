package handlers

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/LingByte/CloudStepsGo/internal/customwordbook"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *Handlers) registerCustomWordBookRoutes(wb *gin.RouterGroup) {
	// 必须在 /:id 之前注册
	wb.POST("/custom/enrich", h.handleEnrichCustomWordBook)
	wb.POST("/custom", h.handleCreateCustomWordBook)
}

// StartCustomWordEnrichCache 启动自定义词书补全用的词条内存缓存
func StartCustomWordEnrichCache(db *gorm.DB) {
	customwordbook.StartEnrichCacheLoader(db)
}

type customCreateBody struct {
	Name  string                      `json:"name" binding:"required"`
	Words []customwordbook.ParsedWord `json:"words" binding:"required"`
}

type customEnrichBody struct {
	Words []customwordbook.ParsedWord `json:"words" binding:"required"`
}

// handleEnrichCustomWordBook 根据内存词条缓存回填缺失的释义/音标（前端本地解析后调用）
func (h *Handlers) handleEnrichCustomWordBook(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "请先登录", nil)
		return
	}
	var body customEnrichBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Fail(c, "参数错误", err)
		return
	}
	items := customwordbook.MergeDedup(body.Words)
	if len(items) == 0 {
		response.Fail(c, "词表为空", nil)
		return
	}
	items = enrichParsedWords(items)
	response.SuccessMsg(c, "success", gin.H{
		"list":  items,
		"total": len(items),
	})
}

func (h *Handlers) handleCreateCustomWordBook(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "请先登录", nil)
		return
	}
	var body customCreateBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Fail(c, "参数错误", err)
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		response.Fail(c, "请填写词书名称", nil)
		return
	}
	if utf8.RuneCountInString(name) > 64 {
		response.Fail(c, "词书名称过长", nil)
		return
	}
	words := customwordbook.MergeDedup(body.Words)
	if len(words) == 0 {
		response.Fail(c, "词表为空，请先导入单词", nil)
		return
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)
	now := time.Now()
	book := models.WordBook{
		Name:           name,
		Description:    "",
		Category:       "custom",
		Language:       "en",
		TargetLanguage: "zh",
		IsActive:       true,
		OwnerUserID:    user.ID,
		Author:         fmt.Sprintf("user:%d", user.ID),
		WordCount:      0,
	}
	book.CreateBy = fmt.Sprintf("%d", user.ID)

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := models.CreateWordBook(tx, &book); err != nil {
			return err
		}
		rows := make([]models.Word, 0, len(words))
		for i, w := range words {
			rows = append(rows, models.Word{
				WordBookID:       book.ID,
				Word:             w.Word,
				Phonetic:         w.Phonetic,
				Translation:      w.Translation,
				TranslationShort: w.TranslationShort,
				SortOrder:        i + 1,
				Difficulty:       1,
				Frequency:        1,
				Importance:       1,
			})
		}
		if err := models.BatchCreateWords(tx, rows); err != nil {
			return err
		}
		uwb := models.UserWordBook{
			UserID:     user.ID,
			WordBookID: book.ID,
			Status:     "active",
			StartedAt:  &now,
		}
		uwb.CreateBy = fmt.Sprintf("%d", user.ID)
		return tx.Create(&uwb).Error
	})
	if err != nil {
		response.Fail(c, "创建词书失败", err)
		return
	}

	_ = models.SyncWordBookCount(db, book.ID)
	fresh, _ := models.GetWordBookByID(db, book.ID)
	if fresh != nil {
		book = *fresh
	}

	response.SuccessMsg(c, "创建成功", book)
}

func enrichParsedWords(items []customwordbook.ParsedWord) []customwordbook.ParsedWord {
	// 只查内存缓存，未命中不回源 DB
	return customwordbook.EnrichFromCache(items)
}
