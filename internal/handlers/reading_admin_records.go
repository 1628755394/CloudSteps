package handlers

import (
	"strconv"
	"strings"

	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/ling-base/apidocs/humax"
	response "github.com/LingByte/ling-base/common/response/gin"
	lbconstants "github.com/LingByte/ling-base/common/constants"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *Handlers) registerReadingAdminRecordRoutes(rg *humax.Group) {
	admin := rg.Group("admin")
	adminRecords := admin.Group("")
	adminRecords.Use(auth.Required, auth.AdminRequired)
	{
		adminRecords.GET("/records", h.handleAdminListReadingRecords)
		adminRecords.GET("/records/:id", h.handleAdminGetReadingRecord)
	}
	adminCustom := rg.Group("admin/custom")
	adminCustom.Use(auth.Required, auth.AdminRequired)
	{
		adminCustom.GET("/records", h.handleAdminListUserReadingRecords)
		adminCustom.GET("/records/:id", h.handleAdminGetUserReadingRecord)
	}
}

func adminReadingRecordQuery(db *gorm.DB, c *gin.Context) *gorm.DB {
	q := db
	if uid := strings.TrimSpace(c.Query("userId")); uid != "" {
		if id, err := strconv.ParseUint(uid, 10, 64); err == nil && id > 0 {
			q = q.Where("user_id = ?", id)
		}
	}
	if pid := strings.TrimSpace(c.Query("passageId")); pid != "" {
		if id, err := strconv.ParseUint(pid, 10, 64); err == nil && id > 0 {
			q = q.Where("passage_id = ?", id)
		}
	}
	if latest := c.Query("isLatest"); latest == "1" || latest == "true" {
		q = q.Where("is_latest = ?", true)
	}
	return q
}

func loadUserNames(db *gorm.DB, userIDs []uint) map[uint]models.User {
	out := map[uint]models.User{}
	if len(userIDs) == 0 {
		return out
	}
	var users []models.User
	db.Select("id, username, email").Where("id IN ?", userIDs).Find(&users)
	for _, u := range users {
		out[u.ID] = u
	}
	return out
}

// GET /reading/admin/records
func (h *Handlers) handleAdminListReadingRecords(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	q := adminReadingRecordQuery(db.Model(&models.ReadingRecord{}), c)
	var total int64
	q.Count(&total)

	var records []models.ReadingRecord
	q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&records)

	userIDs := make([]uint, 0, len(records))
	passageIDs := make([]uint, 0, len(records))
	for _, r := range records {
		userIDs = append(userIDs, r.UserID)
		passageIDs = append(passageIDs, r.PassageID)
	}
	userMap := loadUserNames(db, userIDs)
	titleMap := map[uint]string{}
	levelMap := map[uint]string{}
	if len(passageIDs) > 0 {
		var passages []models.ReadingPassage
		db.Select("id, title, level").Where("id IN ?", passageIDs).Find(&passages)
		for _, p := range passages {
			titleMap[p.ID] = p.Title
			levelMap[p.ID] = p.Level
		}
	}

	list := make([]gin.H, 0, len(records))
	for _, r := range records {
		u := userMap[r.UserID]
		list = append(list, gin.H{
			"id":            r.ID,
			"userId":        r.UserID,
			"username":      u.Username,
			"email":         u.Email,
			"passageId":     r.PassageID,
			"title":         titleMap[r.PassageID],
			"level":         levelMap[r.PassageID],
			"questionCount": r.QuestionCount,
			"correctCount":  r.CorrectCount,
			"score":         r.Score,
			"durationSec":   r.DurationSec,
			"isLatest":      r.IsLatest,
			"completedAt":   r.CompletedAt,
			"source":        "system",
		})
	}

	response.SuccessI18n(c, "common.success", gin.H{
		"list": list, "total": total, "page": page, "pageSize": pageSize,
	})
}

