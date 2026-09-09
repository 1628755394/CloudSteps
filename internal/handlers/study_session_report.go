package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/llm"
	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	lbconstants "github.com/LingByte/ling-base/common/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type studySessionReportDTO struct {
	SessionID            string   `json:"sessionId"`
	WordBookID           uint     `json:"wordBookId"`
	WordBookName         string   `json:"wordBookName"`
	StudentName          string   `json:"studentName"`
	StudentAvatar        string   `json:"studentAvatar,omitempty"`
	CoachName            string   `json:"coachName,omitempty"`
	CoachAvatar          string   `json:"coachAvatar,omitempty"`
	Status               string   `json:"status"`
	StartedAt            string   `json:"startedAt"`
	CompletedAt          string   `json:"completedAt,omitempty"`
	DurationMinutes      int      `json:"durationMinutes"`
	ScreenedKnownCount   int      `json:"screenedKnownCount"`
	ScreenedUnknownCount int      `json:"screenedUnknownCount"`
	WordCount            int      `json:"wordCount"`
	CorrectCount         int      `json:"correctCount"`
	ForgotCount          int      `json:"forgotCount"`
	AccuracyPercent      float64  `json:"accuracyPercent"`
	RemainPending        int64    `json:"remainPending"`
	WordBookWordCount    int64    `json:"wordBookWordCount"`
	LearnedCount         int64    `json:"learnedCount"`
	LessonCount          int64    `json:"lessonCount"`
	RemainingLessons     int      `json:"remainingLessons"`
	ForgotWords          []string `json:"forgotWords,omitempty"`
	StudiedWords         []string `json:"studiedWords,omitempty"`
	ReportSummary        string   `json:"reportSummary,omitempty"`
	AIAvailable          bool     `json:"aiAvailable"`
}

func (h *Handlers) loadStudySessionForReport(c *gin.Context) (*gorm.DB, *models.User, *models.StudySession, bool) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.authorization_required", nil)
		return nil, nil, nil, false
	}
	id64, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id64 == 0 {
		response.FailI18n(c, "coaching.session_not_found", nil)
		return nil, nil, nil, false
	}
	var session models.StudySession
	if err := db.Where("id = ?", uint(id64)).First(&session).Error; err != nil {
		response.FailI18n(c, "coaching.session_not_found", err)
		return nil, nil, nil, false
	}
	if !studySessionReportAccessible(db, c, user, &session) {
		response.FailI18n(c, "coaching.no_session_access", nil)
		return nil, nil, nil, false
	}
	return db, user, &session, true
}

func studySessionReportAccessible(db *gorm.DB, c *gin.Context, user *models.User, session *models.StudySession) bool {
	if session == nil || user == nil {
		return false
	}
	if session.UserID == user.ID {
		return true
	}
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		return false
	}
	return coachingTeacherHasStudentPair(db, tid, session.UserID) == nil
}

// parseReportSessionIDs 解析 ?sessionIds=a,b 多轮会话 id，始终包含 path 主键。
func parseReportSessionIDs(c *gin.Context, primaryID uint) []uint {
	seen := map[uint]struct{}{primaryID: {}}
	ids := []uint{primaryID}
	raw := strings.TrimSpace(c.Query("sessionIds"))
	if raw == "" {
		raw = strings.TrimSpace(c.Query("ids"))
	}
	if raw == "" {
		return ids
	}
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		v, err := strconv.ParseUint(part, 10, 64)
		if err != nil || v == 0 {
			continue
		}
		id := uint(v)
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids
}

