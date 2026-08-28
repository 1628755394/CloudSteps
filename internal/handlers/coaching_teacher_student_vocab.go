package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const studentActivityMergeCap = 3000

// coachingTeacherQuotaItem 老师端学员额度 + 活动摘要
type coachingTeacherQuotaItem struct {
	models.StudentTeacherCoachingQuota
	ReviewTimes          int        `json:"reviewTimes"`
	ReviewCurvePreset    string     `json:"reviewCurvePreset,omitempty"`
	VocabTestCount       int64      `json:"vocabTestCount"`
	CoachingSessionCount int64      `json:"coachingSessionCount"`
	StudySessionCount    int64      `json:"studySessionCount"`
	LatestVocabLevel     string     `json:"latestVocabLevel,omitempty"`
	LatestVocabTestAt    *time.Time `json:"latestVocabTestAt,omitempty"`
	LatestEstimatedVocab int        `json:"latestEstimatedVocab,omitempty"`
}

// studentActivityListItem 学员活动时间线（词汇测评 + 陪练完课 + 单词训练会话）
type studentActivityListItem struct {
	Kind            string                        `json:"kind"` // vocab_test | coaching_session | study_session
	ID              uint                          `json:"id"`
	Time            time.Time                     `json:"time"`
	Title           string                        `json:"title"`
	Summary         string                        `json:"summary"`
	WordBookName    string                        `json:"wordBookName,omitempty"`
	VocabTest       *models.VocabTestRecord       `json:"vocabTest,omitempty"`
	CoachingSession *models.CoachingSessionRecord `json:"coachingSession,omitempty"`
	StudySession    *models.StudySession          `json:"studySession,omitempty"`
}

func coachingCoachingTeacherID(c *gin.Context) uint {
	u := models.CurrentUser(c)
	if u == nil {
		return 0
	}
	tid := u.ID
	if u.IsAdmin() {
		if q := c.Query("teacherId"); q != "" {
			if v, _ := strconv.Atoi(q); v > 0 {
				tid = uint(v)
			}
		}
	}
	return tid
}

func coachingTeacherHasStudentPair(db *gorm.DB, teacherID, studentID uint) error {
	var n int64
	if err := db.Model(&models.StudentTeacherCoachingQuota{}).
		Where("teacher_id = ? AND student_id = ? AND is_deleted = 0", teacherID, studentID).
		Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		return errors.New("无权查看该学员或尚未建立陪练关系")
	}
	return nil
}

