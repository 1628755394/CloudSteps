package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/CloudStepsGo/pkg/response"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// handleReviewToday GET /review/today?wordBookId=1&date=YYYY-MM-DD&timeZone=Asia/Shanghai
// 取词口径与 /review/books-by-date 对齐：今日含逾期至本地明日 0 点前；其它日仅该日 due。
func (h *Handlers) handleReviewToday(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	wordBookID, _ := strconv.Atoi(c.Query("wordBookId"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	tzName := c.DefaultQuery("timeZone", "Asia/Shanghai")
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		loc = time.FixedZone("CST", 8*3600)
	}

	nowLocal := time.Now().In(loc)
	todayStart := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc)

	dateStr := strings.TrimSpace(c.Query("date"))
	dayStart := todayStart
	if dateStr != "" {
		parsed, perr := time.ParseInLocation("2006-01-02", dateStr, loc)
		if perr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "date 格式应为 YYYY-MM-DD"})
			return
		}
		dayStart = time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, loc)
	}
	dayEnd := dayStart.Add(24 * time.Hour)
	isSelectedToday := dayStart.Equal(todayStart)

	q := db.Model(&models.ReviewQueue{}).
		Where("user_id = ? AND status = ?", user.ID, "pending")
	if wordBookID > 0 {
		q = q.Where("word_book_id = ?", wordBookID)
	}
	if isSelectedToday {
		q = q.Where("due_at < ?", dayEnd)
	} else {
		q = q.Where("due_at >= ? AND due_at < ?", dayStart, dayEnd)
	}

	var items []models.ReviewQueue
	if err := q.Order("due_at ASC, id ASC").Limit(limit).Find(&items).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}

	wordIDs := make([]uint, 0, len(items))
	order := make(map[uint]int, len(items))
	for i, it := range items {
		wordIDs = append(wordIDs, it.WordID)
		order[it.WordID] = i
	}

	var words []models.WordLite
	if len(wordIDs) > 0 {
		_ = db.Where("id IN ?", wordIDs).Find(&words).Error
	}

	sorted := make([]models.WordLite, 0, len(words))
	tmp := make([]*models.WordLite, len(items))
	for i := range words {
		w := words[i]
		idx, ok := order[w.ID]
		if !ok {
			continue
		}
		ww := w
		tmp[idx] = &ww
	}
	for _, p := range tmp {
		if p != nil {
			sorted = append(sorted, *p)
		}
	}

	response.Success(c, "success", gin.H{
		"total": len(sorted),
		"words": sorted,
		"date":  dayStart.Format("2006-01-02"),
	})
}

// handleReviewBooks GET /review/books
func (h *Handlers) handleReviewBooks(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	now := time.Now().UTC()

	type bookStat struct {
		WordBookID uint   `gorm:"column:word_book_id" json:"wordBookId"`
		Count      int64  `gorm:"column:cnt" json:"cnt"`
		BookName   string `gorm:"column:name" json:"name"`
		Level      string `gorm:"column:level" json:"level"`
	}
	var stats []bookStat

	err := db.Raw(`
		SELECT rq.word_book_id, COUNT(*) as cnt, wb.name, wb.level
		FROM review_queue rq
		JOIN word_books wb ON wb.id = rq.word_book_id
		WHERE rq.user_id = ? AND rq.status = 'pending' AND rq.due_at <= ?
		GROUP BY rq.word_book_id, wb.name, wb.level
	`, user.ID, now).Scan(&stats).Error
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	response.Success(c, "success", stats)
}

