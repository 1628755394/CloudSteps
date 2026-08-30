package handlers

import (
	"errors"
	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"strconv"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/models"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type userWordViewDTO struct {
	WordID     uint                   `json:"wordId"`
	WordBookID uint                   `json:"wordBookId"`
	Canonical  models.UserWordFields  `json:"canonical"`
	Overlay    *models.UserWordFields `json:"overlay"`
	Effective  models.UserWordFields  `json:"effective"`
	Status     string                 `json:"status,omitempty"`
	HasOverlay bool                   `json:"hasOverlay"`
}

func (h *Handlers) handleGetMyUserWord(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未登录", nil)
		return
	}
	word, ok := h.loadActiveWord(c)
	if !ok {
		return
	}
	overlay, err := models.GetUserWord(h.db, user.ID, word.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		response.Fail(c, "查询失败", err)
		return
	}
	response.SuccessMsg(c, "ok", toUserWordViewDTO(word, overlay))
}

func (h *Handlers) handleUpsertMyUserWord(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未登录", nil)
		return
	}
	word, ok := h.loadActiveWord(c)
	if !ok {
		return
	}
	var req models.UserWordFields
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数无效", err)
		return
	}
	row, err := models.UpsertUserWord(h.db, user.ID, word, req, strconv.FormatUint(uint64(user.ID), 10))
	if err != nil {
		response.Fail(c, userWordErrMsg(err), err)
		return
	}
	response.SuccessMsg(c, "已保存", toUserWordViewDTO(word, row))
}

func (h *Handlers) handleDeleteMyUserWord(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未登录", nil)
		return
	}
	word, ok := h.loadActiveWord(c)
	if !ok {
		return
	}
	if err := models.DeleteUserWord(h.db, user.ID, word.ID, strconv.FormatUint(uint64(user.ID), 10)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.SuccessMsg(c, "已恢复", toUserWordViewDTO(word, nil))
			return
		}
		response.Fail(c, "删除失败", err)
		return
	}
	response.SuccessMsg(c, "已恢复词库原文", toUserWordViewDTO(word, nil))
}

func (h *Handlers) loadActiveWord(c *gin.Context) (*models.Word, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		response.Fail(c, "单词 ID 无效", nil)
		return nil, false
	}
	word, err := models.GetWordByID(h.db, uint(id))
	if err != nil {
		response.Fail(c, "单词不存在", err)
		return nil, false
	}
	return word, true
}

func toUserWordViewDTO(word *models.Word, overlay *models.UserWord) userWordViewDTO {
	canonical := wordToFields(word)
	dto := userWordViewDTO{
		WordID:     word.ID,
		WordBookID: word.WordBookID,
		Canonical:  canonical,
		Effective:  canonical,
	}
	if overlay == nil {
		return dto
	}
	fields := overlayToFields(overlay)
	dto.Overlay = &fields
	dto.HasOverlay = true
	dto.Status = overlay.Status
	effective := *word
	overlay.ApplyToWord(&effective)
	dto.Effective = wordToFields(&effective)
	return dto
}

func wordToFields(w *models.Word) models.UserWordFields {
	if w == nil {
		return models.UserWordFields{}
	}
	return models.UserWordFields{
		Word:             w.Word,
		Phonetic:         w.Phonetic,
		PhoneticUS:       w.PhoneticUS,
		PhoneticUK:       w.PhoneticUK,
		Translation:      w.Translation,
		TranslationShort: w.TranslationShort,
		PartOfSpeech:     w.PartOfSpeech,
		Definition:       w.Definition,
		ExampleSentence:  w.ExampleSentence,
	}
}

func overlayToFields(u *models.UserWord) models.UserWordFields {
	if u == nil {
		return models.UserWordFields{}
	}
	return models.UserWordFields{
		Word:             u.Word,
		Phonetic:         u.Phonetic,
		PhoneticUS:       u.PhoneticUS,
		PhoneticUK:       u.PhoneticUK,
		Translation:      u.Translation,
		TranslationShort: u.TranslationShort,
		PartOfSpeech:     u.PartOfSpeech,
		Definition:       u.Definition,
		ExampleSentence:  u.ExampleSentence,
		Notes:            u.Notes,
	}
}

func userWordErrMsg(err error) string {
	if errors.Is(err, models.ErrUserWordEmpty) {
		return "请至少填写一项要修正的内容"
	}
	if errors.Is(err, models.ErrUserWordTooLong) {
		return "内容过长"
	}
	if errors.Is(err, models.ErrUserWordMissing) {
		return "单词不存在"
	}
	return "保存失败"
}

func overlayCurrentUserWord(c *gin.Context, db *gorm.DB, w *models.Word) {
	if u := auth.CurrentUser(c); u != nil {
		models.OverlayWord(db, u.ID, w)
	}
}

func overlayCurrentUserWordLites(c *gin.Context, db *gorm.DB, words []models.WordLite) {
	if u := auth.CurrentUser(c); u != nil {
		models.OverlayWordLites(db, u.ID, words)
	}
}

func parsePositiveID(raw string) (uint, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, false
	}
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || n == 0 {
		return 0, false
	}
	return uint(n), true
}
