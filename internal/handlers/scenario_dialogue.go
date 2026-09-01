package handlers

import (
	"fmt"

	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"github.com/LingByte/ling-base/apidocs/humax"
	lbconstants "github.com/LingByte/ling-base/common/constants"

	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/voice"
	"github.com/LingByte/ling-base/common/logger"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *Handlers) registerScenarioDialogueRoutes(r *humax.Group) {
	sd := r.Group("scenario-dialogue")
	sd.Use(auth.Required)
	{
		sd.GET("/scenarios", h.handleListScenarios)
		sd.POST("/sessions", h.handleStartScenarioSession)
		sd.GET("/sessions/:id", h.handleGetScenarioSession)
		sd.POST("/sessions/:id/complete", h.handleCompleteScenarioSession)
		sd.POST("/sessions/:id/activate", h.handleActivateScenarioSession)
		sd.POST("/sessions/:id/turns", h.handleAppendScenarioTurn)
		sd.GET("/stats", h.handleScenarioDialogueStats)
		sd.GET("/voice/ready", h.handleVoiceReady)
	}

	h.registerCustomScenarioRoutes(sd)

	// Admin scenario management routes
	admin := r.Group("admin/scenarios")
	admin.Use(auth.Required, auth.AdminRequired)
	{
		admin.GET("", h.handleAdminListScenarios)
		admin.POST("", h.handleAdminCreateScenario)
		admin.PUT("/:id", h.handleAdminUpdateScenario)
		admin.DELETE("/:id", h.handleAdminDeleteScenario)
		admin.PATCH("/:id/toggle", h.handleAdminToggleScenario)
		admin.POST("/:id/review", h.handleAdminReviewScenario)
	}

	h.registerScenarioAdminSessionRoutes(r)

	// Direct ling-base realtime WebSocket (validated via device-id)
	r.GET("/voice/realtime/", h.handleScenarioVoiceWS)
	// Legacy path kept for older clients during rollout
	r.GET("/voice/CloudStepsGo/v1/", h.handleScenarioVoiceWS)
}

func (h *Handlers) ensureRealtimeFactory() *voice.RealtimeFactory {
	if h.realtimeFactory == nil {
		h.realtimeFactory = voice.NewRealtimeFactory(h.db)
		voice.LogRealtimeConfig(logger.Lg)
	}
	return h.realtimeFactory
}

func (h *Handlers) handleScenarioVoiceWS(c *gin.Context) {
	factory := h.ensureRealtimeFactory()

	deviceID := strings.TrimSpace(c.Query("device-id"))
	if deviceID == "" {
		deviceID = strings.TrimSpace(c.GetHeader("Device-Id"))
	}
	userID, sessionID, ok := voice.ParseDeviceSessionID(deviceID)
	if !ok {
		response.FailI18n(c, "msg.78bbeb34", nil)
		return
	}

	var sess models.ScenarioDialogueSession
	if err := h.db.Where("id = ? AND user_id = ?", sessionID, userID).First(&sess).Error; err != nil {
		response.FailI18n(c, "coaching.session_not_found", nil)
		return
	}
	if sess.Status == models.ScenarioSessionStatusCompleted {
		response.FailI18n(c, "coaching.session_ended", nil)
		return
	}

	ready := voice.CheckReady()
	if !ready.Ready {
		response.FailI18n(c, "scenario.unavailable", gin.H{"hint": ready.Hint})
		return
	}

	callID := fmt.Sprintf("cs-%d-%d-%d", userID, sessionID, time.Now().UnixNano())
	factory.BindCall(callID, sessionID)
	factory.ServeRealtimeWS(c.Writer, c.Request, callID)
}

func (h *Handlers) handleVoiceReady(c *gin.Context) {
	h.ensureRealtimeFactory()
	status := voice.CheckReady()
	if voice.GetLastInitError() != "" && !status.Ready {
		status.Hint = voice.GetLastInitError()
	}
	response.SuccessI18n(c, "common.ok", status)
}

func (h *Handlers) handleListScenarios(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}

	var scenarios []models.ScenarioDialogueScenario
	err := db.Where(
		"(user_id = 0 AND enabled = ? AND review_status = ?) OR (user_id = ? AND enabled = ? AND review_status = ?)",
		true, models.ScenarioReviewApproved, user.ID, true, models.ScenarioReviewApproved,
	).Order("sort_order asc, id asc").Find(&scenarios).Error
	if err != nil {
		response.FailI18n(c, "scenario.list_failed", nil)
		return
	}
	out := make([]gin.H, 0, len(scenarios))
	for _, s := range scenarios {
		out = append(out, scenarioToJSON(s, s.UserID > 0))
	}
	response.SuccessI18n(c, "common.ok", out)
}

