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

func (h *Handlers) registerScenarioAdminSessionRoutes(r *humax.Group) {
	admin := r.Group("admin/scenario-dialogue")
	admin.Use(auth.Required, auth.AdminRequired)
	{
		admin.GET("/sessions", h.handleAdminListScenarioSessions)
		admin.GET("/sessions/:id", h.handleAdminGetScenarioSession)
	}
}

func adminScenarioSessionQuery(db *gorm.DB, c *gin.Context) *gorm.DB {
	q := db
	if uid := strings.TrimSpace(c.Query("userId")); uid != "" {
		if id, err := strconv.ParseUint(uid, 10, 64); err == nil && id > 0 {
			q = q.Where("user_id = ?", id)
		}
	}
	if sid := strings.TrimSpace(c.Query("scenarioId")); sid != "" {
		if id, err := strconv.ParseUint(sid, 10, 64); err == nil && id > 0 {
			q = q.Where("scenario_id = ?", id)
		}
	}
	if st := strings.TrimSpace(c.Query("status")); st != "" {
		q = q.Where("status = ?", st)
	}
	return q
}

// GET /admin/scenario-dialogue/sessions
func (h *Handlers) handleAdminListScenarioSessions(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	q := adminScenarioSessionQuery(db.Model(&models.ScenarioDialogueSession{}), c)
	var total int64
	q.Count(&total)

	var sessions []models.ScenarioDialogueSession
	q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&sessions)

	userIDs := make([]uint, 0, len(sessions))
	scenarioIDs := make([]uint, 0, len(sessions))
	for _, s := range sessions {
		userIDs = append(userIDs, s.UserID)
		scenarioIDs = append(scenarioIDs, s.ScenarioID)
	}
	userMap := loadUserNames(db, userIDs)
	scenarioMap := map[uint]models.ScenarioDialogueScenario{}
	if len(scenarioIDs) > 0 {
		var scenarios []models.ScenarioDialogueScenario
		db.Select("id, name, difficulty").Where("id IN ?", scenarioIDs).Find(&scenarios)
		for _, sc := range scenarios {
			scenarioMap[sc.ID] = sc
		}
	}

	list := make([]gin.H, 0, len(sessions))
	for _, s := range sessions {
		u := userMap[s.UserID]
		sc := scenarioMap[s.ScenarioID]
		list = append(list, gin.H{
			"id":                 s.ID,
			"userId":             s.UserID,
			"username":           u.Username,
			"email":              u.Email,
			"scenarioId":         s.ScenarioID,
			"scenarioName":       sc.Name,
			"scenarioDifficulty": sc.Difficulty,
			"status":             s.Status,
			"startedAt":          s.StartedAt,
			"endedAt":            s.EndedAt,
			"durationSec":        s.DurationSec,
			"overallScore":       s.OverallScore,
			"fluencyScore":       s.FluencyScore,
			"accuracyScore":      s.AccuracyScore,
			"pronunciationScore": s.PronunciationScore,
			"turnCount":          s.TurnCount,
			"correctionCount":    s.CorrectionCount,
			"reviewSummary":      s.ReviewSummary,
		})
	}

	response.SuccessI18n(c, "common.success", gin.H{
		"list": list, "total": total, "page": page, "pageSize": pageSize,
	})
}

// GET /admin/scenario-dialogue/sessions/:id
func (h *Handlers) handleAdminGetScenarioSession(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var sess models.ScenarioDialogueSession
	if err := db.Preload("Scenario").Preload("Turns", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("turn_index ASC, id ASC")
	}).Where("id = ?", id).First(&sess).Error; err != nil {
		response.FailI18n(c, "coaching.session_not_found", nil)
		return
	}

	var user models.User
	db.Select("id, username, email").First(&user, sess.UserID)

	resp := sessionWithDetail(sess)
	resp["username"] = user.Username
	resp["email"] = user.Email
	response.SuccessI18n(c, "common.success", resp)
}
