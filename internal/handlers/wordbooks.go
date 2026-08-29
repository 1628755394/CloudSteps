package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	CloudStepsGo "github.com/LingByte/CloudStepsGo"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/audio"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// adminWordPayload 管理端创建/批量导入单词时的可写字段（不含学习进度类字段）
type adminWordPayload struct {
	Word             string `json:"word" binding:"required"`
	Phonetic         string `json:"phonetic"`
	PhoneticUS       string `json:"phoneticUs"`
	PhoneticUK       string `json:"phoneticUk"`
	Lemma            string `json:"lemma"`
	Translation      string `json:"translation"`
	TranslationShort string `json:"translationShort"`
	ExampleSentence  string `json:"exampleSentence"`
	ExampleSentences string `json:"exampleSentences"`
	AudioURL         string `json:"audioUrl"`
	ImageURL         string `json:"imageUrl"`
	VideoURL         string `json:"videoUrl"`
	Difficulty       int8   `json:"difficulty"`
	SortOrder        int    `json:"sortOrder"`
	PartOfSpeech     string `json:"partOfSpeech"`
	Definition       string `json:"definition"`
	Synonyms         string `json:"synonyms"`
	Antonyms         string `json:"antonyms"`
	WordFamily       string `json:"wordFamily"`
	Collocations     string `json:"collocations"`
	Frequency        int8   `json:"frequency"`
	Importance       int8   `json:"importance"`
	Tags             string `json:"tags"`
	Notes            string `json:"notes"`
	Syllables        string `json:"syllables"`
	StressPattern    string `json:"stressPattern"`
	CEFRLevel        string `json:"cefrLevel"`
	Register         string `json:"register"`
	Etymology        string `json:"etymology"`
	Morphology       string `json:"morphology"`
	Derivations      string `json:"derivations"`
	Mnemonic         string `json:"mnemonic"`
	Homophones       string `json:"homophones"`
	UsageNotes       string `json:"usageNotes"`
	GrammarPatterns  string `json:"grammarPatterns"`
}

func (p adminWordPayload) toWord(bookID uint) models.Word {
	diff := p.Difficulty
	if diff < 1 || diff > 5 {
		diff = 1
	}
	freq := p.Frequency
	if freq < 1 || freq > 5 {
		freq = 1
	}
	imp := p.Importance
	if imp < 1 || imp > 5 {
		imp = 1
	}
	return models.Word{
		WordBookID:       bookID,
		Word:             p.Word,
		Phonetic:         p.Phonetic,
		PhoneticUS:       p.PhoneticUS,
		PhoneticUK:       p.PhoneticUK,
		Lemma:            p.Lemma,
		Translation:      p.Translation,
		TranslationShort: p.TranslationShort,
		ExampleSentence:  p.ExampleSentence,
		ExampleSentences: p.ExampleSentences,
		AudioURL:         audio.DeduplicateSlots(p.AudioURL),
		ImageURL:         p.ImageURL,
		VideoURL:         p.VideoURL,
		Difficulty:       diff,
		SortOrder:        p.SortOrder,
		PartOfSpeech:     p.PartOfSpeech,
		Definition:       p.Definition,
		Synonyms:         p.Synonyms,
		Antonyms:         p.Antonyms,
		WordFamily:       p.WordFamily,
		Collocations:     p.Collocations,
		Frequency:        freq,
		Importance:       imp,
		Tags:             p.Tags,
		Notes:            p.Notes,
		Syllables:        p.Syllables,
		StressPattern:    p.StressPattern,
		CEFRLevel:        p.CEFRLevel,
		Register:         p.Register,
		Etymology:        p.Etymology,
		Morphology:       p.Morphology,
		Derivations:      p.Derivations,
		Mnemonic:         p.Mnemonic,
		Homophones:       p.Homophones,
		UsageNotes:       p.UsageNotes,
		GrammarPatterns:  p.GrammarPatterns,
	}
}

