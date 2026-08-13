package handlers

import (
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

func (h *Handlers) handleStudyLighthouse(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	wordBookID, _ := strconv.Atoi(c.Query("wordBookId"))
	cacheKey := lighthouseCacheKey(user.ID, wordBookID)
	if cached, ok := getCachedLighthouse(cacheKey); ok {
		response.Success(c, "success", cached)
		return
	}

	payload := computeStudyLighthouse(db, user.ID, wordBookID)
	setCachedLighthouse(cacheKey, payload)
	response.Success(c, "success", payload)
}

// handleStudyLighthouseWords GET /study/lighthouse/words?wordBookId=N&step=01|pending|mastered
func (h *Handlers) handleStudyLighthouseWords(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	wordBookID, _ := strconv.Atoi(c.Query("wordBookId"))
	step := c.Query("step")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 50
	}

	// 构建状态过滤条件（不再 Pluck 全量 wordIDs，直接用 JOIN 分页查轻量字段）
	now := time.Now().UTC()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	endOfToday := startOfToday.Add(24 * time.Hour)

	var stateWhere string
	var stateArgs []any
	switch {
	case step == "today":
		stateWhere = "uws.user_id = ? AND uws.first_learned_at IS NOT NULL AND uws.first_learned_at >= ? AND uws.first_learned_at < ?"
		stateArgs = []any{user.ID, startOfToday, endOfToday}
	case step == "pending":
		stateWhere = "uws.user_id = ? AND uws.screen_result = ? AND uws.learn_status = ?"
		stateArgs = []any{user.ID, "unknown", "pending"}
	case step == "mastered":
		stateWhere = "uws.user_id = ? AND uws.learn_status = ?"
		stateArgs = []any{user.ID, "mastered"}
	default:
		stage, err := strconv.Atoi(step)
		if err != nil || stage < 1 || stage > 7 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "step 参数无效，应为 today、01-07、pending 或 mastered"})
			return
		}
		stateWhere = "uws.user_id = ? AND uws.learn_status IN ? AND uws.review_stage = ?"
		stateArgs = []any{user.ID, []string{"learning", "learned", "mastered"}, stage - 1}
	}
	if wordBookID > 0 {
		stateWhere += " AND uws.word_book_id = ?"
		stateArgs = append(stateArgs, uint(wordBookID))
	}

	// 先 COUNT 总数
	var total int64
	countSQL := "SELECT COUNT(*) FROM user_word_states uws WHERE " + stateWhere
	_ = db.Raw(countSQL, stateArgs...).Scan(&total).Error
	if total == 0 {
		response.Success(c, "success", gin.H{"words": []models.WordLite{}, "total": 0})
		return
	}

	// JOIN words 表分页查轻量字段（避免 Pluck 全量 ID + 二次查询）
	offset := (page - 1) * pageSize
	dataSQL := `SELECT w.id, w.word_book_id, w.word, w.phonetic, w.phonetic_uk, w.phonetic_us,
		w.translation, w.part_of_speech, w.definition, w.audio_url, w.sort_order
		FROM user_word_states uws
		JOIN words w ON w.id = uws.word_id AND w.is_deleted = 0
		WHERE ` + stateWhere + `
		ORDER BY w.sort_order ASC, w.id ASC
		LIMIT ? OFFSET ?`
	dataArgs := append(append(stateArgs, pageSize), offset)

	var words []models.WordLite
	if err := db.Raw(dataSQL, dataArgs...).Scan(&words).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}

	response.Success(c, "success", gin.H{
		"words": words,
		"total": total,
	})
}

func pad2(n int) string {
	if n < 10 {
		return "0" + strconv.Itoa(n)
	}
	return strconv.Itoa(n)
}

