package handlers

import (
	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"github.com/LingByte/ling-base/apidocs/humax"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type adminUserWordDTO struct {
	ID           uint                  `json:"id"`
	UserID       uint                  `json:"userId"`
	UserName     string                `json:"userName,omitempty"`
	UserEmail    string                `json:"userEmail,omitempty"`
	WordID       uint                  `json:"wordId"`
	WordBookID   uint                  `json:"wordBookId"`
	WordBookName string                `json:"wordBookName,omitempty"`
	Status       string                `json:"status"`
	Notes        string                `json:"notes,omitempty"`
	Overlay      models.UserWordFields `json:"overlay"`
	Canonical    models.UserWordFields `json:"canonical"`
	CreatedAt    time.Time             `json:"createdAt"`
	UpdatedAt    time.Time             `json:"updatedAt"`
}

func (h *Handlers) registerUserWordAdminRoutes(r *humax.Group) {
	admin := r.Group("admin")
	admin.Use(auth.Required, auth.AdminRequired)
	g := admin.Group("user-words")
	{
		g.GET("", h.handleAdminListUserWords)
		g.GET("/:id", h.handleAdminGetUserWord)
		g.POST("/:id/adopt", h.handleAdminAdoptUserWord)
		g.POST("/:id/dismiss", h.handleAdminDismissUserWord)
	}
}

func (h *Handlers) handleAdminListUserWords(c *gin.Context) {
	page, pageSize := parsePageParams(c)
	status := strings.TrimSpace(c.Query("status"))
	userID := strings.TrimSpace(c.Query("userId"))
	keyword := strings.TrimSpace(c.Query("keyword"))

	q := h.db.Model(&models.UserWord{})
	if status == models.UserWordStatusPending || status == models.UserWordStatusAdopted || status == models.UserWordStatusDismissed {
		q = q.Where("status = ?", status)
	}
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		q = q.Where("word LIKE ? OR translation LIKE ? OR notes LIKE ?", like, like, like)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		response.FailI18n(c, "common.query_failed", err)
		return
	}
	var rows []models.UserWord
	if err := q.Order("updated_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		response.FailI18n(c, "common.query_failed", err)
		return
	}
	list := h.toAdminUserWordDTOs(rows)
	response.SuccessI18n(c, "common.ok", gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *Handlers) handleAdminGetUserWord(c *gin.Context) {
	row, ok := h.findAdminUserWord(c)
	if !ok {
		return
	}
	list := h.toAdminUserWordDTOs([]models.UserWord{*row})
	if len(list) == 0 {
		response.FailI18n(c, "common.record_not_found", nil)
		return
	}
	response.SuccessI18n(c, "common.ok", list[0])
}

func (h *Handlers) handleAdminAdoptUserWord(c *gin.Context) {
	admin := auth.CurrentUser(c)
	if admin == nil {
		response.FailI18n(c, "common.login_required", nil)
		return
	}
	row, ok := h.findAdminUserWord(c)
	if !ok {
		return
	}
	if err := models.AdoptUserWord(h.db, row, strconv.FormatUint(uint64(admin.ID), 10)); err != nil {
		response.FailI18n(c, userWordErrMsg(err), err)
		return
	}
	row.Status = models.UserWordStatusAdopted
	list := h.toAdminUserWordDTOs([]models.UserWord{*row})
	response.SuccessI18n(c, "msg.aff643b5", list[0])
}

func (h *Handlers) handleAdminDismissUserWord(c *gin.Context) {
	admin := auth.CurrentUser(c)
	if admin == nil {
		response.FailI18n(c, "common.login_required", nil)
		return
	}
	row, ok := h.findAdminUserWord(c)
	if !ok {
		return
	}
	if err := h.db.Model(row).Updates(map[string]any{
		"status":    models.UserWordStatusDismissed,
		"update_by": strconv.FormatUint(uint64(admin.ID), 10),
	}).Error; err != nil {
		response.FailI18n(c, "common.operation_failed", err)
		return
	}
	row.Status = models.UserWordStatusDismissed
	list := h.toAdminUserWordDTOs([]models.UserWord{*row})
	response.SuccessI18n(c, "common.dismissed", list[0])
}

func (h *Handlers) findAdminUserWord(c *gin.Context) (*models.UserWord, bool) {
	id, ok := parsePositiveID(c.Param("id"))
	if !ok {
		response.FailI18n(c, "common.invalid_record_id", nil)
		return nil, false
	}
	var row models.UserWord
	if err := h.db.Where("id = ?", id).First(&row).Error; err != nil {
		response.FailI18n(c, "common.record_not_found", err)
		return nil, false
	}
	return &row, true
}

func (h *Handlers) toAdminUserWordDTOs(rows []models.UserWord) []adminUserWordDTO {
	out := make([]adminUserWordDTO, 0, len(rows))
	if len(rows) == 0 {
		return out
	}
	userIDs := make([]uint, 0, len(rows))
	wordIDs := make([]uint, 0, len(rows))
	bookIDs := make([]uint, 0, len(rows))
	seenUser := map[uint]struct{}{}
	seenWord := map[uint]struct{}{}
	seenBook := map[uint]struct{}{}
	for _, row := range rows {
		if _, ok := seenUser[row.UserID]; !ok && row.UserID > 0 {
			seenUser[row.UserID] = struct{}{}
			userIDs = append(userIDs, row.UserID)
		}
		if _, ok := seenWord[row.WordID]; !ok && row.WordID > 0 {
			seenWord[row.WordID] = struct{}{}
			wordIDs = append(wordIDs, row.WordID)
		}
		if _, ok := seenBook[row.WordBookID]; !ok && row.WordBookID > 0 {
			seenBook[row.WordBookID] = struct{}{}
			bookIDs = append(bookIDs, row.WordBookID)
		}
	}
	labels := loadUserWordUserLabels(h.db, userIDs)
	canonicals := loadCanonicalWordFields(h.db, wordIDs)
	bookNames := loadWordBookNames(h.db, bookIDs)
	for _, row := range rows {
		label := labels[row.UserID]
		out = append(out, adminUserWordDTO{
			ID:           row.ID,
			UserID:       row.UserID,
			UserName:     label.Name,
			UserEmail:    label.Email,
			WordID:       row.WordID,
			WordBookID:   row.WordBookID,
			WordBookName: bookNames[row.WordBookID],
			Status:       row.Status,
			Notes:        row.Notes,
			Overlay:      overlayToFields(&row),
			Canonical:    canonicals[row.WordID],
			CreatedAt:    row.CreatedAt,
			UpdatedAt:    row.UpdatedAt,
		})
	}
	return out
}

func loadUserWordUserLabels(db *gorm.DB, ids []uint) map[uint]inboxUserLabel {
	out := map[uint]inboxUserLabel{}
	if len(ids) == 0 {
		return out
	}
	var users []models.User
	if err := db.Where("id IN ?", ids).Find(&users).Error; err != nil {
		return out
	}
	for _, u := range users {
		name := u.DisplayName
		if name == "" {
			name = u.Username
		}
		out[u.ID] = inboxUserLabel{Name: name, Email: u.Username}
	}
	return out
}

func loadCanonicalWordFields(db *gorm.DB, ids []uint) map[uint]models.UserWordFields {
	out := map[uint]models.UserWordFields{}
	if len(ids) == 0 {
		return out
	}
	var words []models.Word
	if err := db.Where("id IN ?", ids).Find(&words).Error; err != nil {
		return out
	}
	for i := range words {
		out[words[i].ID] = wordToFields(&words[i])
	}
	return out
}

func loadWordBookNames(db *gorm.DB, ids []uint) map[uint]string {
	out := map[uint]string{}
	if len(ids) == 0 {
		return out
	}
	var books []models.WordBook
	if err := db.Select("id", "name").Where("id IN ?", ids).Find(&books).Error; err != nil {
		return out
	}
	for _, b := range books {
		out[b.ID] = b.Name
	}
	return out
}
