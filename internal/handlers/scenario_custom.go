package handlers

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/ling-base/apidocs/humax"
	response "github.com/LingByte/ling-base/common/response/gin"
	lbconstants "github.com/LingByte/ling-base/common/constants"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func scenarioToJSON(s models.ScenarioDialogueScenario, includePrompt bool) gin.H {
	item := gin.H{
		"id":           s.ID,
		"slug":         s.Slug,
		"name":         s.Name,
		"description":  s.Description,
		"icon":         s.Icon,
		"difficulty":   s.Difficulty,
		"aiRole":       s.AIRole,
		"enabled":      s.Enabled,
		"sortOrder":    s.SortOrder,
		"userId":       s.UserID,
		"reviewStatus": s.ReviewStatus,
		"isCustom":     s.UserID > 0,
	}
	if s.RejectReason != "" {
		item["rejectReason"] = s.RejectReason
	}
	if includePrompt {
		item["prompt"] = s.Prompt
	}
	return item
}

func (h *Handlers) registerCustomScenarioRoutes(sd *humax.Group) {
	custom := sd.Group("custom/scenarios")
	{
		custom.GET("", h.handleListMyScenarios)
		custom.POST("", h.handleCreateCustomScenario)
		custom.PUT("/:id", h.handleUpdateCustomScenario)
		custom.DELETE("/:id", h.handleDeleteCustomScenario)
	}
}

func (h *Handlers) handleListMyScenarios(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}
	var list []models.ScenarioDialogueScenario
	db.Where("user_id = ?", user.ID).Order("id DESC").Find(&list)
	out := make([]gin.H, 0, len(list))
	for _, s := range list {
		out = append(out, scenarioToJSON(s, true))
	}
	response.SuccessI18n(c, "common.ok", out)
}

type customScenarioReq struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Difficulty  string `json:"difficulty"`
	AIRole      string `json:"aiRole" binding:"required"`
	Prompt      string `json:"prompt" binding:"required"`
}

func (h *Handlers) handleCreateCustomScenario(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}
	var req customScenarioReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailI18n(c, "common.invalid_params", nil)
		return
	}

	difficulty := strings.TrimSpace(req.Difficulty)
	if difficulty == "" {
		difficulty = "medium"
	}
	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = "message-circle"
	}

	scenario := models.ScenarioDialogueScenario{
		Slug:         fmt.Sprintf("custom-%d-%d", user.ID, time.Now().UnixNano()),
		Name:         strings.TrimSpace(req.Name),
		Description:  strings.TrimSpace(req.Description),
		Icon:         icon,
		Difficulty:   difficulty,
		AIRole:       strings.TrimSpace(req.AIRole),
		Prompt:       strings.TrimSpace(req.Prompt),
		Enabled:      false,
		UserID:       user.ID,
		ReviewStatus: models.ScenarioReviewPending,
	}
	scenario.SetCreateInfo(user.Username)
	if err := db.Create(&scenario).Error; err != nil {
		response.FailI18n(c, "scenario.create_failed", err)
		return
	}
	response.SuccessI18n(c, "common.created", scenarioToJSON(scenario, true))
}

func (h *Handlers) handleUpdateCustomScenario(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var scenario models.ScenarioDialogueScenario
	if err := db.Where("id = ? AND user_id = ?", id, user.ID).First(&scenario).Error; err != nil {
		response.FailI18n(c, "scenario.not_found", nil)
		return
	}
	if scenario.ReviewStatus == models.ScenarioReviewApproved {
		response.FailI18n(c, "scenario.approved_readonly", nil)
		return
	}

	var req customScenarioReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailI18n(c, "common.invalid_params", nil)
		return
	}

	scenario.Name = strings.TrimSpace(req.Name)
	scenario.Description = strings.TrimSpace(req.Description)
	if req.Icon != "" {
		scenario.Icon = req.Icon
	}
	if req.Difficulty != "" {
		scenario.Difficulty = req.Difficulty
	}
	scenario.AIRole = strings.TrimSpace(req.AIRole)
	scenario.Prompt = strings.TrimSpace(req.Prompt)
	scenario.ReviewStatus = models.ScenarioReviewPending
	scenario.RejectReason = ""
	scenario.Enabled = false
	scenario.SetUpdateInfo(user.Username)
	if err := db.Save(&scenario).Error; err != nil {
		response.FailI18n(c, "common.operation_failed", err)
		return
	}
	response.SuccessI18n(c, "common.updated", scenarioToJSON(scenario, true))
}

func (h *Handlers) handleDeleteCustomScenario(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var scenario models.ScenarioDialogueScenario
	if err := db.Where("id = ? AND user_id = ?", id, user.ID).First(&scenario).Error; err != nil {
		response.FailI18n(c, "scenario.not_found", nil)
		return
	}
	if err := db.Delete(&scenario).Error; err != nil {
		response.FailI18n(c, "common.operation_failed", err)
		return
	}
	response.SuccessI18n(c, "common.deleted", nil)
}

func (h *Handlers) handleAdminReviewScenario(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var scenario models.ScenarioDialogueScenario
	if err := db.Where("id = ?", id).First(&scenario).Error; err != nil {
		response.FailI18n(c, "scenario.not_found", nil)
		return
	}
	if scenario.UserID == 0 {
		response.FailI18n(c, "scenario.system_no_review", nil)
		return
	}

	var body struct {
		Action       string `json:"action" binding:"required"`
		RejectReason string `json:"rejectReason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.FailI18n(c, "common.invalid_params", nil)
		return
	}

	now := time.Now()
	op := ""
	if user != nil {
		op = user.Username
	}
	switch strings.ToLower(body.Action) {
	case "approve":
		scenario.ReviewStatus = models.ScenarioReviewApproved
		scenario.Enabled = true
		scenario.RejectReason = ""
	case "reject":
		scenario.ReviewStatus = models.ScenarioReviewRejected
		scenario.Enabled = false
		scenario.RejectReason = strings.TrimSpace(body.RejectReason)
	default:
		response.FailI18n(c, "common.invalid_params", nil)
		return
	}
	scenario.ReviewedAt = &now
	scenario.ReviewedBy = op
	scenario.SetUpdateInfo(op)
	if err := db.Save(&scenario).Error; err != nil {
		response.FailI18n(c, "common.operation_failed", err)
		return
	}
	response.SuccessI18n(c, "common.updated", scenarioToJSON(scenario, true))
}

func scenarioAccessible(db *gorm.DB, scenarioID, userID uint) (models.ScenarioDialogueScenario, error) {
	var scenario models.ScenarioDialogueScenario
	if err := db.Where("id = ?", scenarioID).First(&scenario).Error; err != nil {
		return scenario, err
	}
	if !scenario.IsUsable() {
		return scenario, gorm.ErrRecordNotFound
	}
	if scenario.IsSystem() {
		return scenario, nil
	}
	if scenario.UserID != userID {
		return scenario, gorm.ErrRecordNotFound
	}
	return scenario, nil
}