// handleStudyWords GET /study/words?wordBookId=N&page=1&pageSize=20&shuffle=0&seed=0
func (h *Handlers) handleStudyWords(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	wordBookID, _ := strconv.Atoi(c.Query("wordBookId"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	shuffleQ := strings.ToLower(strings.TrimSpace(c.DefaultQuery("shuffle", "0")))
	shuffle := shuffleQ == "1" || shuffleQ == "true" || shuffleQ == "yes"
	seed, _ := strconv.ParseInt(c.DefaultQuery("seed", "0"), 10, 64)

	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}
	if wordBookID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "wordBookId 必填"})
		return
	}

	// 确保分页参数合理
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	if shuffle && seed == 0 {
		seed = time.Now().UnixNano()
	}

	words, total, err := models.ListStudyWordsLite(db, uint(wordBookID), user.ID, page, pageSize, shuffle, seed)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}

	response.Success(c, "success", gin.H{
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"shuffle":  shuffle,
		"seed":     seed,
		"words":    words,
	})
}

// handleStudySessionStart POST /study/session/start
// body: { wordBookId, unknownIds: number[], knownIds?: number[], wordIds?: number[] }
func (h *Handlers) handleStudySessionStart(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	var body struct {
		WordBookID uint   `json:"wordBookId" binding:"required"`
		UnknownIDs []uint `json:"unknownIds"`
		KnownIDs   []uint `json:"knownIds"`
		WordIDs    []uint `json:"wordIds"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	unknownIDs := body.UnknownIDs
	if len(unknownIDs) == 0 && len(body.WordIDs) > 0 {
		unknownIDs = body.WordIDs
	}

	batchSize, _ := strconv.Atoi(c.DefaultQuery("batchSize", "20"))
	if batchSize <= 0 {
		batchSize = 20
	}
	if batchSize > 50 {
		batchSize = 50
	}

	// Ensure user selected wordbook
	now := time.Now().UTC()
	uwb := models.UserWordBook{UserID: user.ID, WordBookID: body.WordBookID}
	if err := db.Where(models.UserWordBook{UserID: user.ID, WordBookID: body.WordBookID}).
		Attrs(models.UserWordBook{Status: "active", StartedAt: &now}).
		FirstOrCreate(&uwb).Error; err != nil {
		response.Fail(c, "未选择该词库", err)
		return
	}

	// known -> learned (no queue)
	if len(body.KnownIDs) > 0 {
		states := make([]models.UserWordState, 0, len(body.KnownIDs))
		for _, wid := range body.KnownIDs {
			states = append(states, models.UserWordState{
				UserID:        user.ID,
				WordID:        wid,
				WordBookID:    body.WordBookID,
				ScreenResult:  "known",
				ScreenAt:      &now,
				LearnStatus:   "learned",
				FirstLearnedAt: &now,
			})
		}
		_ = db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "word_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"word_book_id", "screen_result", "screen_at", "learn_status", "first_learned_at"}),
		}).Create(&states).Error
	}

	// unknown -> pending (if client specified)
	if len(unknownIDs) > 0 {
		states := make([]models.UserWordState, 0, len(unknownIDs))
		for _, wid := range unknownIDs {
			states = append(states, models.UserWordState{
				UserID:       user.ID,
				WordID:       wid,
				WordBookID:   body.WordBookID,
				ScreenResult: "unknown",
				ScreenAt:     &now,
				LearnStatus:  "pending",
			})
		}
		_ = db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "word_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"word_book_id", "screen_result", "screen_at", "learn_status"}),
		}).Create(&states).Error
	}

	// Auto pick next batch if client did not specify IDs
	selectedIDs := unknownIDs
	if len(selectedIDs) == 0 {
		_ = db.Model(&models.UserWordState{}).
			Where("user_id = ? AND word_book_id = ? AND learn_status = ?", user.ID, body.WordBookID, "learning").
			Update("learn_status", "pending").Error

		var picked []models.UserWordState
		if err := db.Transaction(func(tx *gorm.DB) error {
			q := tx.Model(&models.UserWordState{}).
				Joins("JOIN words w ON w.id = user_word_states.word_id").
				Where("user_word_states.user_id = ? AND user_word_states.word_book_id = ? AND user_word_states.screen_result = ? AND user_word_states.learn_status = ?",
					user.ID, body.WordBookID, "unknown", "pending").
				Order("w.sort_order ASC, w.id ASC").
				Limit(batchSize)
			if err := q.Clauses(clause.Locking{Strength: "UPDATE"}).Find(&picked).Error; err != nil {
				return err
			}
			if len(picked) == 0 {
				return nil
			}
			ids := make([]uint, 0, len(picked))
			for _, s := range picked {
				ids = append(ids, s.WordID)
			}
			return tx.Model(&models.UserWordState{}).
				Where("user_id = ? AND word_id IN ?", user.ID, ids).
				Update("learn_status", "learning").Error
		}); err != nil {
			response.Fail(c, "取题失败", err)
			return
		}
		for _, s := range picked {
			selectedIDs = append(selectedIDs, s.WordID)
		}
	}

	if len(selectedIDs) == 0 {
		response.Success(c, "今日无待背单词", gin.H{"finished": true})
		return
	}

	// Create session
	session := models.StudySession{
		UserID:      user.ID,
		WordBookID:  body.WordBookID,
		SessionType: "learn",
		Status:      "in_progress",
		StartedAt:   now,
		WordCount:   len(selectedIDs),
	}
	if err := db.Create(&session).Error; err != nil {
		response.Fail(c, "创建会话失败", err)
		return
	}

	// session_words
	sw := make([]models.SessionWord, 0, len(selectedIDs))
	for _, wid := range selectedIDs {
		sw = append(sw, models.SessionWord{SessionID: session.ID, WordID: wid})
	}
	_ = db.Create(&sw).Error

	// If client explicitly provided ids, mark them learning now
	if len(unknownIDs) > 0 {
		_ = db.Model(&models.UserWordState{}).
			Where("user_id = ? AND word_id IN ?", user.ID, selectedIDs).
			Update("learn_status", "learning").Error
	}

	var words []models.WordLite
	_ = db.Where("id IN ?", selectedIDs).Find(&words).Error

	response.Success(c, "success", gin.H{
		"sessionId": session.ID,
		"words":     words,
	})
}

// handleStudySessionComplete POST /study/session/:id/complete
// body: { results: [{wordId, remembered: bool}] }
func (h *Handlers) handleStudySessionComplete(c *gin.Context) {
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
	rememberedIDs := make([]uint, 0)
	forgotIDs := make([]uint, 0)
	for _, r := range body.Results {
		if r.Remembered {
			rememberedIDs = append(rememberedIDs, r.WordID)
		} else {
			forgotIDs = append(forgotIDs, r.WordID)
		}
	}

	if len(rememberedIDs) > 0 {
		t := true
		_ = db.Model(&models.SessionWord{}).
			Where("session_id = ? AND word_id IN ?", sessionID, rememberedIDs).
			Updates(map[string]any{"remembered": &t, "answered_at": &now}).Error
	}
	if len(forgotIDs) > 0 {
		f := false
		_ = db.Model(&models.SessionWord{}).
			Where("session_id = ? AND word_id IN ?", sessionID, forgotIDs).
			Updates(map[string]any{"remembered": &f, "answered_at": &now}).Error
	}

	// remembered -> learned + enqueue stage=0 due=now
	if len(rememberedIDs) > 0 {
		queueItems := make([]models.ReviewQueue, 0, len(rememberedIDs))
		for _, wid := range rememberedIDs {
			queueItems = append(queueItems, models.ReviewQueue{
				UserID:     user.ID,
				WordID:     wid,
				WordBookID: session.WordBookID,
				DueAt:      now,
				Stage:      0,
				Status:     "pending",
			})
		}
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "word_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"word_book_id", "due_at", "stage", "status"}),
		}).Create(&queueItems).Error; err != nil {
			response.Fail(c, "写入复习队列失败", err)
			return
		}

		due := now
		if err := db.Model(&models.UserWordState{}).
			Where("user_id = ? AND word_id IN ?", user.ID, rememberedIDs).
			Updates(map[string]any{"learn_status": "learned", "first_learned_at": &now, "review_stage": 0, "next_review_at": &due}).Error; err != nil {
			response.Fail(c, "更新学习状态失败", err)
			return
		}
	}

	// forgot -> pending
	if len(forgotIDs) > 0 {
		_ = db.Model(&models.UserWordState{}).
			Where("user_id = ? AND word_id IN ?", user.ID, forgotIDs).
			Update("learn_status", "pending").Error
	}

	correctCount := len(rememberedIDs)
	_ = db.Model(&session).Updates(map[string]any{"status": "completed", "completed_at": &now, "correct_count": correctCount}).Error
	invalidateLighthouseCacheForUser(user.ID)

	var remainCount int64
	_ = db.Model(&models.UserWordState{}).
		Where("user_id = ? AND word_book_id = ? AND screen_result = ? AND learn_status = ?", user.ID, session.WordBookID, "unknown", "pending").
		Count(&remainCount).Error

	response.Success(c, "success", gin.H{
		"correctCount": correctCount,
		"totalCount":   len(body.Results),
		"hasMore":      remainCount > 0,
		"remainCount":  remainCount,
	})
}

// handleStudySessionGet GET /study/session/:id
func (h *Handlers) handleStudySessionGet(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	sessionID, _ := strconv.Atoi(c.Param("id"))
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	var session models.StudySession
	if err := db.Where("id = ?", sessionID).First(&session).Error; err != nil {
		response.Fail(c, "会话不存在", err)
		return
	}

	// 本人或绑定师生关系的老师可查看
	if session.UserID != user.ID {
		tid := coachingCoachingTeacherID(c)
		if tid == 0 || coachingTeacherHasStudentPair(db, tid, session.UserID) != nil {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "无权查看该会话"})
			return
		}
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

	response.Success(c, "success", gin.H{
		"session": session,
		"words":   words,
	})
}

// handleStudySessionsList GET /study/sessions
// query: page, pageSize, sessionType, studentId(老师查学员), date / dateFrom / dateTo (YYYY-MM-DD),
//        wordBookId, status(completed|in_progress), groupBy(bookDay=按词库+日聚合)
func (h *Handlers) handleStudySessionsList(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	sessionType := c.Query("sessionType") // "learn"|"study"(正课) | "review" | "" (all)
	if sessionType == "study" {
		sessionType = "learn" // 前端正课 tab 用 study，库里存 learn
	}

	targetUserID := user.ID
	if sidStr := strings.TrimSpace(c.Query("studentId")); sidStr != "" {
		sid64, err := strconv.ParseUint(sidStr, 10, 64)
		if err != nil || sid64 == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学员 ID 无效"})
			return
		}
		sid := uint(sid64)
		tid := coachingCoachingTeacherID(c)
		if tid == 0 {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "仅老师可查看学员记录"})
			return
		}
		if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
			return
		}
		// 正课会话记在老师账号：studentId 仅做权限校验
		_ = sid
		targetUserID = user.ID
	}

	q := db.Model(&models.StudySession{}).Where("user_id = ?", targetUserID)
	if sessionType != "" {
		q = q.Where("session_type = ?", sessionType)
	}
	if wbID, err := strconv.Atoi(c.Query("wordBookId")); err == nil && wbID > 0 {
		q = q.Where("word_book_id = ?", wbID)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		q = q.Where("status = ?", status)
	}

	// 日期筛选：优先 date（单日），否则 dateFrom / dateTo
	dateOnly := strings.TrimSpace(c.Query("date"))
	dateFrom := strings.TrimSpace(c.Query("dateFrom"))
	dateTo := strings.TrimSpace(c.Query("dateTo"))
	if dateOnly != "" {
		dateFrom, dateTo = dateOnly, dateOnly
	}
	if dateFrom != "" {
		if t, err := time.ParseInLocation("2006-01-02", dateFrom, time.Local); err == nil {
			q = q.Where("started_at >= ?", t)
		}
	}
	if dateTo != "" {
		if t, err := time.ParseInLocation("2006-01-02", dateTo, time.Local); err == nil {
			q = q.Where("started_at < ?", t.Add(24*time.Hour))
		}
	}

	// 按「词库 + 上课日」聚合，避免同课多次开练刷屏
	if strings.TrimSpace(c.Query("groupBy")) == "bookDay" {
		type groupRow struct {
			WordBookID   uint      `gorm:"column:word_book_id"`
			Day          string    `gorm:"column:day"`
			SessionCount int64     `gorm:"column:session_count"`
			WordCount    int64     `gorm:"column:word_count"`
			CorrectCount int64     `gorm:"column:correct_count"`
			LatestAt     time.Time `gorm:"column:latest_at"`
			SessionIDs   string    `gorm:"column:session_ids"`
		}

		countQ := q.Session(&gorm.Session{})
		var total int64
		_ = db.Table("(?) AS g", countQ.Select("word_book_id, DATE(started_at) AS d").Group("word_book_id, DATE(started_at)")).
			Count(&total).Error

		var rows []groupRow
		if err := q.Select(`
			word_book_id,
			DATE(started_at) AS day,
			COUNT(*) AS session_count,
			COALESCE(SUM(word_count), 0) AS word_count,
			COALESCE(SUM(correct_count), 0) AS correct_count,
			MAX(started_at) AS latest_at,
			GROUP_CONCAT(id ORDER BY started_at DESC, id DESC) AS session_ids
		`).Group("word_book_id, DATE(started_at)").
			Order("MAX(started_at) DESC").
			Offset((page - 1) * pageSize).
			Limit(pageSize).
			Scan(&rows).Error; err != nil {
			response.Fail(c, "查询失败", err)
			return
		}

		wbIDs := make([]uint, 0, len(rows))
		for _, r := range rows {
			if r.WordBookID > 0 {
				wbIDs = append(wbIDs, r.WordBookID)
			}
		}
		wbNames := make(map[uint]string, len(wbIDs))
		if len(wbIDs) > 0 {
			var books []models.WordBook
			_ = db.Where("id IN ?", wbIDs).Find(&books).Error
			for _, b := range books {
				wbNames[b.ID] = b.Name
			}
		}

		list := make([]gin.H, 0, len(rows))
		for _, r := range rows {
			ids := make([]uint, 0)
			for _, p := range strings.Split(r.SessionIDs, ",") {
				p = strings.TrimSpace(p)
				if p == "" {
					continue
				}
				if id64, err := strconv.ParseUint(p, 10, 64); err == nil && id64 > 0 {
					ids = append(ids, uint(id64))
				}
			}
			day := strings.TrimSpace(r.Day)
			if len(day) >= 10 {
				day = day[:10]
			}
			list = append(list, gin.H{
				"wordBookId":   r.WordBookID,
				"wordBookName": wbNames[r.WordBookID],
				"day":          day,
				"sessionCount": r.SessionCount,
				"wordCount":    r.WordCount,
				"correctCount": r.CorrectCount,
				"latestAt":     r.LatestAt,
				"sessionIds":   ids,
				"sessionType":  sessionType,
				"status":       "grouped",
			})
		}

		response.Success(c, "success", gin.H{
			"list":     list,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
			"grouped":  true,
		})
		return
	}

	var total int64
	_ = q.Count(&total).Error

	var sessions []models.StudySession
	if err := q.Order("created_at DESC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&sessions).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}

	// 附上词书名
	wbIDs := make([]uint, 0, len(sessions))
	for _, s := range sessions {
		if s.WordBookID > 0 {
			wbIDs = append(wbIDs, s.WordBookID)
		}
	}
	wbNames := make(map[uint]string, len(wbIDs))
	if len(wbIDs) > 0 {
		var books []models.WordBook
		_ = db.Where("id IN ?", wbIDs).Find(&books).Error
		for _, b := range books {
			wbNames[b.ID] = b.Name
		}
	}

	list := make([]gin.H, 0, len(sessions))
	for _, s := range sessions {
		list = append(list, gin.H{
			"id":           s.ID,
			"sessionType":  s.SessionType,
			"status":       s.Status,
			"startedAt":    s.StartedAt,
			"completedAt":  s.CompletedAt,
			"wordCount":    s.WordCount,
			"correctCount": s.CorrectCount,
			"wordBookId":   s.WordBookID,
			"wordBookName": wbNames[s.WordBookID],
			"userId":       s.UserID,
		})
	}

	response.Success(c, "success", gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// handleStudySessionsExportWords GET /study/sessions/export-words
// 一次返回筛选条件下去重后的单词（英文 / 音标 / 中文释义），供导出。
func (h *Handlers) handleStudySessionsExportWords(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	sessionType := c.Query("sessionType")
	if sessionType == "study" {
		sessionType = "learn"
	}
	targetUserID := user.ID
	if sidStr := strings.TrimSpace(c.Query("studentId")); sidStr != "" {
		sid64, err := strconv.ParseUint(sidStr, 10, 64)
		if err != nil || sid64 == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学员 ID 无效"})
			return
		}
		sid := uint(sid64)
		tid := coachingCoachingTeacherID(c)
		if tid == 0 {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "仅老师可查看学员记录"})
			return
		}
		if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
			return
		}
		// 正课会话目前记在老师账号；传 studentId 仅做权限校验，仍导出老师侧会话词
		_ = sid
		targetUserID = user.ID
	}

	q := db.Model(&models.StudySession{}).Where("user_id = ?", targetUserID)
	if sessionType != "" {
		q = q.Where("session_type = ?", sessionType)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		q = q.Where("status = ?", status)
	}
	if wbID, err := strconv.Atoi(c.Query("wordBookId")); err == nil && wbID > 0 {
		q = q.Where("word_book_id = ?", wbID)
	}

	dateOnly := strings.TrimSpace(c.Query("date"))
	dateFrom := strings.TrimSpace(c.Query("dateFrom"))
	dateTo := strings.TrimSpace(c.Query("dateTo"))
	if dateOnly != "" {
		dateFrom, dateTo = dateOnly, dateOnly
	}
	if dateFrom != "" {
		if t, err := time.ParseInLocation("2006-01-02", dateFrom, time.Local); err == nil {
			q = q.Where("started_at >= ?", t)
		}
	}
	if dateTo != "" {
		if t, err := time.ParseInLocation("2006-01-02", dateTo, time.Local); err == nil {
			q = q.Where("started_at < ?", t.Add(24*time.Hour))
		}
	}

	var sessionIDs []uint
	if err := q.Order("id DESC").Limit(500).Pluck("id", &sessionIDs).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	if len(sessionIDs) == 0 {
		response.Success(c, "success", gin.H{"words": []any{}, "total": 0})
		return
	}

	type exportRow struct {
		ID           uint   `json:"id" gorm:"column:id"`
		Word         string `json:"word" gorm:"column:word"`
		Phonetic     string `json:"phonetic" gorm:"column:phonetic"`
		PhoneticUK   string `json:"phoneticUk" gorm:"column:phonetic_uk"`
		PhoneticUS   string `json:"phoneticUs" gorm:"column:phonetic_us"`
		Translation  string `json:"translation" gorm:"column:translation"`
		PartOfSpeech string `json:"partOfSpeech" gorm:"column:part_of_speech"`
		AudioURL     string `json:"audioUrl" gorm:"column:audio_url"`
	}

	var rows []exportRow
	err := db.Raw(`
		SELECT w.id, w.word, w.phonetic, w.phonetic_uk, w.phonetic_us, w.translation, w.part_of_speech, w.audio_url
		FROM session_words sw
		JOIN words w ON w.id = sw.word_id
		WHERE sw.session_id IN ?
		GROUP BY w.id, w.word, w.phonetic, w.phonetic_uk, w.phonetic_us, w.translation, w.part_of_speech, w.audio_url
		ORDER BY w.word ASC
	`, sessionIDs).Scan(&rows).Error
	if err != nil {
		response.Fail(c, "导出查询失败", err)
		return
	}

	response.Success(c, "success", gin.H{
		"words": rows,
		"total": len(rows),
	})
}