type startSessionReq struct {
	ScenarioID uint `json:"scenarioId" binding:"required"`
}

func (h *Handlers) handleStartScenarioSession(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}

	var req startSessionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailI18n(c, "common.invalid_params", nil)
		return
	}

	var scenario models.ScenarioDialogueScenario
	scenario, err := scenarioAccessible(db, req.ScenarioID, user.ID)
	if err != nil {
		response.FailI18n(c, "scenario.not_found", nil)
		return
	}

	sess := models.ScenarioDialogueSession{
		UserID:     user.ID,
		ScenarioID: scenario.ID,
		Status:     models.ScenarioSessionStatusPending,
	}
	if err := db.Create(&sess).Error; err != nil {
		response.FailI18n(c, "coaching.create_session_failed", nil)
		return
	}

	factory := h.ensureRealtimeFactory()
	sessionID := sess.ID
	factory.RegisterSession(&voice.SessionContext{
		SessionID:    sessionID,
		UserID:       user.ID,
		SystemPrompt: models.BuildScenarioSystemPrompt(&scenario),
		OnTurn: func(role, content string, hasCorrection, hasPronunciation bool) {
			_ = appendScenarioTurn(h.db, sessionID, role, content)
		},
	})

	apiPrefix := configs.Global.Server.APIPrefix
	if apiPrefix == "" {
		apiPrefix = "/api"
	}
	deviceID := fmt.Sprintf("cs-%d-%d", user.ID, sess.ID)
	wsPath := fmt.Sprintf("%s/voice/realtime/?device-id=%s", apiPrefix, deviceID)

	voiceReady := voice.CheckReady()
	response.SuccessI18n(c, "common.ok", gin.H{
		"sessionId":  sess.ID,
		"deviceId":   deviceID,
		"wsPath":     wsPath,
		"scenario":   scenario,
		"voiceReady": voiceReady,
	})
}

func (h *Handlers) handleGetScenarioSession(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}

	id, _ := strconv.Atoi(c.Param("id"))
	var sess models.ScenarioDialogueSession
	if err := db.Preload("Scenario").Preload("Turns", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("turn_index asc")
	}).Where("id = ? AND user_id = ?", id, user.ID).First(&sess).Error; err != nil {
		response.FailI18n(c, "coaching.session_not_found", nil)
		return
	}
	sess.Turns = voice.DedupeTurns(sess.Turns)
	response.SuccessI18n(c, "common.ok", sessionWithDetail(sess))
}

func (h *Handlers) handleCompleteScenarioSession(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}

	id, _ := strconv.Atoi(c.Param("id"))
	var sess models.ScenarioDialogueSession
	if err := db.Preload("Scenario").Preload("Turns").
		Where("id = ? AND user_id = ?", id, user.ID).First(&sess).Error; err != nil {
		response.FailI18n(c, "coaching.session_not_found", nil)
		return
	}
	if sess.Status == models.ScenarioSessionStatusCompleted {
		response.SuccessI18n(c, "common.ok", sessionWithDetail(sess))
		return
	}

	// Reload turns written during the call (incl. frontend WS backup)
	var turns []models.ScenarioDialogueTurn
	_ = db.Where("session_id = ?", sess.ID).Order("turn_index asc").Find(&turns).Error
	sess.Turns = turns

	now := time.Now().UTC()
	endedAt := now
	startAt := sess.StartedAt
	if startAt == nil {
		startAt = &sess.CreatedAt
		sess.StartedAt = startAt
	}
	sess.DurationSec = int(now.Sub(*startAt).Seconds())
	if sess.DurationSec < 1 && len(turns) > 0 {
		sess.DurationSec = 1
	}

	metrics := voice.AnalyzeSessionTurns(c.Request.Context(), sess.Scenario, turns, sess.DurationSec)
	replaceSessionTurns(db, sess.ID, metrics.DedupedTurns)
	sess.Turns = metrics.DedupedTurns

	sess.Status = models.ScenarioSessionStatusCompleted
	sess.EndedAt = &endedAt
	sess.FluencyScore = metrics.Fluency
	sess.AccuracyScore = metrics.Accuracy
	sess.PronunciationScore = metrics.Pronunciation
	sess.OverallScore = metrics.Overall
	sess.TurnCount = metrics.TurnCount
	sess.UserWordCount = metrics.UserWordCount
	sess.CorrectionCount = metrics.CorrectionCount
	sess.PronunciationHints = metrics.PronunciationHints
	sess.ReviewSummary = cleanSpecialChars(metrics.ReviewSummary)
	sess.ReviewDetail = voice.MarshalReviewDetail(metrics.Detail)

	if err := db.Save(&sess).Error; err != nil {
		response.FailI18n(c, "coaching.save_review_failed", nil)
		return
	}

	h.ensureRealtimeFactory().UnregisterSession(sess.ID)
	resp := sessionWithDetail(sess)
	response.SuccessI18n(c, "common.ok", resp)
}