func coachingEnrichTeacherQuotaList(db *gorm.DB, teacherID uint, list []models.StudentTeacherCoachingQuota) ([]coachingTeacherQuotaItem, error) {
	out := make([]coachingTeacherQuotaItem, 0, len(list))
	if len(list) == 0 {
		return out, nil
	}
	studentIDs := make([]uint, 0, len(list))
	for _, q := range list {
		studentIDs = append(studentIDs, q.StudentID)
	}

	type cntRow struct {
		UserID uint  `gorm:"column:user_id"`
		N      int64 `gorm:"column:n"`
	}
	var cnts []cntRow
	if err := db.Model(&models.VocabTestRecord{}).
		Select("CASE WHEN student_id > 0 THEN student_id ELSE user_id END as user_id, count(*) as n").
		Scopes(vocabTestsOwnedByStudents(studentIDs)).
		Group("CASE WHEN student_id > 0 THEN student_id ELSE user_id END").
		Find(&cnts).Error; err != nil {
		return nil, err
	}
	countMap := make(map[uint]int64, len(cnts))
	for _, r := range cnts {
		countMap[r.UserID] = r.N
	}

	type coachCntRow struct {
		StudentID uint  `gorm:"column:student_id"`
		N         int64 `gorm:"column:n"`
	}
	var coachCnts []coachCntRow
	if err := db.Model(&models.CoachingSessionRecord{}).
		Select("student_id, count(*) as n").
		Where("teacher_id = ? AND student_id IN ?", teacherID, studentIDs).
		Group("student_id").
		Find(&coachCnts).Error; err != nil {
		return nil, err
	}
	coachMap := make(map[uint]int64, len(coachCnts))
	for _, r := range coachCnts {
		coachMap[r.StudentID] = r.N
	}

	type studyCntRow struct {
		UserID uint  `gorm:"column:user_id"`
		N      int64 `gorm:"column:n"`
	}
	var studyCnts []studyCntRow
	if err := db.Model(&models.StudySession{}).
		Select("user_id, count(*) as n").
		Where("user_id IN ?", studentIDs).
		Group("user_id").
		Find(&studyCnts).Error; err != nil {
		return nil, err
	}
	studyMap := make(map[uint]int64, len(studyCnts))
	for _, r := range studyCnts {
		studyMap[r.UserID] = r.N
	}

	type maxIDRow struct {
		Mid uint `gorm:"column:mid"`
	}
	var maxRows []maxIDRow
	if err := db.Raw(`
		SELECT MAX(id) AS mid FROM vocab_test_records
		WHERE student_id IN ? OR (student_id = 0 AND user_id IN ?)
		GROUP BY CASE WHEN student_id > 0 THEN student_id ELSE user_id END
	`, studentIDs, studentIDs).Scan(&maxRows).Error; err != nil {
		return nil, err
	}
	maxIDs := make([]uint, 0, len(maxRows))
	for _, r := range maxRows {
		if r.Mid > 0 {
			maxIDs = append(maxIDs, r.Mid)
		}
	}
	latestByUser := make(map[uint]models.VocabTestRecord)
	if len(maxIDs) > 0 {
		var recs []models.VocabTestRecord
		if err := db.Where("id IN ?", maxIDs).Find(&recs).Error; err != nil {
			return nil, err
		}
		for _, rec := range recs {
			latestByUser[rec.VocabTestOwnerID()] = rec
		}
	}

	for _, q := range list {
		item := coachingTeacherQuotaItem{
			StudentTeacherCoachingQuota: q,
			VocabTestCount:              countMap[q.StudentID],
			CoachingSessionCount:        coachMap[q.StudentID],
			StudySessionCount:           studyMap[q.StudentID],
		}
		if q.Student != nil {
			preset := string(models.NormalizeReviewCurvePreset(q.Student.ReviewCurvePreset))
			item.ReviewCurvePreset = preset
			item.ReviewTimes = models.ReviewTimesCount(preset)
			if q.Student.ReviewCurvePreset != preset {
				q.Student.ReviewCurvePreset = preset
			}
		} else {
			item.ReviewCurvePreset = string(models.ReviewCurveTimes5)
			item.ReviewTimes = 5
		}
		if rec, ok := latestByUser[q.StudentID]; ok {
			item.LatestVocabLevel = rec.EstimatedLevel
			item.LatestEstimatedVocab = rec.EstimatedVocab
			if rec.CompletedAt != nil {
				t := *rec.CompletedAt
				item.LatestVocabTestAt = &t
			} else {
				t := rec.CreatedAt
				item.LatestVocabTestAt = &t
			}
		}
		out = append(out, item)
	}
	return out, nil
}

