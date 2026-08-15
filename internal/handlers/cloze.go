package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type clozeOption struct {
	Key  string `json:"key"`
	Text string `json:"text"`
}

type clozeAnswerItem struct {
	BlankID     uint   `json:"blankId"`
	BlankNo     int    `json:"blankNo"`
	Answer      string `json:"answer"`
	Correct     bool   `json:"correct"`
	RightAnswer string `json:"rightAnswer,omitempty"`
	Explanation string `json:"explanation,omitempty"`
}

var clozeBlankRe = regexp.MustCompile(`\{\{(\d+)\}\}`)

func (h *Handlers) registerClozeRoutes(r *gin.RouterGroup) {
	rg := r.Group("cloze")
	{
		user := rg.Group("")
		user.Use(models.AuthRequired)
		user.GET("/passages", h.handleClozeListPassages)
		user.GET("/passages/:id", h.handleClozeGetPassage)
		user.POST("/passages/:id/submit", h.handleClozeSubmit)
		user.GET("/records", h.handleClozeListRecords)
		user.GET("/records/:id", h.handleClozeGetRecord)

		admin := rg.Group("admin")
		admin.Use(models.AuthRequired, staffRequired)
		admin.GET("/passages", h.handleAdminClozeListPassages)
		admin.GET("/passages/:id", h.handleAdminClozeGetPassage)
		admin.POST("/passages", h.handleAdminClozeCreatePassage)
		admin.PUT("/passages/:id", h.handleAdminClozeUpdatePassage)
		admin.DELETE("/passages/:id", h.handleAdminClozeDeletePassage)
	}
}

func parseClozeOptions(raw string) []clozeOption {
	var opts []clozeOption
	_ = json.Unmarshal([]byte(raw), &opts)
	return opts
}

func countClozeMarkers(content string) int {
	return len(clozeBlankRe.FindAllStringSubmatch(content, -1))
}