func (h *Handlers) loadStudySessionsForReport(c *gin.Context) (*gorm.DB, *models.User, []*models.StudySession, bool) {
	db, user, primary, ok := h.loadStudySessionForReport(c)
	if !ok {
		return nil, nil, nil, false
	}
	wantIDs := parseReportSessionIDs(c, primary.ID)
	if len(wantIDs) == 1 {
		return db, user, []*models.StudySession{primary}, true
	}
	var rows []models.StudySession
	if err := db.Where("id IN ?", wantIDs).Find(&rows).Error; err != nil {
		response.FailI18n(c, "coaching.session_not_found", err)
		return nil, nil, nil, false
	}
	byID := make(map[uint]*models.StudySession, len(rows))
	for i := range rows {
		byID[rows[i].ID] = &rows[i]
	}
	out := make([]*models.StudySession, 0, len(wantIDs))
	for _, id := range wantIDs {
		s := byID[id]
		if s == nil {
			response.FailI18n(c, "coaching.session_not_found", nil)
			return nil, nil, nil, false
		}
		if !studySessionReportAccessible(db, c, user, s) {
			response.FailI18n(c, "coaching.no_session_access", nil)
			return nil, nil, nil, false
		}
		// 仅聚合同词库、同学员（或同自练）的轮次，避免误拼无关会话
		if s.WordBookID != primary.WordBookID || s.StudentID != primary.StudentID || s.UserID != primary.UserID {
			continue
		}
		out = append(out, s)
	}
	if len(out) == 0 {
		out = []*models.StudySession{primary}
	}
	return db, user, out, true
}

func buildStudySessionReport(db *gorm.DB, sessions ...*models.StudySession) studySessionReportDTO {
	if len(sessions) == 0 || sessions[0] == nil {
		return studySessionReportDTO{}
	}
	session := sessions[0]

	wbName := ""
	var wordBookWordCount int64
	var wb models.WordBook
	if err := db.Select("id", "name", "word_count").Where("id = ?", session.WordBookID).First(&wb).Error; err == nil {
		wbName = wb.Name
		wordBookWordCount = int64(wb.WordCount)
	}

	studentName := ""
	studentAvatar := ""
	coachName := ""
	coachAvatar := ""
	studentUserID := session.UserID
	coachUserID := session.UserID
	if session.StudentID > 0 {
		studentUserID = session.StudentID
		coachUserID = session.UserID
	}

	loadUserLabel := func(id uint) (name, avatar string) {
		if id == 0 {
			return "", ""
		}
		var u models.User
		if err := db.Select("id", "display_name", "username", "email", "avatar").Where("id = ?", id).First(&u).Error; err != nil {
			return "", ""
		}
		name = strings.TrimSpace(u.DisplayName)
		if name == "" {
			name = strings.TrimSpace(u.Username)
		}
		if name == "" {
			name = strings.TrimSpace(u.Email)
		}
		return name, strings.TrimSpace(u.Avatar)
	}

	studentName, studentAvatar = loadUserLabel(studentUserID)
	if coachUserID != studentUserID {
		coachName, coachAvatar = loadUserLabel(coachUserID)
	} else {
		// 自练：陪练与学员同一账号
		coachName, coachAvatar = studentName, studentAvatar
	}

	// 词状态挂在学员账号上；陪练课 UserID=老师、StudentID=学员。
	learnerID := studentUserID
	if learnerID == 0 {
		learnerID = session.UserID
	}

	screenedKnown := 0
	screenedUnknown := 0
	wordCount := 0
	correctCount := 0
	startedAt := session.StartedAt.UTC()
	var completedAtPtr *time.Time
	for _, s := range sessions {
		if s == nil {
			continue
		}
		screenedKnown += s.ScreenedKnownCount
		screenedUnknown += s.ScreenedUnknownCount
		wordCount += s.WordCount
		correctCount += s.CorrectCount
		if s.StartedAt.UTC().Before(startedAt) {
			startedAt = s.StartedAt.UTC()
		}
		if s.CompletedAt != nil {
			ct := s.CompletedAt.UTC()
			if completedAtPtr == nil || ct.After(*completedAtPtr) {
				completedAtPtr = &ct
			}
		}
	}

	end := time.Now().UTC()
	completedAt := ""
	if completedAtPtr != nil {
		end = *completedAtPtr
		completedAt = completedAtPtr.Format(time.RFC3339)
	}
	durMin := int(end.Sub(startedAt).Minutes() + 0.5)
	if durMin < 0 {
		durMin = 0
	}

	forgot := wordCount - correctCount
	if forgot < 0 {
		forgot = 0
	}
	acc := 0.0
	if wordCount > 0 {
		acc = float64(correctCount) * 100 / float64(wordCount)
	}

	var remain int64
	if wordBookWordCount == 0 {
		if n, err := models.GetWordCountByBookID(db, session.WordBookID); err == nil {
			wordBookWordCount = n
		} else {
			_ = db.Model(&models.WordLite{}).Where("word_book_id = ?", session.WordBookID).Count(&wordBookWordCount).Error
		}
	}

	// 已学进度：与灯塔一致，只计学员的 learned/mastered（不含 learning 中）
	var learnedCount int64
	_ = db.Model(&models.UserWordState{}).
		Where("user_id = ? AND word_book_id = ? AND learn_status IN ?",
			learnerID, session.WordBookID, []string{"learned", "mastered"}).
		Count(&learnedCount).Error

	// 剩余待学 = 词库总量 − 已学/已掌握（未入状态表的词也算待学）
	remain = wordBookWordCount - learnedCount
	if remain < 0 {
		remain = 0
	}

	ownerID := session.UserID
	var lessonCount int64
	_ = db.Model(&models.StudySession{}).
		Where("user_id = ? AND session_type = ? AND status = ?", ownerID, "learn", "completed").
		Count(&lessonCount).Error

	remainingLessons := 0
	studentID := session.StudentID
	teacherID := session.UserID
	if studentID > 0 && teacherID > 0 && studentID != teacherID {
		if q, err := coachingGetQuota(db, teacherID, studentID); err == nil {
			remainingLessons = q.RemainingLessons
		}
	}

	studiedWords := loadSessionWordLabelsMulti(db, sessions, sessionWordFilterAll, 0)
	forgotWords := loadSessionWordLabelsMulti(db, sessions, sessionWordFilterForgot, 0)

	reportSummary := ""
	if len(sessions) == 1 {
		reportSummary = strings.TrimSpace(session.ReportSummary)
	}

	return studySessionReportDTO{
		SessionID:            fmt.Sprintf("%d", session.ID),
		WordBookID:           session.WordBookID,
		WordBookName:         wbName,
		StudentName:          studentName,
		StudentAvatar:        studentAvatar,
		CoachName:            coachName,
		CoachAvatar:          coachAvatar,
		Status:               session.Status,
		StartedAt:            startedAt.Format(time.RFC3339),
		CompletedAt:          completedAt,
		DurationMinutes:      durMin,
		ScreenedKnownCount:   screenedKnown,
		ScreenedUnknownCount: screenedUnknown,
		WordCount:            wordCount,
		CorrectCount:         correctCount,
		ForgotCount:          forgot,
		AccuracyPercent:      acc,
		RemainPending:        remain,
		WordBookWordCount:    wordBookWordCount,
		LearnedCount:         learnedCount,
		LessonCount:          lessonCount,
		RemainingLessons:     remainingLessons,
		ForgotWords:          forgotWords,
		StudiedWords:         studiedWords,
		ReportSummary:        reportSummary,
		AIAvailable:          llm.FromGlobal().Enabled(),
	}
}