func coachingBuildStudentActivityFeed(db *gorm.DB, teacherID, studentID uint) ([]studentActivityListItem, error) {
	var coaching []models.CoachingSessionRecord
	if err := db.Where("student_id = ? AND teacher_id = ?", studentID, teacherID).
		Preload("Appointment").
		Order("ended_at DESC").
		Limit(studentActivityMergeCap).
		Find(&coaching).Error; err != nil {
		return nil, err
	}

	var vocab []models.VocabTestRecord
	if err := db.Scopes(vocabTestOwnedByStudent(studentID)).
		Order("created_at DESC").
		Limit(studentActivityMergeCap).
		Find(&vocab).Error; err != nil {
		return nil, err
	}

	var studies []models.StudySession
	if err := db.Where("user_id = ?", studentID).
		Order("started_at DESC").
		Limit(studentActivityMergeCap).
		Find(&studies).Error; err != nil {
		return nil, err
	}

	bookIDs := make([]uint, 0)
	seenBook := make(map[uint]struct{})
	for _, s := range studies {
		if s.WordBookID == 0 {
			continue
		}
		if _, ok := seenBook[s.WordBookID]; ok {
			continue
		}
		seenBook[s.WordBookID] = struct{}{}
		bookIDs = append(bookIDs, s.WordBookID)
	}
	bookName := make(map[uint]string)
	if len(bookIDs) > 0 {
		var books []models.WordBook
		if err := db.Select("id", "name").Where("id IN ?", bookIDs).Find(&books).Error; err != nil {
			return nil, err
		}
		for _, b := range books {
			bookName[b.ID] = b.Name
		}
	}

	items := make([]studentActivityListItem, 0, len(coaching)+len(vocab)+len(studies))

	for i := range coaching {
		c := coaching[i]
		apTitle := ""
		if c.Appointment != nil && c.Appointment.Title != "" {
			apTitle = c.Appointment.Title
		}
		title := "陪练完课"
		if apTitle != "" {
			title = "陪练完课 · " + apTitle
		}
		summary := fmt.Sprintf("实际 %d 分钟 · 学员扣减 %d 分钟 · 计入老师 %d 分钟",
			c.ActualMinutes, c.BilledMinutes, c.TeacherCreditedMinutes)
		items = append(items, studentActivityListItem{
			Kind:            "coaching_session",
			ID:              c.ID,
			Time:            c.EndedAt,
			Title:           title,
			Summary:         summary,
			CoachingSession: &coaching[i],
		})
	}

	for i := range vocab {
		v := vocab[i]
		vCopy := v
		vCopy.Answers = ""
		t := v.CreatedAt
		if v.CompletedAt != nil {
			t = *v.CompletedAt
		}
		summary := fmt.Sprintf("等级 %s · 估算词汇量 %d · 正确 %d/%d",
			v.EstimatedLevel, v.EstimatedVocab, v.CorrectCount, v.QuestionCount)
		items = append(items, studentActivityListItem{
			Kind:      "vocab_test",
			ID:        v.ID,
			Time:      t,
			Title:     "词汇量测评",
			Summary:   summary,
			VocabTest: &vCopy,
		})
	}

	for i := range studies {
		s := studies[i]
		wname := bookName[s.WordBookID]
		title := "单词训练"
		if wname != "" {
			title = "单词训练 · " + wname
		}
		summary := fmt.Sprintf("类型 %s · %d 词 · 答对 %d · 状态 %s",
			s.SessionType, s.WordCount, s.CorrectCount, s.Status)
		t := s.StartedAt
		if s.CompletedAt != nil {
			t = *s.CompletedAt
		}
		items = append(items, studentActivityListItem{
			Kind:         "study_session",
			ID:           s.ID,
			Time:         t,
			Title:        title,
			Summary:      summary,
			WordBookName: wname,
			StudySession: &studies[i],
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].Time.After(items[j].Time)
	})
	return items, nil
}