func sessionWithDetail(sess models.ScenarioDialogueSession) gin.H {
	detail := voice.ParseReviewDetail(sess.ReviewDetail)
	return gin.H{
		"id":                 sess.ID,
		"createdAt":          sess.CreatedAt,
		"updatedAt":          sess.UpdatedAt,
		"userId":             sess.UserID,
		"scenarioId":         sess.ScenarioID,
		"status":             sess.Status,
		"startedAt":          sess.StartedAt,
		"endedAt":            sess.EndedAt,
		"durationSec":        sess.DurationSec,
		"fluencyScore":       sess.FluencyScore,
		"accuracyScore":      sess.AccuracyScore,
		"pronunciationScore": sess.PronunciationScore,
		"overallScore":       sess.OverallScore,
		"turnCount":          sess.TurnCount,
		"userWordCount":      sess.UserWordCount,
		"correctionCount":    sess.CorrectionCount,
		"pronunciationHints": sess.PronunciationHints,
		"reviewSummary":      sess.ReviewSummary,
		"analysis":           detail,
		"scenario":           sess.Scenario,
		"turns":              sess.Turns,
	}
}

func (h *Handlers) handleScenarioDialogueStats(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}

	var sessions []models.ScenarioDialogueSession
	db.Preload("Scenario").
		Where("user_id = ? AND status = ?", user.ID, models.ScenarioSessionStatusCompleted).
		Order("ended_at desc").Limit(20).Find(&sessions)

	type agg struct {
		TotalSessions    int                              `json:"totalSessions"`
		TotalMinutes     float64                          `json:"totalMinutes"`
		AvgOverallScore  int                              `json:"avgOverallScore"`
		AvgFluencyScore  int                              `json:"avgFluencyScore"`
		AvgAccuracyScore int                              `json:"avgAccuracyScore"`
		AvgPronunciation int                              `json:"avgPronunciationScore"`
		TotalCorrections int                              `json:"totalCorrections"`
		RecentSessions   []models.ScenarioDialogueSession `json:"recentSessions"`
	}
	result := agg{RecentSessions: sessions}
	for _, s := range sessions {
		result.TotalSessions++
		result.TotalMinutes += float64(s.DurationSec) / 60
		result.AvgOverallScore += s.OverallScore
		result.AvgFluencyScore += s.FluencyScore
		result.AvgAccuracyScore += s.AccuracyScore
		result.AvgPronunciation += s.PronunciationScore
		result.TotalCorrections += s.CorrectionCount
	}
	if result.TotalSessions > 0 {
		n := result.TotalSessions
		result.AvgOverallScore /= n
		result.AvgFluencyScore /= n
		result.AvgAccuracyScore /= n
		result.AvgPronunciation /= n
	}
	response.SuccessI18n(c, "common.ok", result)
}

func replaceSessionTurns(db *gorm.DB, sessionID uint, turns []models.ScenarioDialogueTurn) {
	_ = db.Unscoped().Where("session_id = ?", sessionID).Delete(&models.ScenarioDialogueTurn{}).Error
	for _, t := range turns {
		t.SessionID = sessionID
		t.ID = 0
		_ = db.Create(&t).Error
	}
}

var turnAppendLocks sync.Map // sessionID(uint) -> *sync.Mutex

func withSessionTurnLock(sessionID uint, fn func() error) error {
	v, _ := turnAppendLocks.LoadOrStore(sessionID, &sync.Mutex{})
	mu := v.(*sync.Mutex)
	mu.Lock()
	defer mu.Unlock()
	return fn()
}

type appendTurnReq struct {
	Role    string `json:"role" binding:"required"`
	Content string `json:"content" binding:"required"`
}

func (h *Handlers) handleActivateScenarioSession(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var sess models.ScenarioDialogueSession
	if err := db.Where("id = ? AND user_id = ?", id, user.ID).First(&sess).Error; err != nil {
		response.FailI18n(c, "coaching.session_not_found", nil)
		return
	}
	if sess.Status == models.ScenarioSessionStatusCompleted {
		response.FailI18n(c, "coaching.session_ended", nil)
		return
	}
	markScenarioSessionActive(db, uint(id))
	_ = db.Where("id = ?", id).First(&sess)
	response.SuccessI18n(c, "common.ok", sess)
}