// handleReviewBooksByDate GET /review/books-by-date?date=2006-01-02&timeZone=Asia/Shanghai
// 按「用户时区下的自然日」统计该日待复习词数（按词库分组）。
// - 选中「今天」：与原先 /review/books 一致，包含逾期未复习（due_at < 明天 0 点）。
// - 选中其它日期：仅包含 due_at 落在该日 0 点～次日 0 点之间的待复习项。
func (h *Handlers) handleReviewBooksByDate(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	dateStr := c.Query("date")
	if dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "date 必填，格式 YYYY-MM-DD"})
		return
	}

	tzName := c.DefaultQuery("timeZone", "Asia/Shanghai")
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		loc = time.FixedZone("CST", 8*3600)
	}

	dayStart, err := time.ParseInLocation("2006-01-02", dateStr, loc)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "date 格式应为 YYYY-MM-DD"})
		return
	}
	dayStart = time.Date(dayStart.Year(), dayStart.Month(), dayStart.Day(), 0, 0, 0, 0, loc)
	dayEnd := dayStart.Add(24 * time.Hour)

	now := time.Now().In(loc)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	isSelectedToday := dayStart.Equal(todayStart)

	type bookStat struct {
		WordBookID uint   `gorm:"column:word_book_id" json:"wordBookId"`
		Count      int64  `gorm:"column:cnt" json:"cnt"`
		BookName   string `gorm:"column:name" json:"name"`
		Level      string `gorm:"column:level" json:"level"`
	}
	var stats []bookStat

	var q string
	var args []any
	if isSelectedToday {
		// 今日：待复习且 due 不晚于「本地明天 0 点」＝今日应完成 + 逾期
		q = `
			SELECT rq.word_book_id, COUNT(*) as cnt, wb.name, wb.level
			FROM review_queue rq
			JOIN word_books wb ON wb.id = rq.word_book_id
			WHERE rq.user_id = ? AND rq.status = 'pending' AND rq.due_at < ?
			GROUP BY rq.word_book_id, wb.name, wb.level
		`
		args = []any{user.ID, dayEnd}
	} else {
		q = `
			SELECT rq.word_book_id, COUNT(*) as cnt, wb.name, wb.level
			FROM review_queue rq
			JOIN word_books wb ON wb.id = rq.word_book_id
			WHERE rq.user_id = ? AND rq.status = 'pending' AND rq.due_at >= ? AND rq.due_at < ?
			GROUP BY rq.word_book_id, wb.name, wb.level
		`
		args = []any{user.ID, dayStart, dayEnd}
	}

	err = db.Raw(q, args...).Scan(&stats).Error
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	response.Success(c, "success", stats)
}

// handleReviewCurve GET /review/curve
func (h *Handlers) handleReviewCurve(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	type stageCount struct {
		ReviewStage int   `gorm:"column:review_stage"`
		Count      int64 `gorm:"column:cnt"`
	}
	var rows []stageCount
	_ = db.Model(&models.UserWordState{}).
		Select("review_stage, COUNT(*) as cnt").
		Where("user_id = ? AND learn_status IN ?", user.ID, []string{"learning", "learned", "mastered"}).
		Group("review_stage").
		Scan(&rows).Error

	countMap := map[int]int64{}
	for _, r := range rows {
		countMap[r.ReviewStage] = r.Count
	}

	var mastered int64
	_ = db.Model(&models.UserWordState{}).Where("user_id = ? AND learn_status = ?", user.ID, "mastered").Count(&mastered).Error

	stages := make([]gin.H, 0, len(models.EbbinghausIntervals))
	for i, days := range models.EbbinghausIntervals {
		label := ""
		switch i {
		case 0:
			label = "学习"
		default:
			label = strconv.Itoa(days) + "天"
		}
		stages = append(stages, gin.H{"index": i, "days": days, "label": label, "count": countMap[i]})
	}

	response.Success(c, "success", gin.H{
		"stages":   stages,
		"mastered": mastered,
	})
}

