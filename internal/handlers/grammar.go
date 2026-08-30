package handlers

import (
	"encoding/json"
	"errors"

	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"github.com/LingByte/ling-base/apidocs/humax"
	lbconstants "github.com/LingByte/ling-base/common/constants"

	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type grammarOption struct {
	Key  string `json:"key"`
	Text string `json:"text"`
}

type grammarExample struct {
	En string `json:"en"`
	Zh string `json:"zh"`
}

type grammarAnswerItem struct {
	QuestionID  uint   `json:"questionId"`
	Answer      string `json:"answer"`
	Correct     bool   `json:"correct"`
	RightAnswer string `json:"rightAnswer,omitempty"`
	Stem        string `json:"stem,omitempty"`
	Explanation string `json:"explanation,omitempty"`
}

func (h *Handlers) registerGrammarRoutes(r *humax.Group) {
	rg := r.Group("grammar")
	{
		user := rg.Group("")
		user.Use(auth.Required)
		user.GET("/lessons", h.handleGrammarListLessons)
		user.GET("/lessons/:id", h.handleGrammarGetLesson)
		user.POST("/lessons/:id/submit", h.handleGrammarSubmit)
		user.GET("/records", h.handleGrammarListRecords)
		user.GET("/records/:id", h.handleGrammarGetRecord)

		admin := rg.Group("admin")
		admin.Use(auth.Required, auth.AdminRequired)
		admin.GET("/lessons", h.handleAdminGrammarListLessons)
		admin.GET("/lessons/:id", h.handleAdminGrammarGetLesson)
		admin.POST("/lessons", h.handleAdminGrammarCreateLesson)
		admin.PUT("/lessons/:id", h.handleAdminGrammarUpdateLesson)
		admin.DELETE("/lessons/:id", h.handleAdminGrammarDeleteLesson)
	}
}

func parseGrammarOptions(raw string) []grammarOption {
	var opts []grammarOption
	_ = json.Unmarshal([]byte(raw), &opts)
	return opts
}

func parseGrammarExamples(raw string) []grammarExample {
	var ex []grammarExample
	_ = json.Unmarshal([]byte(raw), &ex)
	return ex
}

// GET /grammar/lessons
func (h *Handlers) handleGrammarListLessons(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)

	level := strings.TrimSpace(c.Query("level"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	q := db.Model(&models.GrammarLesson{}).
		Where("status = ?", models.GrammarStatusPublished)
	if level != "" {
		q = q.Where("level = ?", level)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}

	var list []models.GrammarLesson
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

	type qCount struct {
		LessonID uint
		Cnt      int64
	}
	countMap := map[uint]int64{}
	if len(ids) > 0 {
		var rows []qCount
		db.Model(&models.GrammarQuestion{}).
			Select("lesson_id as lesson_id, count(*) as cnt").
			Where("lesson_id IN ?", ids).
			Group("lesson_id").
			Scan(&rows)
		for _, r := range rows {
			countMap[r.LessonID] = r.Cnt
		}
	}

	latestMap := map[uint]models.GrammarRecord{}
	if user != nil && len(ids) > 0 {
		var records []models.GrammarRecord
		db.Where("user_id = ? AND lesson_id IN ? AND is_latest = ?",
			user.ID, ids, true).
			Find(&records)
		for _, rec := range records {
			latestMap[rec.LessonID] = rec
		}
	}

	items := make([]gin.H, 0, len(list))
	for _, p := range list {
		item := gin.H{
			"id":               p.ID,
			"title":            p.Title,
			"topic":            p.Topic,
			"level":            p.Level,
			"summary":          p.Summary,
			"estimatedMinutes": p.EstimatedMinutes,
			"questionCount":    countMap[p.ID],
			"sortOrder":        p.SortOrder,
		}
		if rec, ok := latestMap[p.ID]; ok {
			item["lastScore"] = rec.Score
			item["lastCorrectCount"] = rec.CorrectCount
			item["lastQuestionCount"] = rec.QuestionCount
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

// GET /grammar/lessons/:id — 含讲解与题目（题目不含答案）
func (h *Handlers) handleGrammarGetLesson(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("无效课程ID"))
		return
	}

	var lesson models.GrammarLesson
	if err := db.Where("id = ? AND status = ?",
		id, models.GrammarStatusPublished).
		First(&lesson).Error; err != nil {
		response.Fail(c, "课程不存在或未发布", nil)
		return
	}

	var questions []models.GrammarQuestion
	db.Where("lesson_id = ?", lesson.ID).
		Order("sort_order ASC, id ASC").
		Find(&questions)

	qs := make([]gin.H, 0, len(questions))
	for _, q := range questions {
		qs = append(qs, gin.H{
			"id":        q.ID,
			"stem":      q.Stem,
			"options":   parseGrammarOptions(q.Options),
			"sortOrder": q.SortOrder,
		})
	}

	response.SuccessMsg(c, "success", gin.H{
		"id":               lesson.ID,
		"title":            lesson.Title,
		"topic":            lesson.Topic,
		"level":            lesson.Level,
		"explanation":      lesson.Explanation,
		"examples":         parseGrammarExamples(lesson.Examples),
		"summary":          lesson.Summary,
		"estimatedMinutes": lesson.EstimatedMinutes,
		"questions":        qs,
	})
}

// POST /grammar/lessons/:id/submit
func (h *Handlers) handleGrammarSubmit(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.AbortWithStatusJSON(c, http.StatusUnauthorized, errors.New("未登录"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("无效课程ID"))
		return
	}

	var body struct {
		Answers []struct {
			QuestionID uint   `json:"questionId"`
			Answer     string `json:"answer"`
		} `json:"answers" binding:"required"`
		DurationSec int `json:"durationSec"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("参数错误"))
		return
	}
	if len(body.Answers) == 0 {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("答案不能为空"))
		return
	}

	var lesson models.GrammarLesson
	if err := db.Where("id = ? AND status = ?",
		id, models.GrammarStatusPublished).
		First(&lesson).Error; err != nil {
		response.Fail(c, "课程不存在或未发布", nil)
		return
	}

	var questions []models.GrammarQuestion
	db.Where("lesson_id = ?", lesson.ID).
		Order("sort_order ASC, id ASC").
		Find(&questions)
	if len(questions) == 0 {
		response.Fail(c, "该课程暂无练习题", nil)
		return
	}

	answerMap := make(map[uint]string, len(body.Answers))
	for _, a := range body.Answers {
		answerMap[a.QuestionID] = strings.TrimSpace(strings.ToUpper(a.Answer))
	}

	details := make([]grammarAnswerItem, 0, len(questions))
	correctCount := 0
	for _, q := range questions {
		userAns := answerMap[q.ID]
		right := strings.TrimSpace(strings.ToUpper(q.Answer))
		ok := userAns != "" && userAns == right
		if ok {
			correctCount++
		}
		details = append(details, grammarAnswerItem{
			QuestionID:  q.ID,
			Answer:      userAns,
			Correct:     ok,
			RightAnswer: right,
			Stem:        q.Stem,
			Explanation: q.Explanation,
		})
	}

	total := len(questions)
	score := 0
	if total > 0 {
		score = correctCount * 100 / total
	}

	answersJSON, _ := json.Marshal(details)
	now := time.Now()
	var record models.GrammarRecord

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.GrammarRecord{}).
			Where("user_id = ? AND lesson_id = ? AND is_latest = ?", user.ID, lesson.ID, true).
			Update("is_latest", false).Error; err != nil {
			return err
		}
		record = models.GrammarRecord{
			UserID:        user.ID,
			LessonID:      lesson.ID,
			Answers:       string(answersJSON),
			QuestionCount: total,
			CorrectCount:  correctCount,
			Score:         score,
			DurationSec:   body.DurationSec,
			IsLatest:      true,
			CompletedAt:   &now,
		}
		return tx.Create(&record).Error
	})
	if err != nil {
		response.Fail(c, "保存答题记录失败", err)
		return
	}

	response.SuccessMsg(c, "success", gin.H{
		"recordId":      record.ID,
		"lessonId":      lesson.ID,
		"title":         lesson.Title,
		"topic":         lesson.Topic,
		"level":         lesson.Level,
		"questionCount": total,
		"correctCount":  correctCount,
		"score":         score,
		"durationSec":   body.DurationSec,
		"completedAt":   now,
		"details":       details,
	})
}

// GET /grammar/records
func (h *Handlers) handleGrammarListRecords(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.AbortWithStatusJSON(c, http.StatusUnauthorized, errors.New("未登录"))
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

	q := db.Model(&models.GrammarRecord{}).
		Where("user_id = ?", user.ID)

	var total int64
	q.Count(&total)

	var records []models.GrammarRecord
	q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&records)

	lessonIDs := make([]uint, 0, len(records))
	for _, r := range records {
		lessonIDs = append(lessonIDs, r.LessonID)
	}
	titleMap := map[uint]string{}
	topicMap := map[uint]string{}
	levelMap := map[uint]string{}
	if len(lessonIDs) > 0 {
		var lessons []models.GrammarLesson
		db.Select("id, title, topic, level").Where("id IN ?", lessonIDs).Find(&lessons)
		for _, p := range lessons {
			titleMap[p.ID] = p.Title
			topicMap[p.ID] = p.Topic
			levelMap[p.ID] = p.Level
		}
	}

	list := make([]gin.H, 0, len(records))
	for _, r := range records {
		list = append(list, gin.H{
			"id":            r.ID,
			"lessonId":      r.LessonID,
			"title":         titleMap[r.LessonID],
			"topic":         topicMap[r.LessonID],
			"level":         levelMap[r.LessonID],
			"questionCount": r.QuestionCount,
			"correctCount":  r.CorrectCount,
			"score":         r.Score,
			"durationSec":   r.DurationSec,
			"isLatest":      r.IsLatest,
			"completedAt":   r.CompletedAt,
		})
	}

	response.SuccessMsg(c, "success", gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GET /grammar/records/:id
func (h *Handlers) handleGrammarGetRecord(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.AbortWithStatusJSON(c, http.StatusUnauthorized, errors.New("未登录"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("无效记录ID"))
		return
	}

	var record models.GrammarRecord
	if err := db.Where("id = ? AND user_id = ?",
		id, user.ID).First(&record).Error; err != nil {
		response.Fail(c, "记录不存在", nil)
		return
	}

	var lesson models.GrammarLesson
	db.Select("id, title, topic, level").First(&lesson, record.LessonID)

	var details []grammarAnswerItem
	_ = json.Unmarshal([]byte(record.Answers), &details)

	response.SuccessMsg(c, "success", gin.H{
		"id":            record.ID,
		"lessonId":      record.LessonID,
		"title":         lesson.Title,
		"topic":         lesson.Topic,
		"level":         lesson.Level,
		"questionCount": record.QuestionCount,
		"correctCount":  record.CorrectCount,
		"score":         record.Score,
		"durationSec":   record.DurationSec,
		"completedAt":   record.CompletedAt,
		"details":       details,
	})
}

// ---------- admin ----------

func (h *Handlers) handleAdminGrammarListLessons(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	q := db.Model(&models.GrammarLesson{})
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		q = q.Where("status = ?", status)
	}

	var total int64
	q.Count(&total)
	var list []models.GrammarLesson
	q.Order("sort_order ASC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list)
	response.SuccessMsg(c, "success", gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func (h *Handlers) handleAdminGrammarGetLesson(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var lesson models.GrammarLesson
	if err := db.Where("id = ?", id).First(&lesson).Error; err != nil {
		response.Fail(c, "课程不存在", nil)
		return
	}
	var questions []models.GrammarQuestion
	db.Where("lesson_id = ?", lesson.ID).
		Order("sort_order ASC, id ASC").Find(&questions)

	qs := make([]gin.H, 0, len(questions))
	for _, q := range questions {
		qs = append(qs, gin.H{
			"id":          q.ID,
			"stem":        q.Stem,
			"options":     parseGrammarOptions(q.Options),
			"answer":      q.Answer,
			"explanation": q.Explanation,
			"sortOrder":   q.SortOrder,
		})
	}
	response.SuccessMsg(c, "success", gin.H{
		"lesson":    lesson,
		"examples":  parseGrammarExamples(lesson.Examples),
		"questions": qs,
	})
}

func (h *Handlers) handleAdminGrammarCreateLesson(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)

	var body struct {
		Title            string           `json:"title" binding:"required"`
		Topic            string           `json:"topic"`
		Level            string           `json:"level"`
		Explanation      string           `json:"explanation" binding:"required"`
		Examples         []grammarExample `json:"examples"`
		Summary          string           `json:"summary"`
		Status           string           `json:"status"`
		EstimatedMinutes int              `json:"estimatedMinutes"`
		SortOrder        int              `json:"sortOrder"`
		Questions        []struct {
			Stem        string          `json:"stem" binding:"required"`
			Options     []grammarOption `json:"options" binding:"required"`
			Answer      string          `json:"answer" binding:"required"`
			Explanation string          `json:"explanation"`
			SortOrder   int             `json:"sortOrder"`
		} `json:"questions"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("参数错误"))
		return
	}

	status := body.Status
	if status == "" {
		status = models.GrammarStatusPublished
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

	exJSON, _ := json.Marshal(body.Examples)
	var lesson models.GrammarLesson
	err := db.Transaction(func(tx *gorm.DB) error {
		lesson = models.GrammarLesson{
			Title:            strings.TrimSpace(body.Title),
			Topic:            body.Topic,
			Level:            level,
			Explanation:      body.Explanation,
			Examples:         string(exJSON),
			Summary:          body.Summary,
			Status:           status,
			EstimatedMinutes: minutes,
			SortOrder:        body.SortOrder,
		}
		lesson.SetCreateInfo(op)
		if err := tx.Create(&lesson).Error; err != nil {
			return err
		}
		for i, q := range body.Questions {
			opts, _ := json.Marshal(q.Options)
			sort := q.SortOrder
			if sort == 0 {
				sort = i + 1
			}
			qq := models.GrammarQuestion{
				LessonID:    lesson.ID,
				Stem:        q.Stem,
				Options:     string(opts),
				Answer:      strings.ToUpper(strings.TrimSpace(q.Answer)),
				Explanation: q.Explanation,
				SortOrder:   sort,
			}
			qq.SetCreateInfo(op)
			if err := tx.Create(&qq).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		response.Fail(c, "创建失败", err)
		return
	}
	response.SuccessMsg(c, "创建成功", gin.H{"id": lesson.ID})
}

func (h *Handlers) handleAdminGrammarUpdateLesson(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var lesson models.GrammarLesson
	if err := db.Where("id = ?", id).First(&lesson).Error; err != nil {
		response.Fail(c, "课程不存在", nil)
		return
	}

	var body struct {
		Title            *string          `json:"title"`
		Topic            *string          `json:"topic"`
		Level            *string          `json:"level"`
		Explanation      *string          `json:"explanation"`
		Examples         []grammarExample `json:"examples"`
		Summary          *string          `json:"summary"`
		Status           *string          `json:"status"`
		EstimatedMinutes *int             `json:"estimatedMinutes"`
		SortOrder        *int             `json:"sortOrder"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("参数错误"))
		return
	}

	if body.Title != nil {
		lesson.Title = strings.TrimSpace(*body.Title)
	}
	if body.Topic != nil {
		lesson.Topic = *body.Topic
	}
	if body.Level != nil {
		lesson.Level = *body.Level
	}
	if body.Explanation != nil {
		lesson.Explanation = *body.Explanation
	}
	if body.Examples != nil {
		exJSON, _ := json.Marshal(body.Examples)
		lesson.Examples = string(exJSON)
	}
	if body.Summary != nil {
		lesson.Summary = *body.Summary
	}
	if body.Status != nil {
		lesson.Status = *body.Status
	}
	if body.EstimatedMinutes != nil {
		lesson.EstimatedMinutes = *body.EstimatedMinutes
	}
	if body.SortOrder != nil {
		lesson.SortOrder = *body.SortOrder
	}
	if user != nil {
		lesson.SetUpdateInfo(user.Username)
	}
	if err := db.Save(&lesson).Error; err != nil {
		response.Fail(c, "更新失败", err)
		return
	}
	response.SuccessMsg(c, "更新成功", lesson)
}

func (h *Handlers) handleAdminGrammarDeleteLesson(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var lesson models.GrammarLesson
	if err := db.Where("id = ?", id).First(&lesson).Error; err != nil {
		response.Fail(c, "课程不存在", nil)
		return
	}
	op := ""
	if user != nil {
		op = user.Username
	}
	lesson.SoftDelete(op)
	if err := db.Save(&lesson).Error; err != nil {
		response.Fail(c, "删除失败", err)
		return
	}
	if err := db.Where("lesson_id = ?", lesson.ID).Delete(&models.GrammarQuestion{}).Error; err != nil {
		response.Fail(c, "删除失败", err)
		return
	}
	response.SuccessMsg(c, "删除成功", nil)
}