func (h *Handlers) coachingTeacherStudentVocabRecords(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid64, err := strconv.ParseUint(c.Param("studentId"), 10, 64)
	if err != nil || sid64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学员 ID 无效"})
		return
	}
	sid := uint(sid64)
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}

	feed, err := coachingBuildStudentActivityFeed(db, tid, sid)
	if err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}

	month := strings.TrimSpace(c.Query("month")) // YYYY-MM
	kw := strings.ToLower(strings.TrimSpace(c.Query("q")))
	filtered := make([]studentActivityListItem, 0, len(feed))
	for _, it := range feed {
		if month != "" {
			if it.Time.Format("2006-01") != month {
				continue
			}
		}
		if kw != "" {
			hay := strings.ToLower(it.Title + " " + it.Summary + " " + it.Kind + " " + strconv.FormatUint(uint64(it.ID), 10))
			if !strings.Contains(hay, kw) {
				continue
			}
		}
		filtered = append(filtered, it)
	}

	// 筛选范围内的测评统计（不受分页影响）
	var vocabN, vocabQ, vocabCorrectSum int
	var vocabRateAcc float64
	var coachingN, studyN int
	for _, it := range filtered {
		switch it.Kind {
		case "coaching_session":
			coachingN++
		case "study_session":
			studyN++
		case "vocab_test":
			vocabN++
			qc, cc := 0, 0
			if it.VocabTest != nil {
				qc = it.VocabTest.QuestionCount
				cc = it.VocabTest.CorrectCount
			}
			if qc > 0 {
				vocabQ += qc
				vocabCorrectSum += cc
				vocabRateAcc += float64(cc) / float64(qc) * 100
			}
		}
	}
	avgRate := 0
	if vocabN > 0 {
		avgRate = int(vocabRateAcc/float64(vocabN) + 0.5)
	}

	limit := 20
	if ps := c.Query("limit"); ps != "" {
		if v, e := strconv.Atoi(ps); e == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	cursor := strings.TrimSpace(c.Query("cursor"))
	start := 0
	if cursor != "" {
		for i, it := range filtered {
			if fmt.Sprintf("%s|%s|%d", it.Time.UTC().Format(time.RFC3339Nano), it.Kind, it.ID) == cursor {
				start = i + 1
				break
			}
		}
	}
	end := start + limit
	hasMore := end < len(filtered)
	if end > len(filtered) {
		end = len(filtered)
	}
	page := filtered[start:end]
	var nextCursor string
	if hasMore && len(page) > 0 {
		last := page[len(page)-1]
		nextCursor = fmt.Sprintf("%s|%s|%d", last.Time.UTC().Format(time.RFC3339Nano), last.Kind, last.ID)
	}

	response.SuccessMsg(c, "ok", gin.H{
		"list":       page,
		"nextCursor": nextCursor,
		"hasMore":    hasMore,
		"limit":      limit,
		"stats": gin.H{
			"total":               len(filtered),
			"coaching":            coachingN,
			"vocab":               vocabN,
			"study":               studyN,
			"vocabAvgCorrectRate": avgRate,
			"vocabTotalQuestions": vocabQ,
			"vocabCorrectCount":   vocabCorrectSum,
		},
	})
}

func (h *Handlers) coachingTeacherStudentVocabRecordDetail(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid64, err := strconv.ParseUint(c.Param("studentId"), 10, 64)
	if err != nil || sid64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学员 ID 无效"})
		return
	}
	sid := uint(sid64)
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}
	rid, err := strconv.Atoi(c.Param("recordId"))
	if err != nil || rid <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "记录 ID 无效"})
		return
	}
	var record models.VocabTestRecord
	if err := db.Scopes(vocabTestOwnedByStudent(sid)).
		Where("id = ?", rid).
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "记录不存在"})
		return
	}
	response.SuccessMsg(c, "ok", record)
}

func (h *Handlers) coachingTeacherStudentCoachingSessionDetail(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid64, err := strconv.ParseUint(c.Param("studentId"), 10, 64)
	if err != nil || sid64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学员 ID 无效"})
		return
	}
	sid := uint(sid64)
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}
	sessID, err := strconv.Atoi(c.Param("sessionId"))
	if err != nil || sessID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "会话 ID 无效"})
		return
	}
	var rec models.CoachingSessionRecord
	if err := db.Preload("Appointment").
		Where("id = ? AND student_id = ? AND teacher_id = ?", sessID, sid, tid).
		First(&rec).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "记录不存在"})
		return
	}
	response.SuccessMsg(c, "ok", rec)
}

func (h *Handlers) coachingTeacherStudentStudySessionDetail(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid64, err := strconv.ParseUint(c.Param("studentId"), 10, 64)
	if err != nil || sid64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学员 ID 无效"})
		return
	}
	sid := uint(sid64)
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}
	sessID, err := strconv.Atoi(c.Param("sessionId"))
	if err != nil || sessID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "会话 ID 无效"})
		return
	}
	var rec models.StudySession
	if err := db.Where("id = ? AND user_id = ?", sessID, sid).First(&rec).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "记录不存在"})
		return
	}
	var wb models.WordBook
	wbName := ""
	if rec.WordBookID > 0 && db.Select("name").Where("id = ?", rec.WordBookID).First(&wb).Error == nil {
		wbName = wb.Name
	}
	response.SuccessMsg(c, "ok", gin.H{"session": rec, "wordBookName": wbName})
}