func (h *Handlers) handleAppendScenarioTurn(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var sess models.ScenarioDialogueSession
	if err := db.Where("id = ? AND user_id = ?", id, user.ID).First(&sess).Error; err != nil {
		response.FailI18n(c, "coaching.session_not_found", nil)
		return
	}
	if sess.Status == models.ScenarioSessionStatusCompleted {
		response.FailI18n(c, "coaching.session_ended", nil)
		return
	}
	var req appendTurnReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailI18n(c, "common.invalid_params", nil)
		return
	}
	role := strings.TrimSpace(req.Role)
	if role != "user" && role != "assistant" {
		response.FailI18n(c, "msg.e401d7b0", nil)
		return
	}
	markScenarioSessionActive(db, uint(id))
	if err := appendScenarioTurn(db, uint(id), role, req.Content); err != nil {
		response.FailI18n(c, "coaching.record_dialogue_failed", nil)
		return
	}
	response.SuccessI18n(c, "common.ok", nil)
}

func markScenarioSessionActive(db *gorm.DB, sessionID uint) {
	now := time.Now().UTC()
	_ = db.Model(&models.ScenarioDialogueSession{}).
		Where("id = ? AND status = ?", sessionID, models.ScenarioSessionStatusPending).
		Updates(map[string]any{
			"status":     models.ScenarioSessionStatusActive,
			"started_at": now,
		}).Error
	_ = db.Model(&models.ScenarioDialogueSession{}).
		Where("id = ? AND status = ? AND started_at IS NULL", sessionID, models.ScenarioSessionStatusActive).
		Update("started_at", now).Error
}

func appendScenarioTurn(db *gorm.DB, sessionID uint, role, content string) error {
	return withSessionTurnLock(sessionID, func() error {
		content = voice.NormalizeTurnContent(content)
		if content == "" {
			return nil
		}
		var last models.ScenarioDialogueTurn
		if err := db.Where("session_id = ?", sessionID).Order("turn_index desc").First(&last).Error; err == nil {
			if last.Role == role && last.Content == content {
				return nil
			}
		}
		var maxIdx int
		_ = db.Model(&models.ScenarioDialogueTurn{}).Where("session_id = ?", sessionID).
			Select("COALESCE(MAX(turn_index), 0)").Scan(&maxIdx).Error
		hasCorr := role == "assistant" && (strings.Contains(content, "Better:") || strings.Contains(strings.ToLower(content), "you might mean") || strings.Contains(strings.ToLower(content), "instead of"))
		hasPron := role == "assistant" && strings.Contains(strings.ToLower(content), "pronunciation")
		return db.Create(&models.ScenarioDialogueTurn{
			SessionID:        sessionID,
			Role:             role,
			Content:          content,
			HasCorrection:    hasCorr,
			HasPronunciation: hasPron,
			TurnIndex:        maxIdx + 1,
		}).Error
	})
}

// cleanSpecialChars removes problematic UTF-8 characters that cause MySQL charset issues
func cleanSpecialChars(s string) string {
	if s == "" {
		return s
	}

	// 定义需要过滤的特殊字符
	replacements := map[rune]string{
		'…':      "...", // 中文省略号
		'–':      "-",   // 长破折号
		'—':      "-",   // 破折号
		'\u2018': "'",   // 左单引号
		'\u2019': "'",   // 右单引号
		'\u201C': "\"",  // 左双引号
		'\u201D': "\"",  // 右双引号
		'·':      "·",   // 中点
		'×':      "x",   // 乘号
		'÷':      "/",   // 除号
	}

	result := make([]rune, 0, len([]rune(s)))
	for _, r := range s {
		if replacement, ok := replacements[r]; ok {
			result = append(result, []rune(replacement)...)
		} else if r >= 0x20 && r != 0x7F && (r < 0x80 || r >= 0xA0) {
			// 保留可打印的ASCII字符和有效的UTF-8字符
			result = append(result, r)
		} else if r >= 0x4E00 && r <= 0x9FFF {
			// 保留中文字符
			result = append(result, r)
		} else if r >= 0x3040 && r <= 0x309F {
			// 保留日文平假名
			result = append(result, r)
		} else if r >= 0x30A0 && r <= 0x30FF {
			// 保留日文片假名
			result = append(result, r)
		} else if r >= 0xAC00 && r <= 0xD7AF {
			// 保留韩文
			result = append(result, r)
		} else if r == '\n' || r == '\r' || r == '\t' || r == ' ' {
			// 保留空白字符
			result = append(result, r)
		}
		// 其他控制字符和无效字符被过滤掉
	}

	return string(result)
}