type sessionWordFilter int

const (
	sessionWordFilterAll sessionWordFilter = iota
	sessionWordFilterForgot
	sessionWordFilterRemembered
)

func loadSessionForgotWordLabels(db *gorm.DB, session *models.StudySession) []string {
	return loadSessionWordLabels(db, session, sessionWordFilterForgot, 12)
}

func loadSessionWordLabels(db *gorm.DB, session *models.StudySession, filter sessionWordFilter, limit int) []string {
	return loadSessionWordLabelsMulti(db, []*models.StudySession{session}, filter, limit)
}

func loadSessionWordLabelsMulti(db *gorm.DB, sessions []*models.StudySession, filter sessionWordFilter, limit int) []string {
	if len(sessions) == 0 || sessions[0] == nil {
		return nil
	}
	sessionIDs := make([]uint, 0, len(sessions))
	for _, s := range sessions {
		if s != nil && s.ID > 0 {
			sessionIDs = append(sessionIDs, s.ID)
		}
	}
	if len(sessionIDs) == 0 {
		return nil
	}
	q := db.Where("session_id IN ?", sessionIDs)
	switch filter {
	case sessionWordFilterForgot:
		q = q.Where("remembered = ?", false)
	case sessionWordFilterRemembered:
		q = q.Where("remembered = ?", true)
	}
	var sessionWords []models.SessionWord
	_ = q.Order("id ASC").Find(&sessionWords).Error
	if len(sessionWords) == 0 {
		return nil
	}
	ids := make([]uint, 0, len(sessionWords))
	seenWord := map[uint]struct{}{}
	for _, sw := range sessionWords {
		if _, ok := seenWord[sw.WordID]; ok {
			continue
		}
		seenWord[sw.WordID] = struct{}{}
		ids = append(ids, sw.WordID)
	}
	var words []models.WordLite
	_ = db.Where("id IN ?", ids).Find(&words).Error
	models.OverlayWordLites(db, sessions[0].UserID, words)
	byID := make(map[uint]models.WordLite, len(words))
	for _, w := range words {
		byID[w.ID] = w
	}
	if limit <= 0 {
		limit = len(sessionWords)
		if limit == 0 {
			limit = 1
		}
	}
	out := make([]string, 0, len(sessionWords))
	seenLabel := map[string]struct{}{}
	for _, sw := range sessionWords {
		w, ok := byID[sw.WordID]
		if !ok || strings.TrimSpace(w.Word) == "" {
			continue
		}
		gloss := strings.TrimSpace(w.TranslationShort)
		if gloss == "" {
			gloss = models.FormatTranslationShort(w.Translation)
		}
		var label string
		if gloss != "" {
			pos := abbreviatePartOfSpeech(w.PartOfSpeech)
			if pos != "" && !strings.HasPrefix(strings.ToLower(gloss), strings.ToLower(pos)) {
				label = fmt.Sprintf("%s  %s %s", w.Word, pos, gloss)
			} else {
				label = fmt.Sprintf("%s  %s", w.Word, gloss)
			}
		} else {
			label = w.Word
		}
		if _, ok := seenLabel[label]; ok {
			continue
		}
		seenLabel[label] = struct{}{}
		out = append(out, label)
		if len(out) >= limit {
			break
		}
	}
	return out
}