func (h *Handlers) registerWordBookRoutes(r *gin.RouterGroup) {
	wb := r.Group("wordbooks")
	wb.Use(models.AuthRequired)
	{
		wb.GET("", h.handleListWordBooks)
		h.registerCustomWordBookRoutes(wb)
		wb.GET("/:id/words", h.handleListWordBookWords)
		// 管理员或自定义词书所有者可改删单词（同路径，鉴权在 handler 内）
		wb.PUT("/:id/words/:wid", h.handleUpdateWordBookWord)
		wb.DELETE("/:id/words/:wid", h.handleDeleteWordBookWord)
		wb.GET("/:id", h.handleGetWordBook)
		wb.POST("/:id/select", h.handleSelectWordBook)
		wb.GET("/:id/progress", h.handleGetWordBookProgress)
		wb.GET("/:id/screen/next", h.handleScreenNext)
		wb.POST("/:id/screen/submit", h.handleScreenSubmit)
		wb.GET("/:id/screen/status", h.handleScreenStatus)

		admin := wb.Group("")
		admin.Use(h.requireAdmin)
		{
			admin.GET("/list", h.adminListWordBooks)
			admin.GET("/batch-audio/jobs", h.adminListWordBookBatchAudioJobs)
			admin.POST("/:id/recount-count", h.adminRecountWordBookCount)
			admin.GET("/cover-ai/defaults", h.adminWordBookCoverDefaults)
			admin.GET("/cover-ai/jobs", h.adminListWordBookCoverJobs)
			admin.POST("/cover-ai/test", h.adminWordBookCoverTest)
			admin.POST("/:id/generate-cover", h.adminStartWordBookCover)
			admin.GET("/:id/generate-cover", h.adminWordBookCoverStatus)
			admin.POST("/:id/generate-cover/save", h.adminSaveWordBookCover)
			admin.POST("/:id/generate-cover/clear", h.adminClearWordBookCover)
			admin.POST("", h.adminCreateWordBook)
			admin.PUT("/:id", h.adminUpdateWordBook)
			admin.DELETE("/:id", h.adminDeleteWordBook)
			// 与登录用户浏览 GET /wordbooks/:id/words 区分，避免同路径被 requireAdmin 覆盖
			admin.GET("/:id/managed-words", h.adminListWords)
			admin.POST("/:id/words", h.adminCreateWord)
			admin.POST("/:id/words/check", h.adminCheckWords)
			admin.POST("/:id/words/batch", h.adminBatchCreateWords)
			admin.POST("/:id/words/deduplicate-audio", h.adminDeduplicateWordBookAudio)
			admin.POST("/:id/words/purge-all-audio", h.adminPurgeWordBookAudio)
			admin.GET("/:id/words/purge-all-audio", h.adminPurgeWordBookAudioStatus)
			admin.POST("/:id/words/batch-audio", h.adminBatchWordBookAudio)
			admin.GET("/:id/words/batch-audio", h.adminBatchWordBookAudioStatus)
			admin.POST("/:id/words/batch-audio/stop", h.adminBatchWordBookAudioStop)
		}
	}

	// 单词详情（按 word ID 查询完整词典数据）
	words := r.Group("words")
	words.Use(models.AuthRequired)
	{
		words.GET("/:id/user-word", h.handleGetMyUserWord)
		words.PUT("/:id/user-word", h.handleUpsertMyUserWord)
		words.DELETE("/:id/user-word", h.handleDeleteMyUserWord)
		words.GET("/:id", h.handleGetWordDetail)
	}
}

func (h *Handlers) handleListWordBooks(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	level := c.Query("level")
	keyword := strings.TrimSpace(c.Query("keyword"))
	category := c.Query("category")
	group := c.Query("group")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 1000 {
		pageSize = 20
	}

	var ownerUID uint
	if u := models.CurrentUser(c); u != nil {
		ownerUID = u.ID
	}

	books, total, err := models.ListWordBooksWithSearch(db, keyword, level, category, group, true, page, pageSize, ownerUID)
	if err != nil {
		response.Fail(c, "获取词库列表失败", err)
		return
	}

	response.SuccessMsg(c, "success", gin.H{
		"list":     books,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"groups":   models.GroupNames(),
	})
}

func (h *Handlers) handleGetWordBook(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	book, err := models.GetWordBookByID(db, uint(id))
	if err != nil {
		response.Fail(c, "词库不存在", err)
		return
	}
	if book.OwnerUserID > 0 {
		u := models.CurrentUser(c)
		if u == nil || u.ID != book.OwnerUserID {
			response.Fail(c, "无权访问该词库", nil)
			return
		}
	}
	response.SuccessMsg(c, "success", book)
}