// GET /cloze/passages
func (h *Handlers) handleClozeListPassages(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)

	level := strings.TrimSpace(c.Query("level"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	q := db.Model(&models.ClozePassage{}).
		Where("is_deleted = ? AND status = ?", models.SoftDeleteStatusActive, models.ClozeStatusPublished)
	if level != "" {
		q = q.Where("level = ?", level)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}

	var list []models.ClozePassage
	if err := q.Order("sort_order ASC, id ASC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&list).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}

	ids := make([]uint, 0, len(list))
	for _, p := range list {
		ids = append(ids, p.ID)
	}

	latestMap := map[uint]models.ClozeRecord{}
	if user != nil && len(ids) > 0 {
		var records []models.ClozeRecord
		db.Where("user_id = ? AND passage_id IN ? AND is_latest = ? AND is_deleted = ?",
			user.ID, ids, true, models.SoftDeleteStatusActive).
			Find(&records)
		for _, rec := range records {
			latestMap[rec.PassageID] = rec
		}
	}

	items := make([]gin.H, 0, len(list))
	for _, p := range list {
		item := gin.H{
			"id":               p.ID,
			"title":            p.Title,
			"level":            p.Level,
			"summary":          p.Summary,
			"blankCount":       p.BlankCount,
			"estimatedMinutes": p.EstimatedMinutes,
			"sortOrder":        p.SortOrder,
		}
		if rec, ok := latestMap[p.ID]; ok {
			item["lastScore"] = rec.Score
			item["lastCorrectCount"] = rec.CorrectCount
			item["lastBlankCount"] = rec.BlankCount
			item["lastCompletedAt"] = rec.CompletedAt
		}
		items = append(items, item)
	}

	response.SuccessMsg(c, "success", gin.H{
		"list":     items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GET /cloze/passages/:id
func (h *Handlers) handleClozeGetPassage(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效文章ID"})
		return
	}

	var passage models.ClozePassage
	if err := db.Where("id = ? AND is_deleted = ? AND status = ?",
		id, models.SoftDeleteStatusActive, models.ClozeStatusPublished).
		First(&passage).Error; err != nil {
		response.Fail(c, "文章不存在或未发布", nil)
		return
	}

	var blanks []models.ClozeBlank
	db.Where("passage_id = ? AND is_deleted = ?", passage.ID, models.SoftDeleteStatusActive).
		Order("blank_no ASC, id ASC").
		Find(&blanks)

	bs := make([]gin.H, 0, len(blanks))
	for _, b := range blanks {
		bs = append(bs, gin.H{
			"id":      b.ID,
			"blankNo": b.BlankNo,
			"options": parseClozeOptions(b.Options),
		})
	}

	response.SuccessMsg(c, "success", gin.H{
		"id":               passage.ID,
		"title":            passage.Title,
		"level":            passage.Level,
		"content":          passage.Content,
		"summary":          passage.Summary,
		"blankCount":       passage.BlankCount,
		"estimatedMinutes": passage.EstimatedMinutes,
		"blanks":           bs,
	})
}

// POST /cloze/passages/:id/submit
func (h *Handlers) handleClozeSubmit(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效文章ID"})
		return
	}

	var body struct {
		Answers []struct {
			BlankID uint   `json:"blankId"`
			Answer  string `json:"answer"`
		} `json:"answers" binding:"required"`
		DurationSec int `json:"durationSec"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	if len(body.Answers) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "答案不能为空"})
		return
	}

	var passage models.ClozePassage
	if err := db.Where("id = ? AND is_deleted = ? AND status = ?",
		id, models.SoftDeleteStatusActive, models.ClozeStatusPublished).
		First(&passage).Error; err != nil {
		response.Fail(c, "文章不存在或未发布", nil)
		return
	}

	var blanks []models.ClozeBlank
	db.Where("passage_id = ? AND is_deleted = ?", passage.ID, models.SoftDeleteStatusActive).
		Order("blank_no ASC, id ASC").
		Find(&blanks)
	if len(blanks) == 0 {
		response.Fail(c, "该文章暂无空位题目", nil)
		return
	}

	answerMap := make(map[uint]string, len(body.Answers))
	for _, a := range body.Answers {
		answerMap[a.BlankID] = strings.TrimSpace(strings.ToUpper(a.Answer))
	}

	details := make([]clozeAnswerItem, 0, len(blanks))
	correctCount := 0
	for _, b := range blanks {
		userAns := answerMap[b.ID]
		right := strings.TrimSpace(strings.ToUpper(b.Answer))
		ok := userAns != "" && userAns == right
		if ok {
			correctCount++
		}
		details = append(details, clozeAnswerItem{
			BlankID:     b.ID,
			BlankNo:     b.BlankNo,
			Answer:      userAns,
			Correct:     ok,
			RightAnswer: right,
			Explanation: b.Explanation,
		})
	}

	total := len(blanks)
	score := 0
	if total > 0 {
		score = correctCount * 100 / total
	}

	answersJSON, _ := json.Marshal(details)
	now := time.Now()
	var record models.ClozeRecord

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.ClozeRecord{}).
			Where("user_id = ? AND passage_id = ? AND is_latest = ?", user.ID, passage.ID, true).
			Update("is_latest", false).Error; err != nil {
			return err
		}
		record = models.ClozeRecord{
			UserID:       user.ID,
			PassageID:    passage.ID,
			Answers:      string(answersJSON),
			BlankCount:   total,
			CorrectCount: correctCount,
			Score:        score,
			DurationSec:  body.DurationSec,
			IsLatest:     true,
			CompletedAt:  &now,
		}
		return tx.Create(&record).Error
	})
	if err != nil {
		response.Fail(c, "保存答题记录失败", err)
		return
	}

	response.SuccessMsg(c, "success", gin.H{
		"recordId":     record.ID,
		"passageId":    passage.ID,
		"title":        passage.Title,
		"level":        passage.Level,
		"blankCount":   total,
		"correctCount": correctCount,
		"score":        score,
		"durationSec":  body.DurationSec,
		"completedAt":  now,
		"details":      details,
	})
}

// GET /cloze/records
func (h *Handlers) handleClozeListRecords(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	q := db.Model(&models.ClozeRecord{}).
		Where("user_id = ? AND is_deleted = ?", user.ID, models.SoftDeleteStatusActive)

	var total int64
	q.Count(&total)

	var records []models.ClozeRecord
	q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&records)

	passageIDs := make([]uint, 0, len(records))
	for _, r := range records {
		passageIDs = append(passageIDs, r.PassageID)
	}
	titleMap := map[uint]string{}
	levelMap := map[uint]string{}
	if len(passageIDs) > 0 {
		var passages []models.ClozePassage
		db.Select("id, title, level").Where("id IN ?", passageIDs).Find(&passages)
		for _, p := range passages {
			titleMap[p.ID] = p.Title
			levelMap[p.ID] = p.Level
		}
	}

	list := make([]gin.H, 0, len(records))
	for _, r := range records {
		list = append(list, gin.H{
			"id":           r.ID,
			"passageId":    r.PassageID,
			"title":        titleMap[r.PassageID],
			"level":        levelMap[r.PassageID],
			"blankCount":   r.BlankCount,
			"correctCount": r.CorrectCount,
			"score":        r.Score,
			"durationSec":  r.DurationSec,
			"isLatest":     r.IsLatest,
			"completedAt":  r.CompletedAt,
		})
	}

	response.SuccessMsg(c, "success", gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GET /cloze/records/:id
func (h *Handlers) handleClozeGetRecord(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效记录ID"})
		return
	}

	var record models.ClozeRecord
	if err := db.Where("id = ? AND user_id = ? AND is_deleted = ?",
		id, user.ID, models.SoftDeleteStatusActive).First(&record).Error; err != nil {
		response.Fail(c, "记录不存在", nil)
		return
	}

	var passage models.ClozePassage
	db.Select("id, title, level, content").First(&passage, record.PassageID)

	var details []clozeAnswerItem
	_ = json.Unmarshal([]byte(record.Answers), &details)

	response.SuccessMsg(c, "success", gin.H{
		"id":           record.ID,
		"passageId":    record.PassageID,
		"title":        passage.Title,
		"level":        passage.Level,
		"content":      passage.Content,
		"blankCount":   record.BlankCount,
		"correctCount": record.CorrectCount,
		"score":        record.Score,
		"durationSec":  record.DurationSec,
		"completedAt":  record.CompletedAt,
		"details":      details,
	})
}

// ---------- admin ----------

func (h *Handlers) handleAdminClozeListPassages(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	q := db.Model(&models.ClozePassage{}).Where("is_deleted = ?", models.SoftDeleteStatusActive)
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		q = q.Where("status = ?", status)
	}

	var total int64
	q.Count(&total)
	var list []models.ClozePassage
	q.Order("sort_order ASC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list)
	response.SuccessMsg(c, "success", gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func (h *Handlers) handleAdminClozeGetPassage(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var passage models.ClozePassage
	if err := db.Where("id = ? AND is_deleted = ?", id, models.SoftDeleteStatusActive).First(&passage).Error; err != nil {
		response.Fail(c, "文章不存在", nil)
		return
	}
	var blanks []models.ClozeBlank
	db.Where("passage_id = ? AND is_deleted = ?", passage.ID, models.SoftDeleteStatusActive).
		Order("blank_no ASC, id ASC").Find(&blanks)

	bs := make([]gin.H, 0, len(blanks))
	for _, b := range blanks {
		bs = append(bs, gin.H{
			"id":          b.ID,
			"blankNo":     b.BlankNo,
			"options":     parseClozeOptions(b.Options),
			"answer":      b.Answer,
			"explanation": b.Explanation,
		})
	}
	response.SuccessMsg(c, "success", gin.H{"passage": passage, "blanks": bs})
}

func (h *Handlers) handleAdminClozeCreatePassage(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)

	var body struct {
		Title            string `json:"title" binding:"required"`
		Level            string `json:"level"`
		Content          string `json:"content" binding:"required"`
		Summary          string `json:"summary"`
		Status           string `json:"status"`
		EstimatedMinutes int    `json:"estimatedMinutes"`
		SortOrder        int    `json:"sortOrder"`
		Blanks           []struct {
			BlankNo     int           `json:"blankNo" binding:"required"`
			Options     []clozeOption `json:"options" binding:"required"`
			Answer      string        `json:"answer" binding:"required"`
			Explanation string        `json:"explanation"`
		} `json:"blanks"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	status := body.Status
	if status == "" {
		status = models.ClozeStatusPublished
	}
	level := body.Level
	if level == "" {
		level = "初阶"
	}
	minutes := body.EstimatedMinutes
	if minutes <= 0 {
		minutes = 5
	}
	op := ""
	if user != nil {
		op = user.Username
	}

	var passage models.ClozePassage
	err := db.Transaction(func(tx *gorm.DB) error {
		passage = models.ClozePassage{
			Title:            strings.TrimSpace(body.Title),
			Level:            level,
			Content:          body.Content,
			Summary:          body.Summary,
			Status:           status,
			BlankCount:       countClozeMarkers(body.Content),
			EstimatedMinutes: minutes,
			SortOrder:        body.SortOrder,
		}
		if len(body.Blanks) > 0 {
			passage.BlankCount = len(body.Blanks)
		}
		passage.SetCreateInfo(op)
		if err := tx.Create(&passage).Error; err != nil {
			return err
		}
		for _, b := range body.Blanks {
			opts, _ := json.Marshal(b.Options)
			bb := models.ClozeBlank{
				PassageID:   passage.ID,
				BlankNo:     b.BlankNo,
				Options:     string(opts),
				Answer:      strings.ToUpper(strings.TrimSpace(b.Answer)),
				Explanation: b.Explanation,
			}
			bb.SetCreateInfo(op)
			if err := tx.Create(&bb).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		response.Fail(c, "创建失败", err)
		return
	}
	response.SuccessMsg(c, "创建成功", gin.H{"id": passage.ID})
}

func (h *Handlers) handleAdminClozeUpdatePassage(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var passage models.ClozePassage
	if err := db.Where("id = ? AND is_deleted = ?", id, models.SoftDeleteStatusActive).First(&passage).Error; err != nil {
		response.Fail(c, "文章不存在", nil)
		return
	}

	var body struct {
		Title            *string `json:"title"`
		Level            *string `json:"level"`
		Content          *string `json:"content"`
		Summary          *string `json:"summary"`
		Status           *string `json:"status"`
		EstimatedMinutes *int    `json:"estimatedMinutes"`
		SortOrder        *int    `json:"sortOrder"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if body.Title != nil {
		passage.Title = strings.TrimSpace(*body.Title)
	}
	if body.Level != nil {
		passage.Level = *body.Level
	}
	if body.Content != nil {
		passage.Content = *body.Content
		passage.BlankCount = countClozeMarkers(*body.Content)
	}
	if body.Summary != nil {
		passage.Summary = *body.Summary
	}
	if body.Status != nil {
		passage.Status = *body.Status
	}
	if body.EstimatedMinutes != nil {
		passage.EstimatedMinutes = *body.EstimatedMinutes
	}
	if body.SortOrder != nil {
		passage.SortOrder = *body.SortOrder
	}
	if user != nil {
		passage.SetUpdateInfo(user.Username)
	}
	if err := db.Save(&passage).Error; err != nil {
		response.Fail(c, "更新失败", err)
		return
	}
	response.SuccessMsg(c, "更新成功", passage)
}

func (h *Handlers) handleAdminClozeDeletePassage(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var passage models.ClozePassage
	if err := db.Where("id = ? AND is_deleted = ?", id, models.SoftDeleteStatusActive).First(&passage).Error; err != nil {
		response.Fail(c, "文章不存在", nil)
		return
	}
	op := ""
	if user != nil {
		op = user.Username
	}
	passage.SoftDelete(op)
	if err := db.Save(&passage).Error; err != nil {
		response.Fail(c, "删除失败", err)
		return
	}
	db.Model(&models.ClozeBlank{}).
		Where("passage_id = ? AND is_deleted = ?", passage.ID, models.SoftDeleteStatusActive).
		Updates(map[string]any{"is_deleted": models.SoftDeleteStatusDeleted, "update_by": op})
	response.SuccessMsg(c, "删除成功", nil)
}