func studySessionReportPrompts(report studySessionReportDTO) (systemPrompt, userPrompt string) {
	systemPrompt = "你是英语陪练老师，写一段简短的课堂评价。" +
		"硬性要求：中文；只写 2-3 句自然连贯的话；总长不超过 80 字；" +
		"只聚焦本节正确率、课堂状态和表现是否有进步；表现好就直接表扬，表现下降或正确率偏低就简短鼓励并说下次加油；" +
		"禁止使用序号、列表、括号、Markdown、emoji；禁止写下节课安排、学习计划、下一步建议或扩展分析；" +
		"不要编造没有提供的课堂表现或进步信息；若没有历史对比，不要虚构具体进步幅度；" +
		"如需出现单词，只能从“未记住单词”中选择，禁止出现其他学过的单词。"
	forgotLine := "无"
	if len(report.ForgotWords) > 0 {
		forgotLine = strings.Join(report.ForgotWords, "、")
	}
	studiedLine := "无"
	if len(report.StudiedWords) > 0 {
		studiedLine = strings.Join(report.StudiedWords, "、")
	}
	screenTotal := report.ScreenedKnownCount + report.ScreenedUnknownCount
	name := fallbackDash(report.StudentName)
	userPrompt = fmt.Sprintf(
		"学员：%s\n词库：%s\n用时：约 %d 分钟\n筛词：合计 %d（认识 %d / 新学 %d）\n本课识记：%d\n训后记住：%d / 未记住：%d\n正确率：%.0f%%\n词书剩余待学：%d\n本节学习词：%s\n需巩固词：%s\n请只输出课堂评价正文，不要加标题、序号或括号。",
		name,
		fallbackDash(report.WordBookName),
		report.DurationMinutes,
		screenTotal,
		report.ScreenedKnownCount,
		report.ScreenedUnknownCount,
		report.WordCount,
		report.CorrectCount,
		report.ForgotCount,
		report.AccuracyPercent,
		report.RemainPending,
		studiedLine,
		forgotLine,
	)
	return systemPrompt, userPrompt
}

func fallbackDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return s
}

func abbreviatePartOfSpeech(raw string) string {
	p := strings.TrimSpace(strings.ToLower(raw))
	p = strings.TrimSuffix(p, ".")
	if p == "" {
		return ""
	}
	switch p {
	case "noun", "n":
		return "n."
	case "verb", "v":
		return "v."
	case "adjective", "adj", "a":
		return "adj."
	case "adverb", "adv":
		return "adv."
	case "pronoun", "pron":
		return "pron."
	case "preposition", "prep":
		return "prep."
	case "conjunction", "conj":
		return "conj."
	case "interjection", "int", "interj":
		return "int."
	default:
		if len(p) <= 6 {
			return p + "."
		}
		return ""
	}
}