// handleGetWordDetail GET /words/:id — 返回单个单词的完整词典数据
func (h *Handlers) handleGetWordDetail(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "单词 ID 无效"})
		return
	}
	var word models.Word
	if err := db.Where("id = ? AND is_deleted = 0", id).First(&word).Error; err != nil {
		response.Fail(c, "单词不存在", err)
		return
	}
	overlayCurrentUserWord(c, db, &word)
	response.SuccessMsg(c, "success", word)
}

// handleListWordBookWords GET /wordbooks/:id/words?page=&pageSize=&keyword=
// 登录用户浏览词库单词（不含管理端编辑能力）
func (h *Handlers) handleListWordBookWords(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "词库 ID 无效"})
		return
	}
	book, err := models.GetWordBookByID(db, uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "词库不存在"})
		return
	}
	if book.OwnerUserID > 0 {
		u := models.CurrentUser(c)
		if u == nil || u.ID != book.OwnerUserID {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "无权访问该词库"})
			return
		}
	}
	if !book.IsActive {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "词库已下架"})
		return
	}
	page := 1
	pageSize := 30
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if s := c.Query("pageSize"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 && v <= 100 {
			pageSize = v
		}
	}
	keyword := strings.TrimSpace(c.Query("keyword"))
	words, total, err := models.ListWordsLite(db, uint(id), keyword, page, pageSize)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	overlayCurrentUserWordLites(c, db, words)
	response.SuccessMsg(c, "success", gin.H{
		"list":     words,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *Handlers) handleSelectWordBook(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	if _, err := models.GetWordBookByID(db, uint(id)); err != nil {
		response.Fail(c, "词库不存在", err)
		return
	}

	now := time.Now().UTC()
	uwb := models.UserWordBook{UserID: user.ID, WordBookID: uint(id)}
	if err := db.Where(models.UserWordBook{UserID: user.ID, WordBookID: uint(id)}).
		Attrs(models.UserWordBook{Status: "active", StartedAt: &now}).
		FirstOrCreate(&uwb).Error; err != nil {
		response.Fail(c, "选择词库失败", err)
		return
	}

	// 懒初始化：不再为词库每个单词批量创建 UserWordState（大词库几千条 INSERT 很慢）
	// 筛词时按需创建状态记录，学习时也按需创建
	// ScreenProgress=0 表示从头开始筛词，不需要预创建任何状态

	response.SuccessMsg(c, "success", uwb)
}

func (h *Handlers) handleGetWordBookProgress(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	var uwb models.UserWordBook
	if err := db.Where("user_id = ? AND word_book_id = ?", user.ID, id).First(&uwb).Error; err != nil {
		response.Fail(c, "未选择该词库", err)
		return
	}

	// 使用 word_books.word_count 冗余字段，避免对 words 表 COUNT(*)
	totalWords, _ := models.GetWordCountByBookID(db, uint(id))

	var unknownCount int64
	_ = db.Model(&models.UserWordState{}).
		Where("user_id = ? AND word_book_id = ? AND screen_result = ?", user.ID, id, "unknown").
		Count(&unknownCount).Error

	var learnedCount int64
	_ = db.Model(&models.UserWordState{}).
		Where("user_id = ? AND word_book_id = ? AND learn_status IN ?", user.ID, id, []string{"learned", "mastered"}).
		Count(&learnedCount).Error

	response.SuccessMsg(c, "success", gin.H{
		"userWordBook":     uwb,
		"totalWords":       totalWords,
		"screenProgress":   uwb.ScreenProgress,
		"unknownCount":     unknownCount,
		"learnedCount":     learnedCount,
		"canStartLearning": uwb.ScreenCompleted,
	})
}

func (h *Handlers) handleScreenNext(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	var uwb models.UserWordBook
	if err := db.Where("user_id = ? AND word_book_id = ?", user.ID, id).First(&uwb).Error; err != nil {
		response.Fail(c, "未选择该词库", err)
		return
	}
	if uwb.ScreenCompleted {
		response.SuccessMsg(c, "筛词已完成", gin.H{"completed": true})
		return
	}

	// 游标分页：用 ScreenProgress 作为已筛数量，通过 LIMIT + OFFSET 1 获取下一条
	// 对于大词库，这里仍用 Offset 但只取 1 条，MySQL 会利用索引快速定位
	var word models.Word
	err := db.Where("word_book_id = ? AND is_deleted = ?", id, models.SoftDeleteStatusActive).
		Order("sort_order ASC, id ASC").
		Offset(uwb.ScreenProgress).
		Limit(1).
		First(&word).Error
	if err != nil {
		_ = db.Model(&uwb).Updates(map[string]any{"screen_completed": true}).Error
		response.SuccessMsg(c, "筛词已完成", gin.H{"completed": true})
		return
	}
	models.OverlayWord(db, user.ID, &word)

	// 使用 word_books.word_count 冗余字段
	totalWords, _ := models.GetWordCountByBookID(db, uint(id))

	response.SuccessMsg(c, "success", gin.H{
		"word":      word,
		"screened":  uwb.ScreenProgress,
		"total":     totalWords,
		"completed": false,
	})
}

func (h *Handlers) handleScreenSubmit(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	var body struct {
		WordID uint   `json:"wordId" binding:"required"`
		Result string `json:"result" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		CloudStepsGo.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	now := time.Now().UTC()
	// 懒创建：筛词时按需创建/更新 UserWordState（不再依赖预创建的批量记录）
	state := models.UserWordState{
		UserID:       user.ID,
		WordID:       body.WordID,
		WordBookID:   uint(id),
		ScreenResult: body.Result,
		ScreenAt:     &now,
		LearnStatus:  "pending",
	}
	if err := db.Where(models.UserWordState{UserID: user.ID, WordID: body.WordID}).
		Assign(models.UserWordState{ScreenResult: body.Result, ScreenAt: &now, WordBookID: uint(id)}).
		FirstOrCreate(&state).Error; err != nil {
		response.Fail(c, "保存筛词结果失败", err)
		return
	}

	var uwb models.UserWordBook
	if err := db.Where("user_id = ? AND word_book_id = ?", user.ID, id).First(&uwb).Error; err != nil {
		response.Fail(c, "未选择该词库", err)
		return
	}
	newProgress := uwb.ScreenProgress + 1

	// 使用 word_books.word_count 冗余字段
	totalWords, _ := models.GetWordCountByBookID(db, uint(id))
	screenCompleted := int64(newProgress) >= totalWords

	_ = db.Model(&uwb).Updates(map[string]any{"screen_progress": newProgress, "screen_completed": screenCompleted}).Error

	var unknownCount int64
	_ = db.Model(&models.UserWordState{}).
		Where("user_id = ? AND word_book_id = ? AND screen_result = ?", user.ID, id, "unknown").
		Count(&unknownCount).Error
	var knownCount int64
	_ = db.Model(&models.UserWordState{}).
		Where("user_id = ? AND word_book_id = ? AND screen_result = ?", user.ID, id, "known").
		Count(&knownCount).Error

	response.SuccessMsg(c, "success", gin.H{
		"unknownCount":     unknownCount,
		"knownCount":       knownCount,
		"screened":         newProgress,
		"total":            totalWords,
		"screenCompleted":  screenCompleted,
		"canStartLearning": screenCompleted,
	})
}

func (h *Handlers) handleScreenStatus(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "authorization required"})
		return
	}

	var uwb models.UserWordBook
	if err := db.Where("user_id = ? AND word_book_id = ?", user.ID, id).First(&uwb).Error; err != nil {
		response.Fail(c, "未选择该词库", err)
		return
	}

	var unknownCount int64
	_ = db.Model(&models.UserWordState{}).
		Where("user_id = ? AND word_book_id = ? AND screen_result = ?", user.ID, id, "unknown").
		Count(&unknownCount).Error
	var knownCount int64
	_ = db.Model(&models.UserWordState{}).
		Where("user_id = ? AND word_book_id = ? AND screen_result = ?", user.ID, id, "known").
		Count(&knownCount).Error
	// 使用 word_books.word_count 冗余字段
	totalWords, _ := models.GetWordCountByBookID(db, uint(id))

	response.SuccessMsg(c, "success", gin.H{
		"screened":         uwb.ScreenProgress,
		"total":            totalWords,
		"screenCompleted":  uwb.ScreenCompleted,
		"unknownCount":     unknownCount,
		"knownCount":       knownCount,
		"canStartLearning": uwb.ScreenCompleted,
	})
}

func (h *Handlers) adminListWordBooks(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 1000 {
		pageSize = 20
	}
	keyword := strings.TrimSpace(c.Query("keyword"))
	level := c.Query("level")
	isActiveQuery := c.Query("isActive")
	group := c.Query("group")
	sourceName := strings.TrimSpace(c.Query("sourceName"))

	q := db.Model(&models.WordBook{}).
		Where("is_deleted = ?", models.SoftDeleteStatusActive).
		Order("sort_order ASC, id DESC")
	if keyword != "" {
		q = q.Where("name LIKE ?", "%"+keyword+"%")
	}
	if level != "" {
		q = q.Where("level = ?", level)
	}
	switch isActiveQuery {
	case "true":
		q = q.Where("is_active = ?", true)
	case "false":
		q = q.Where("is_active = ?", false)
	}
	if group != "" {
		patterns := models.GroupPatterns(group)
		if len(patterns) > 0 {
			orClauses := make([]string, len(patterns))
			args := make([]interface{}, len(patterns))
			for i, p := range patterns {
				orClauses[i] = "name LIKE ?"
				args[i] = "%" + p + "%"
			}
			q = q.Where(strings.Join(orClauses, " OR "), args...)
		}
	}
	if sourceName != "" {
		q = q.Where("source_name = ?", sourceName)
	}
	if c.Query("hasCover") == "true" {
		q = q.Where("cover_url IS NOT NULL AND cover_url != ''")
	}

	var total int64
	q.Count(&total)
	var books []models.WordBook
	q.Offset((page - 1) * pageSize).Limit(pageSize).Find(&books)

	var sources []string
	db.Model(&models.WordBook{}).
		Where("source_name IS NOT NULL AND source_name != ''").
		Distinct().
		Order("source_name ASC").
		Pluck("source_name", &sources)

	response.SuccessMsg(c, "success", gin.H{
		"list":     books,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"groups":   models.GroupNames(),
		"sources":  sources,
	})
}

func (h *Handlers) adminRecountWordBookCount(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	bookID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || bookID == 0 {
		CloudStepsGo.AbortWithJSONError(c, http.StatusBadRequest, errors.New("invalid word book id"))
		return
	}
	var book models.WordBook
	if err := db.Where("id = ? AND is_deleted = ?", bookID, models.SoftDeleteStatusActive).First(&book).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Fail(c, "词库不存在", nil)
		} else {
			response.Fail(c, "查询词库失败", err)
		}
		return
	}
	if err := models.SyncWordBookCount(db, uint(bookID)); err != nil {
		response.Fail(c, "重新计算失败", err)
		return
	}
	if err := db.Select("word_count").First(&book, bookID).Error; err != nil {
		response.Fail(c, "查询词数失败", err)
		return
	}
	response.SuccessMsg(c, fmt.Sprintf("已重新计算词数：%d 词", book.WordCount), gin.H{
		"wordCount": book.WordCount,
	})
}

func (h *Handlers) adminCreateWordBook(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	var body struct {
		Name            string `json:"name" binding:"required"`
		Description     string `json:"description"`
		Level           string `json:"level"`
		CoverURL        string `json:"coverUrl"`
		IsActive        *bool  `json:"isActive"`
		SortOrder       int    `json:"sortOrder"`
		ExamTags        string `json:"examTags"`
		CEFRRange       string `json:"cefrRange"`
		RegionalVariant string `json:"regionalVariant"`
		SourceName      string `json:"sourceName"`
		SourceURL       string `json:"sourceUrl"`
		LicenseNote     string `json:"licenseNote"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		CloudStepsGo.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}
	isActive := true
	if body.IsActive != nil {
		isActive = *body.IsActive
	}
	book := models.WordBook{
		Name:            body.Name,
		Description:     body.Description,
		Level:           body.Level,
		CoverURL:        body.CoverURL,
		IsActive:        isActive,
		SortOrder:       body.SortOrder,
		ExamTags:        body.ExamTags,
		CEFRRange:       body.CEFRRange,
		RegionalVariant: body.RegionalVariant,
		SourceName:      body.SourceName,
		SourceURL:       body.SourceURL,
		LicenseNote:     body.LicenseNote,
	}
	if user != nil {
		operator := user.DisplayName
		if operator == "" {
			operator = user.Username
		}
		if operator == "" {
			operator = fmt.Sprintf("%d", user.ID)
		}
		book.SetCreateInfo(operator)
	}
	if err := models.CreateWordBook(db, &book); err != nil {
		response.Fail(c, "创建失败", err)
		return
	}
	response.SuccessMsg(c, "创建成功", book)
}

func (h *Handlers) adminUpdateWordBook(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	if _, err := models.GetWordBookByID(db, uint(id)); err != nil {
		response.Fail(c, "词库不存在", err)
		return
	}
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		CloudStepsGo.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}
	// Prevent client from tampering audit fields
	delete(body, "createBy")
	delete(body, "updateBy")
	delete(body, "create_by")
	delete(body, "update_by")
	if user != nil {
		operator := user.DisplayName
		if operator == "" {
			operator = user.Username
		}
		if operator == "" {
			operator = fmt.Sprintf("%d", user.ID)
		}
		body["update_by"] = operator
	}
	if err := models.UpdateWordBook(db, uint(id), body); err != nil {
		response.Fail(c, "更新失败", err)
		return
	}
	book, _ := models.GetWordBookByID(db, uint(id))
	response.SuccessMsg(c, "更新成功", book)
}