// handleReviewSessionStart POST /review/session/start
// body: { wordBookId?: number, wordIds?: number[] }
func (h *Handlers) handleReviewSessionStart(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	now := time.Now().UTC()

	var body struct {
		WordBookID uint   `json:"wordBookId"`
		WordIDs    []uint `json:"wordIds"`
	}
	_ = c.ShouldBindJSON(&body)

	wordIDs := make([]uint, 0)
	var session models.StudySession
	if err := db.Transaction(func(tx *gorm.DB) error {
		if len(body.WordIDs) > 0 {
			// 显式 wordIds：只校验 pending，不再卡 due_at<=now（与抗遗忘列表日期口径一致）
			var items []models.ReviewQueue
			q := tx.Model(&models.ReviewQueue{}).
				Where("user_id = ? AND word_id IN ? AND status = ?", user.ID, body.WordIDs, "pending")
			if body.WordBookID > 0 {
				q = q.Where("word_book_id = ?", body.WordBookID)
			}
			if err := q.Clauses(clause.Locking{Strength: "UPDATE"}).Find(&items).Error; err != nil {
				return err
			}
			if len(items) != len(body.WordIDs) {
				return errors.New("存在不可用的复习单词（可能已完成或不在队列）")
			}
			ids := make([]uint, 0, len(items))
			for _, it := range items {
				ids = append(ids, it.ID)
				wordIDs = append(wordIDs, it.WordID)
			}
			if err := tx.Model(&models.ReviewQueue{}).
				Where("id IN ?", ids).
				Update("status", "in_session").Error; err != nil {
				return err
			}

			// IMPORTANT: when wordIds are explicitly provided, we only start a session with those.
			// Do NOT auto-pick extra due words.
			return nil
		}
		// 未指定词：取「本地今日应复习」（含逾期），与 books-by-date /today 对齐
		loc := time.Local
		nowLocal := time.Now().In(loc)
		dayEnd := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc).Add(24 * time.Hour)
		q := tx.Model(&models.ReviewQueue{}).
			Where("user_id = ? AND status = ? AND due_at < ?", user.ID, "pending", dayEnd)
		if body.WordBookID > 0 {
			q = q.Where("word_book_id = ?", body.WordBookID)
		}
		var items []models.ReviewQueue
		if err := q.Clauses(clause.Locking{Strength: "UPDATE"}).
			Order("due_at ASC, id ASC").Limit(20).Find(&items).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		ids := make([]uint, 0, len(items))
		for _, it := range items {
			ids = append(ids, it.ID)
			wordIDs = append(wordIDs, it.WordID)
		}
		if err := tx.Model(&models.ReviewQueue{}).
			Where("id IN ?", ids).
			Update("status", "in_session").Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		response.Fail(c, "取题失败", err)
		return
	}

	if len(wordIDs) == 0 {
		response.Success(c, "今日无待复习单词", gin.H{"finished": true})
		return
	}

	var words []models.WordLite
	_ = db.Where("id IN ?", wordIDs).Find(&words).Error

	session = models.StudySession{
		UserID:      user.ID,
		WordBookID:  body.WordBookID,
		SessionType: "review",
		Status:      "in_progress",
		StartedAt:   now,
		WordCount:   len(wordIDs),
	}
	if err := db.Create(&session).Error; err != nil {
		response.Fail(c, "创建复习会话失败", err)
		return
	}

	sw := make([]models.SessionWord, 0, len(wordIDs))
	for _, wid := range wordIDs {
		sw = append(sw, models.SessionWord{SessionID: session.ID, WordID: wid})
	}
	_ = db.Create(&sw).Error

	response.Success(c, "success", gin.H{"sessionId": session.ID, "words": words})
}