func isCurrentSessionReportFormat(text string) bool {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return false
	}
	if strings.Contains(trimmed, "📚") || strings.Contains(trimmed, "🎯") || strings.Contains(trimmed, "家长您好") {
		return false
	}
	// Reject old long metric-dump paragraphs
	runes := []rune(trimmed)
	if len(runes) > 140 {
		return false
	}
	if strings.Contains(trimmed, "正确率达") ||
		strings.Contains(trimmed, "全程用时") ||
		strings.Contains(trimmed, "系统记录") ||
		strings.Contains(trimmed, "未触发熟词") ||
		strings.Contains(trimmed, "下节课") ||
		strings.Contains(trimmed, "下一节") ||
		strings.Contains(trimmed, "学习计划") ||
		strings.Contains(trimmed, "建议") ||
		strings.Contains(trimmed, "（") ||
		strings.Contains(trimmed, "）") ||
		strings.Contains(trimmed, "(") ||
		strings.Contains(trimmed, ")") ||
		(strings.Contains(trimmed, "正确率") && strings.Contains(trimmed, "剩余")) ||
		strings.Contains(trimmed, "1、") || strings.Contains(trimmed, "2、") ||
		strings.Contains(trimmed, "3、") || strings.Contains(trimmed, "4、") ||
		strings.Contains(trimmed, "1.") || strings.Contains(trimmed, "2.") ||
		strings.Contains(trimmed, "3.") || strings.Contains(trimmed, "4.") {
		return false
	}
	return true
}

// handleStudySessionReport GET /study/session/:id/report
func (h *Handlers) handleStudySessionReport(c *gin.Context) {
	db, _, sessions, ok := h.loadStudySessionsForReport(c)
	if !ok {
		return
	}
	report := buildStudySessionReport(db, sessions...)
	if report.ReportSummary != "" && !isCurrentSessionReportFormat(report.ReportSummary) {
		report.ReportSummary = ""
	}
	response.SuccessI18n(c, "common.success", report)
}

// handleStudySessionReportStream GET /study/session/:id/report/stream
// SSE: data JSON lines {"type":"delta"|"done"|"error"|"cached","text":"..."}
func (h *Handlers) handleStudySessionReportStream(c *gin.Context) {
	db, _, sessions, ok := h.loadStudySessionsForReport(c)
	if !ok {
		return
	}
	primary := sessions[0]
	report := buildStudySessionReport(db, sessions...)

	flusher, canFlush := c.Writer.(http.Flusher)
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	if canFlush {
		flusher.Flush()
	}

	writeSSE := func(payload map[string]string) {
		b, _ := json.Marshal(payload)
		_, _ = fmt.Fprintf(c.Writer, "data: %s\n\n", b)
		if canFlush {
			flusher.Flush()
		}
	}

	if cached := strings.TrimSpace(report.ReportSummary); cached != "" && isCurrentSessionReportFormat(cached) {
		writeSSE(map[string]string{"type": "cached", "text": cached})
		writeSSE(map[string]string{"type": "done", "text": cached})
		return
	}

	cfg := llm.FromGlobal()
	if !cfg.Enabled() {
		writeSSE(map[string]string{"type": "error", "text": "llm_not_configured"})
		return
	}

	systemPrompt, userPrompt := studySessionReportPrompts(report)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 90*time.Second)
	defer cancel()

	full, err := cfg.ChatStream(ctx, systemPrompt, userPrompt, func(delta string) {
		if delta == "" {
			return
		}
		writeSSE(map[string]string{"type": "delta", "text": delta})
	})
	if err != nil {
		msg := "ai_generate_failed"
		if err == llm.ErrNotConfigured {
			msg = "llm_not_configured"
		}
		writeSSE(map[string]string{"type": "error", "text": msg})
		return
	}

	_ = db.Model(primary).Update("report_summary", full).Error
	writeSSE(map[string]string{"type": "done", "text": full})
}