func (h *Handlers) adminDeleteWordBook(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	operator := ""
	if user != nil {
		operator = user.DisplayName
		if operator == "" {
			operator = user.Username
		}
		if operator == "" {
			operator = fmt.Sprintf("%d", user.ID)
		}
	}
	if err := models.DeleteWordBook(db, uint(id), operator); err != nil {
		response.Fail(c, "删除失败", err)
		return
	}
	response.SuccessMsg(c, "删除成功", nil)
}

func (h *Handlers) adminListWords(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "30"))
	keyword := c.Query("keyword")

	words, total, err := models.ListWords(db, uint(id), keyword, page, pageSize)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	response.SuccessMsg(c, "success", gin.H{"list": words, "total": total, "page": page, "pageSize": pageSize})
}

func (h *Handlers) adminCreateWord(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	var body adminWordPayload
	if err := c.ShouldBindJSON(&body); err != nil {
		CloudStepsGo.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}
	word := body.toWord(uint(id))
	if user != nil {
		operator := user.DisplayName
		if operator == "" {
			operator = user.Username
		}
		if operator == "" {
			operator = fmt.Sprintf("%d", user.ID)
		}
		word.SetCreateInfo(operator)
	}
	if err := models.CreateWord(db, &word); err != nil {
		response.Fail(c, "创建失败", err)
		return
	}
	response.SuccessMsg(c, "创建成功", word)
}

