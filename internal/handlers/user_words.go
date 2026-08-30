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
		response.FailI18n(c, "common.login_required", nil)
		return
	}
	word, ok := h.loadActiveWord(c)
	if !ok {
		return
	}
	overlay, err := models.GetUserWord(h.db, user.ID, word.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		response.FailI18n(c, "common.query_failed", err)
		return
	}
	response.SuccessI18n(c, "common.ok", toUserWordViewDTO(word, overlay))
}

func (h *Handlers) handleUpsertMyUserWord(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "common.login_required", nil)
		return
	}
	word, ok := h.loadActiveWord(c)
	if !ok {
		return
	}
	var req models.UserWordFields
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailI18n(c, "common.invalid_params", err)
		return
	}
	row, err := models.UpsertUserWord(h.db, user.ID, word, req, strconv.FormatUint(uint64(user.ID), 10))
	if err != nil {
		response.FailI18n(c, userWordErrMsg(err), err)
		return
	}
	response.SuccessI18n(c, "common.saved", toUserWordViewDTO(word, row))
}

func (h *Handlers) handleDeleteMyUserWord(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "common.login_required", nil)
		return
	}
	word, ok := h.loadActiveWord(c)
	if !ok {
		return
	}
	if err := models.DeleteUserWord(h.db, user.ID, word.ID, strconv.FormatUint(uint64(user.ID), 10)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.SuccessI18n(c, "common.restored", toUserWordViewDTO(word, nil))
			return
		}
		response.FailI18n(c, "common.operation_failed", err)
		return
	}
	response.SuccessI18n(c, "msg.cdaa5383", toUserWordViewDTO(word, nil))
}

func (h *Handlers) loadActiveWord(c *gin.Context) (*models.Word, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		response.FailI18n(c, "wordbook.word_id_invalid", nil)
		return nil, false
	}
	word, err := models.GetWordByID(h.db, uint(id))
	if err != nil {
		response.FailI18n(c, "wordbook.word_not_found", err)
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
		return "user_word.empty"
	}
	if errors.Is(err, models.ErrUserWordTooLong) {
		return "user_word.too_long"
	}
	if errors.Is(err, models.ErrUserWordMissing) {
		return "user_word.not_found"
	}
	return "common.operation_failed"
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