// GET /reading/admin/records/:id
func (h *Handlers) handleAdminGetReadingRecord(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var record models.ReadingRecord
	if err := db.Where("id = ?", id).First(&record).Error; err != nil {
		response.FailI18n(c, "common.record_not_found", nil)
		return
	}
	var passage models.ReadingPassage
	db.Select("id, title, level, content").First(&passage, record.PassageID)
	var user models.User
	db.Select("id, username, email").First(&user, record.UserID)

	response.SuccessI18n(c, "common.success", gin.H{
		"id":            record.ID,
		"userId":        record.UserID,
		"username":      user.Username,
		"email":         user.Email,
		"passageId":     record.PassageID,
		"title":         passage.Title,
		"level":         passage.Level,
		"content":       passage.Content,
		"questionCount": record.QuestionCount,
		"correctCount":  record.CorrectCount,
		"score":         record.Score,
		"durationSec":   record.DurationSec,
		"isLatest":      record.IsLatest,
		"completedAt":   record.CompletedAt,
		"answers":       record.Answers,
		"source":        "system",
	})
}

// GET /reading/admin/custom/records
func (h *Handlers) handleAdminListUserReadingRecords(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	q := adminReadingRecordQuery(db.Model(&models.UserReadingRecord{}), c)
	var total int64
	q.Count(&total)

	var records []models.UserReadingRecord
	q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&records)

	userIDs := make([]uint, 0, len(records))
	passageIDs := make([]uint, 0, len(records))
	for _, r := range records {
		userIDs = append(userIDs, r.UserID)
		passageIDs = append(passageIDs, r.PassageID)
	}
	userMap := loadUserNames(db, userIDs)
	titleMap := map[uint]string{}
	levelMap := map[uint]string{}
	if len(passageIDs) > 0 {
		var passages []models.UserReadingPassage
		db.Select("id, title, level").Where("id IN ?", passageIDs).Find(&passages)
		for _, p := range passages {
			titleMap[p.ID] = p.Title
			levelMap[p.ID] = p.Level
		}
	}

	list := make([]gin.H, 0, len(records))
	for _, r := range records {
		u := userMap[r.UserID]
		list = append(list, gin.H{
			"id":            r.ID,
			"userId":        r.UserID,
			"username":      u.Username,
			"email":         u.Email,
			"passageId":     r.PassageID,
			"title":         titleMap[r.PassageID],
			"level":         levelMap[r.PassageID],
			"questionCount": r.QuestionCount,
			"correctCount":  r.CorrectCount,
			"score":         r.Score,
			"durationSec":   r.DurationSec,
			"isLatest":      r.IsLatest,
			"completedAt":   r.CompletedAt,
			"source":        "custom",
		})
	}

	response.SuccessI18n(c, "common.success", gin.H{
		"list": list, "total": total, "page": page, "pageSize": pageSize,
	})
}

// GET /reading/admin/custom/records/:id
func (h *Handlers) handleAdminGetUserReadingRecord(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var record models.UserReadingRecord
	if err := db.Where("id = ?", id).First(&record).Error; err != nil {
		response.FailI18n(c, "common.record_not_found", nil)
		return
	}
	var passage models.UserReadingPassage
	db.Select("id, title, level, content").First(&passage, record.PassageID)
	var user models.User
	db.Select("id, username, email").First(&user, record.UserID)

	response.SuccessI18n(c, "common.success", gin.H{
		"id":            record.ID,
		"userId":        record.UserID,
		"username":      user.Username,
		"email":         user.Email,
		"passageId":     record.PassageID,
		"title":         passage.Title,
		"level":         passage.Level,
		"content":       passage.Content,
		"questionCount": record.QuestionCount,
		"correctCount":  record.CorrectCount,
		"score":         record.Score,
		"durationSec":   record.DurationSec,
		"isLatest":      record.IsLatest,
		"completedAt":   record.CompletedAt,
		"answers":       record.Answers,
		"source":        "custom",
	})
}