func canManageWordBookWords(user *models.User, book *models.WordBook) bool {
	if user == nil || book == nil {
		return false
	}
	if user.IsAdmin() {
		return true
	}
	return book.OwnerUserID > 0 && book.OwnerUserID == user.ID
}

func operatorName(user *models.User) string {
	if user == nil {
		return ""
	}
	if user.DisplayName != "" {
		return user.DisplayName
	}
	if user.Username != "" {
		return user.Username
	}
	return fmt.Sprintf("%d", user.ID)
}

// handleUpdateWordBookWord PUT /wordbooks/:id/words/:wid — 管理员或自定义词书所有者
func (h *Handlers) handleUpdateWordBookWord(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	bookID, _ := strconv.Atoi(c.Param("id"))
	wid, _ := strconv.Atoi(c.Param("wid"))
	if bookID <= 0 || wid <= 0 {
		response.Fail(c, "参数无效", nil)
		return
	}
	book, err := models.GetWordBookByID(db, uint(bookID))
	if err != nil {
		response.Fail(c, "词库不存在", err)
		return
	}
	if !canManageWordBookWords(user, book) {
		response.Fail(c, "无权修改该词库单词", nil)
		return
	}
	word, err := models.GetWordByID(db, uint(wid))
	if err != nil || word.WordBookID != uint(bookID) {
		response.Fail(c, "单词不存在", err)
		return
	}
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		CloudStepsGo.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}
	delete(body, "createBy")
	delete(body, "updateBy")
	delete(body, "create_by")
	delete(body, "update_by")
	delete(body, "id")
	delete(body, "wordBookId")
	delete(body, "word_book_id")
	if op := operatorName(user); op != "" {
		body["update_by"] = op
	}
	if v, ok := body["audioUrl"]; ok {
		body["audio_url"] = audio.DeduplicateSlots(strings.TrimSpace(fmt.Sprint(v)))
		delete(body, "audioUrl")
	}
	if v, ok := body["translationShort"]; ok {
		body["translation_short"] = strings.TrimSpace(fmt.Sprint(v))
		delete(body, "translationShort")
	}
	if v, ok := body["word"]; ok {
		w := strings.TrimSpace(fmt.Sprint(v))
		if w == "" {
			response.Fail(c, "单词不能为空", nil)
			return
		}
		body["word"] = w
	}
	if err := models.UpdateWord(db, uint(wid), body); err != nil {
		response.Fail(c, "更新失败", err)
		return
	}
	fresh, _ := models.GetWordByID(db, uint(wid))
	response.SuccessMsg(c, "更新成功", fresh)
}