// Admin scenario management handlers

func (h *Handlers) handleAdminListScenarios(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	q := db.Model(&models.ScenarioDialogueScenario{})
	if rs := strings.TrimSpace(c.Query("reviewStatus")); rs != "" {
		q = q.Where("review_status = ?", rs)
	}
	if custom := c.Query("custom"); custom == "1" || custom == "true" {
		q = q.Where("user_id > 0")
	} else if custom == "0" || custom == "false" {
		q = q.Where("user_id = 0")
	}
	var scenarios []models.ScenarioDialogueScenario
	if err := q.Order("sort_order asc, id asc").Find(&scenarios).Error; err != nil {
		response.FailI18n(c, "scenario.list_failed", nil)
		return
	}
	out := make([]gin.H, 0, len(scenarios))
	for _, s := range scenarios {
		out = append(out, scenarioToJSON(s, true))
	}
	response.SuccessI18n(c, "common.ok", out)
}

type adminCreateScenarioReq struct {
	Slug        string `json:"slug" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Difficulty  string `json:"difficulty"`
	AIRole      string `json:"aiRole"`
	Prompt      string `json:"prompt"`
	Enabled     bool   `json:"enabled"`
	SortOrder   int    `json:"sortOrder"`
}

func (h *Handlers) handleAdminCreateScenario(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	var req adminCreateScenarioReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailI18n(c, "common.invalid_params", nil)
		return
	}

	scenario := models.ScenarioDialogueScenario{
		Slug:         req.Slug,
		Name:         req.Name,
		Description:  req.Description,
		Icon:         req.Icon,
		Difficulty:   req.Difficulty,
		AIRole:       req.AIRole,
		Prompt:       req.Prompt,
		Enabled:      req.Enabled,
		SortOrder:    req.SortOrder,
		UserID:       0,
		ReviewStatus: models.ScenarioReviewApproved,
	}

	if err := db.Create(&scenario).Error; err != nil {
		response.FailI18n(c, "scenario.create_failed", nil)
		return
	}

	response.SuccessI18n(c, "common.created", scenario)
}

func (h *Handlers) handleAdminUpdateScenario(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	if id == 0 {
		response.FailI18n(c, "coaching.invalid_scenario_id", nil)
		return
	}

	var req adminCreateScenarioReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailI18n(c, "common.invalid_params", nil)
		return
	}

	var scenario models.ScenarioDialogueScenario
	if err := db.Where("id = ?", id).First(&scenario).Error; err != nil {
		response.FailI18n(c, "scenario.not_found", nil)
		return
	}

	scenario.Slug = req.Slug
	scenario.Name = req.Name
	scenario.Description = req.Description
	scenario.Icon = req.Icon
	scenario.Difficulty = req.Difficulty
	scenario.AIRole = req.AIRole
	scenario.Prompt = req.Prompt
	scenario.Enabled = req.Enabled
	scenario.SortOrder = req.SortOrder

	if err := db.Save(&scenario).Error; err != nil {
		response.FailI18n(c, "scenario.update_failed", nil)
		return
	}

	response.SuccessI18n(c, "common.updated", scenario)
}

func (h *Handlers) handleAdminDeleteScenario(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	if id == 0 {
		response.FailI18n(c, "coaching.invalid_scenario_id", nil)
		return
	}

	if err := db.Unscoped().Delete(&models.ScenarioDialogueScenario{}, id).Error; err != nil {
		response.FailI18n(c, "scenario.delete_failed", nil)
		return
	}

	response.SuccessI18n(c, "common.deleted", nil)
}

func (h *Handlers) handleAdminToggleScenario(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	if id == 0 {
		response.FailI18n(c, "coaching.invalid_scenario_id", nil)
		return
	}

	var scenario models.ScenarioDialogueScenario
	if err := db.Where("id = ?", id).First(&scenario).Error; err != nil {
		response.FailI18n(c, "scenario.not_found", nil)
		return
	}

	scenario.Enabled = !scenario.Enabled
	if err := db.Save(&scenario).Error; err != nil {
		response.FailI18n(c, "scenario.update_failed", nil)
		return
	}

	response.SuccessI18n(c, "common.updated", scenario)
}