// handleReviewSessionComplete POST /review/session/:id/complete
func (h *Handlers) handleReviewSessionComplete(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	sessionID, _ := strconv.Atoi(c.Param("id"))
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	var body struct {
		Results []struct {
			WordID     uint `json:"wordId"`
			Remembered bool `json:"remembered"`
		} `json:"results" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	var session models.StudySession
	if err := db.Where("id = ? AND user_id = ?", sessionID, user.ID).First(&session).Error; err != nil {
		response.Fail(c, "会话不存在", err)
		return
	}

	now := time.Now().UTC()
	correct := 0

	// 批量更新 session_words（替代逐行循环 UPDATE）
	rememberedIDs := make([]uint, 0, len(body.Results))
	forgotIDs := make([]uint, 0, len(body.Results))
	for _, r := range body.Results {
		if r.Remembered {
			rememberedIDs = append(rememberedIDs, r.WordID)
			correct++
		} else {
			forgotIDs = append(forgotIDs, r.WordID)
		}
	}
	t := true
	if len(rememberedIDs) > 0 {
		_ = db.Model(&models.SessionWord{}).
			Where("session_id = ? AND word_id IN ?", sessionID, rememberedIDs).
			Updates(map[string]any{"remembered": &t, "answered_at": &now}).Error
	}
	f := false
	if len(forgotIDs) > 0 {
		_ = db.Model(&models.SessionWord{}).
			Where("session_id = ? AND word_id IN ?", sessionID, forgotIDs).
			Updates(map[string]any{"remembered": &f, "answered_at": &now}).Error
	}

	// Use existing /review/submit logic for queue+state update
	// Build request and call handler function directly would require copying context;
	// so we re-run the core logic here by updating queue/state per word.
	//
	wordIDs := make([]uint, 0, len(body.Results))
	resMap := make(map[uint]bool, len(body.Results))
	for _, r := range body.Results {
		wordIDs = append(wordIDs, r.WordID)
		resMap[r.WordID] = r.Remembered
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		var items []models.ReviewQueue
		if err := tx.Where("user_id = ? AND word_id IN ? AND status IN ?", user.ID, wordIDs, []string{"pending", "in_session"}).Find(&items).Error; err != nil {
			return err
		}
		itemByWord := make(map[uint]models.ReviewQueue, len(items))
		for _, it := range items {
			itemByWord[it.WordID] = it
		}

		for _, wid := range wordIDs {
			it, ok := itemByWord[wid]
			if !ok {
				continue
			}
			remembered := resMap[wid]
			if remembered {
				newStage := it.Stage + 1
				if newStage >= len(models.EbbinghausIntervals) {
					if err := tx.Where("id = ?", it.ID).Delete(&models.ReviewQueue{}).Error; err != nil {
						return err
					}
					if err := tx.Model(&models.UserWordState{}).
						Where("user_id = ? AND word_id = ?", user.ID, wid).
						Updates(map[string]any{"learn_status": "mastered", "mastered_at": &now, "last_reviewed_at": &now, "next_review_at": nil, "review_stage": newStage}).Error; err != nil {
						return err
					}
					continue
				}

				due := now.AddDate(0, 0, models.EbbinghausIntervals[newStage])
				if err := tx.Model(&models.ReviewQueue{}).Where("id = ?", it.ID).
					Updates(map[string]any{"due_at": due, "stage": newStage, "status": "pending"}).Error; err != nil {
					return err
				}
				if err := tx.Model(&models.UserWordState{}).
					Where("user_id = ? AND word_id = ?", user.ID, wid).
					Updates(map[string]any{"last_reviewed_at": &now, "next_review_at": &due, "review_stage": newStage}).Error; err != nil {
					return err
				}
			} else {
				// ×：九宫格退一格；最快明天再到期，当天不再出现
				newStage := it.Stage - 1
				if newStage < 0 {
					newStage = 0
				}
				dueDays := 1
				if newStage < len(models.EbbinghausIntervals) && models.EbbinghausIntervals[newStage] > 1 {
					dueDays = models.EbbinghausIntervals[newStage]
				}
				due := now.AddDate(0, 0, dueDays)
				if err := tx.Model(&models.ReviewQueue{}).Where("id = ?", it.ID).
					Updates(map[string]any{"due_at": due, "stage": newStage, "status": "pending"}).Error; err != nil {
					return err
				}
				if err := tx.Model(&models.UserWordState{}).
					Where("user_id = ? AND word_id = ?", user.ID, wid).
					Updates(map[string]any{"last_reviewed_at": &now, "next_review_at": &due, "review_stage": newStage, "learn_status": "learning"}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		response.Fail(c, "提交失败", err)
		return
	}

	// 未提交的会话单词释放回 pending，当天仍可继续复习
	var sessionWordIDs []uint
	_ = db.Model(&models.SessionWord{}).Where("session_id = ?", sessionID).Pluck("word_id", &sessionWordIDs).Error
	if len(sessionWordIDs) > 0 {
		submitted := make(map[uint]bool, len(wordIDs))
		for _, id := range wordIDs {
			submitted[id] = true
		}
		releaseIDs := make([]uint, 0)
		for _, id := range sessionWordIDs {
			if !submitted[id] {
				releaseIDs = append(releaseIDs, id)
			}
		}
		if len(releaseIDs) > 0 {
			_ = db.Model(&models.ReviewQueue{}).
				Where("user_id = ? AND word_id IN ? AND status = ?", user.ID, releaseIDs, "in_session").
				Update("status", "pending").Error
		}
	}

	_ = db.Model(&session).Updates(map[string]any{"status": "completed", "completed_at": &now, "correct_count": correct}).Error
	invalidateLighthouseCacheForUser(user.ID)

	response.Success(c, "success", gin.H{"correctCount": correct, "totalCount": len(body.Results)})
}

// handleReviewSessionGet GET /review/session/:id
func (h *Handlers) handleReviewSessionGet(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	sessionID, _ := strconv.Atoi(c.Param("id"))
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	var session models.StudySession
	if err := db.Where("id = ? AND user_id = ?", sessionID, user.ID).First(&session).Error; err != nil {
		response.Fail(c, "会话不存在", err)
		return
	}

	var sessionWords []models.SessionWord
	_ = db.Where("session_id = ?", sessionID).Find(&sessionWords).Error

	wordIDs := make([]uint, 0, len(sessionWords))
	for _, sw := range sessionWords {
		wordIDs = append(wordIDs, sw.WordID)
	}
	var words []models.WordLite
	if len(wordIDs) > 0 {
		_ = db.Where("id IN ?", wordIDs).Find(&words).Error
	}

	response.Success(c, "success", gin.H{"session": session, "words": words})
}