// handleDeleteWordBookWord DELETE /wordbooks/:id/words/:wid — 管理员或自定义词书所有者
func (h *Handlers) handleDeleteWordBookWord(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	bookID, _ := strconv.Atoi(c.Param("id"))
	wid, _ := strconv.Atoi(c.Param("wid"))
	if bookID <= 0 || wid <= 0 {
		response.Fail(c, "参数无效", nil)
		return
	}
	book, err := models.GetWordBookByID(db, uint(bookID))
	if err != nil {
		response.Fail(c, "词库不存在", err)
		return
	}
	if !canManageWordBookWords(user, book) {
		response.Fail(c, "无权删除该词库单词", nil)
		return
	}
	word, err := models.GetWordByID(db, uint(wid))
	if err != nil || word.WordBookID != uint(bookID) {
		response.Fail(c, "单词不存在", err)
		return
	}
	if err := models.DeleteWord(db, uint(wid), operatorName(user)); err != nil {
		response.Fail(c, "删除失败", err)
		return
	}
	_ = models.SyncWordBookCount(db, uint(bookID))
	response.SuccessMsg(c, "删除成功", nil)
}

// adminCheckWords POST {adminPrefix}/wordbooks/:id/words/check
func (h *Handlers) adminCheckWords(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Words []string `json:"words"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Words) == 0 {
		response.SuccessMsg(c, "success", gin.H{"duplicates": []string{}})
		return
	}
	var existing []string
	db.Model(&models.Word{}).
		Where("word_book_id = ? AND is_deleted = ? AND word IN ?", id, models.SoftDeleteStatusActive, body.Words).
		Pluck("word", &existing)
	response.SuccessMsg(c, "success", gin.H{"duplicates": existing})
}

// adminBatchCreateWords POST {adminPrefix}/wordbooks/:id/words/batch
func (h *Handlers) adminBatchCreateWords(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Words []adminWordPayload `json:"words"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Words) == 0 {
		CloudStepsGo.AbortWithJSONError(c, http.StatusBadRequest, errors.New("参数错误"))
		return
	}
	words := make([]models.Word, 0, len(body.Words))
	operator := ""
	if user != nil {
		operator = user.DisplayName
		if operator == "" {
			operator = user.Username
		}
		if operator == "" {
			operator = fmt.Sprintf("%d", user.ID)
		}
	}
	for _, w := range body.Words {
		if strings.TrimSpace(w.Word) == "" {
			continue
		}
		w.Word = strings.TrimSpace(w.Word)
		word := w.toWord(uint(id))
		if operator != "" {
			word.SetCreateInfo(operator)
		}
		words = append(words, word)
	}
	if len(words) == 0 {
		CloudStepsGo.AbortWithJSONError(c, http.StatusBadRequest, errors.New("没有可导入的数据"))
		return
	}
	if err := models.BatchCreateWords(db, words); err != nil {
		response.Fail(c, "批量插入失败", err)
		return
	}
	response.SuccessMsg(c, "导入成功", gin.H{"imported": len(words)})
}

// adminDeduplicateWordBookAudio POST /wordbooks/:id/words/deduplicate-audio
func (h *Handlers) adminDeduplicateWordBookAudio(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	bookID, err := strconv.Atoi(c.Param("id"))
	if err != nil || bookID <= 0 {
		response.Fail(c, "无效词库 ID", nil)
		return
	}

	var words []models.Word
	if err := db.Select("id, word, audio_url").
		Where("word_book_id = ? AND audio_url IS NOT NULL AND audio_url <> ''", bookID).
		Find(&words).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}

	checked := len(words)
	updated := 0
	for _, w := range words {
		cleaned := audio.DeduplicateSlots(w.AudioURL)
		if cleaned == w.AudioURL {
			continue
		}
		if err := db.Model(&models.Word{}).Where("id = ?", w.ID).
			Update("audio_url", cleaned).Error; err != nil {
			continue
		}
		updated++
	}

	response.SuccessMsg(c, fmt.Sprintf("已检查 %d 条，清理重复音频 %d 条", checked, updated), gin.H{
		"checked": checked,
		"updated": updated,
	})
}
