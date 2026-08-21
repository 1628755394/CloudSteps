package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type studentWordMarkItem struct {
	ID           uint   `json:"id"`
	WordID       uint   `json:"wordId"`
	WordBookID   uint   `json:"wordBookId"`
	Word         string `json:"word"`
	Phonetic     string `json:"phonetic"`
	Translation  string `json:"translation"`
	AudioURL     string `json:"audioUrl"`
	WordBookName string `json:"wordBookName,omitempty"`
	CreatedAt    string `json:"createdAt"`
	Note         string `json:"note,omitempty"`
}

func coachingParseWordIDsQuery(raw string) []uint {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]uint, 0, len(parts))
	seen := make(map[uint]struct{}, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		n, err := strconv.ParseUint(p, 10, 64)
		if err != nil || n == 0 {
			continue
		}
		id := uint(n)
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
		if len(out) >= 200 {
			break
		}
	}
	return out
}

// coachingTeacherListStudentWordMarks GET .../students/:studentId/word-marks
func (h *Handlers) coachingTeacherListStudentWordMarks(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid, ok := coachingParseStudentID(c)
	if !ok {
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	keyword := strings.TrimSpace(c.Query("keyword"))

	q := db.Model(&models.StudentWordMark{}).
		Where(
			"teacher_id = ? AND student_id = ? AND is_deleted = ?",
			tid, sid, models.SoftDeleteStatusActive,
		)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}

	var marks []models.StudentWordMark
	if err := q.Order("id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&marks).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	if len(marks) == 0 {
		response.SuccessMsg(c, "ok", gin.H{
			"list":     []studentWordMarkItem{},
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		})
		return
	}

	wordIDs := make([]uint, 0, len(marks))
	for _, m := range marks {
		wordIDs = append(wordIDs, m.WordID)
	}
	var words []models.WordLite
	_ = db.Where("id IN ? AND is_deleted = ?", wordIDs, models.SoftDeleteStatusActive).Find(&words).Error
	byWord := make(map[uint]models.WordLite, len(words))
	bookIDs := make([]uint, 0)
	for _, w := range words {
		byWord[w.ID] = w
		if w.WordBookID > 0 {
			bookIDs = append(bookIDs, w.WordBookID)
		}
	}
	for _, m := range marks {
		if m.WordBookID > 0 {
			bookIDs = append(bookIDs, m.WordBookID)
		}
	}
	bookName := map[uint]string{}
	if len(bookIDs) > 0 {
		var books []models.WordBook
		_ = db.Select("id", "name").Where("id IN ?", bookIDs).Find(&books).Error
		for _, b := range books {
			bookName[b.ID] = b.Name
		}
	}

	out := make([]studentWordMarkItem, 0, len(marks))
	for _, m := range marks {
		w := byWord[m.WordID]
		if keyword != "" {
			kw := strings.ToLower(keyword)
			if !strings.Contains(strings.ToLower(w.Word), kw) &&
				!strings.Contains(strings.ToLower(w.Translation), kw) {
				continue
			}
		}
		bookID := m.WordBookID
		if bookID == 0 {
			bookID = w.WordBookID
		}
		out = append(out, studentWordMarkItem{
			ID:           m.ID,
			WordID:       m.WordID,
			WordBookID:   bookID,
			Word:         w.Word,
			Phonetic:     w.Phonetic,
			Translation:  w.Translation,
			AudioURL:     w.AudioURL,
			WordBookName: bookName[bookID],
			CreatedAt:    m.CreatedAt.Format("2006-01-02 15:04:05"),
			Note:         m.Note,
		})
	}

	response.SuccessMsg(c, "ok", gin.H{
		"list":     out,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// coachingTeacherStudentWordMarkIDs GET .../students/:studentId/word-marks/ids?wordIds=1,2,3
func (h *Handlers) coachingTeacherStudentWordMarkIDs(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid, ok := coachingParseStudentID(c)
	if !ok {
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}
	filter := coachingParseWordIDsQuery(c.Query("wordIds"))
	ids, err := models.ListActiveStudentWordMarkIDs(db, tid, sid, filter)
	if err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	if ids == nil {
		ids = []uint{}
	}
	response.SuccessMsg(c, "ok", gin.H{"markedIds": ids})
}

// coachingTeacherAddStudentWordMark POST .../students/:studentId/word-marks
func (h *Handlers) coachingTeacherAddStudentWordMark(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid, ok := coachingParseStudentID(c)
	if !ok {
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}

	var body struct {
		WordID     uint   `json:"wordId"`
		WordBookID uint   `json:"wordBookId"`
		Note       string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.WordID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请指定单词"})
		return
	}

	var word models.WordLite
	if err := db.Where("id = ? AND is_deleted = ?", body.WordID, models.SoftDeleteStatusActive).
		First(&word).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "单词不存在"})
		return
	}
	bookID := body.WordBookID
	if bookID == 0 {
		bookID = word.WordBookID
	}

	row, err := models.UpsertStudentWordMark(db, tid, sid, body.WordID, bookID, strings.TrimSpace(body.Note))
	if err != nil {
		response.Fail(c, "标记失败", err.Error())
		return
	}
	response.SuccessMsg(c, "已标记", gin.H{
		"id":         row.ID,
		"wordId":     row.WordID,
		"wordBookId": row.WordBookID,
		"marked":     true,
	})
}

// coachingTeacherRemoveStudentWordMark DELETE .../students/:studentId/word-marks/:wordId
func (h *Handlers) coachingTeacherRemoveStudentWordMark(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid, ok := coachingParseStudentID(c)
	if !ok {
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}
	wid64, err := strconv.ParseUint(c.Param("wordId"), 10, 64)
	if err != nil || wid64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "单词 ID 无效"})
		return
	}
	if err := models.SoftDeleteStudentWordMark(db, tid, sid, uint(wid64)); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "未找到该标记"})
			return
		}
		response.Fail(c, "取消标记失败", err.Error())
		return
	}
	response.SuccessMsg(c, "已取消标记", gin.H{"wordId": uint(wid64), "marked": false})
}
