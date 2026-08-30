package handlers

import (
	"errors"

	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	lbconstants "github.com/LingByte/ling-base/common/constants"

	"net/http"
	"strconv"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type teacherStudentWordBookItem struct {
	ID        uint   `json:"id"` // word book id
	Name      string `json:"name"`
	WordCount int    `json:"wordCount"`
}

func coachingParseStudentID(c *gin.Context) (uint, bool) {
	sid64, err := strconv.ParseUint(c.Param("studentId"), 10, 64)
	if err != nil || sid64 == 0 {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("学员 ID 无效"))
		return 0, false
	}
	return uint(sid64), true
}

func (h *Handlers) coachingTeacherListStudentWordBooks(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		response.AbortWithStatusJSON(c, http.StatusUnauthorized, errors.New("未登录"))
		return
	}
	sid, ok := coachingParseStudentID(c)
	if !ok {
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		response.AbortWithStatusJSON(c, http.StatusForbidden, err)
		return
	}

	var links []models.UserWordBook
	if err := db.Where("user_id = ?", sid).
		Order("id ASC").
		Find(&links).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	if len(links) == 0 {
		response.SuccessMsg(c, "ok", gin.H{"list": []teacherStudentWordBookItem{}})
		return
	}

	ids := make([]uint, 0, len(links))
	for _, l := range links {
		ids = append(ids, l.WordBookID)
	}
	var books []models.WordBook
	_ = db.Select("id", "name", "word_count").
		Where("id IN ?", ids).
		Find(&books).Error
	byID := make(map[uint]models.WordBook, len(books))
	for _, b := range books {
		byID[b.ID] = b
	}

	out := make([]teacherStudentWordBookItem, 0, len(links))
	for _, l := range links {
		b, ok := byID[l.WordBookID]
		name := ""
		wc := 0
		if ok {
			name = b.Name
			wc = b.WordCount
		} else {
			name = "词库 #" + strconv.FormatUint(uint64(l.WordBookID), 10)
		}
		out = append(out, teacherStudentWordBookItem{
			ID:        l.WordBookID,
			Name:      name,
			WordCount: wc,
		})
	}
	response.SuccessMsg(c, "ok", gin.H{"list": out})
}

func (h *Handlers) coachingTeacherAddStudentWordBook(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		response.AbortWithStatusJSON(c, http.StatusUnauthorized, errors.New("未登录"))
		return
	}
	sid, ok := coachingParseStudentID(c)
	if !ok {
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		response.AbortWithStatusJSON(c, http.StatusForbidden, err)
		return
	}

	var body struct {
		WordBookID uint `json:"wordBookId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.WordBookID == 0 {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("wordBookId 无效"))
		return
	}
	if _, err := models.GetWordBookByID(db, body.WordBookID); err != nil {
		response.Fail(c, "词库不存在", err.Error())
		return
	}

	now := time.Now().UTC()
	var uwb models.UserWordBook
	err := db.Where("user_id = ? AND word_book_id = ?", sid, body.WordBookID).First(&uwb).Error
	if err == gorm.ErrRecordNotFound {
		uwb = models.UserWordBook{
			UserID:     sid,
			WordBookID: body.WordBookID,
			Status:     "active",
			StartedAt:  &now,
		}
		if err := db.Create(&uwb).Error; err != nil {
			response.Fail(c, "添加词库失败", err.Error())
			return
		}
	} else if err != nil {
		response.Fail(c, "添加词库失败", err.Error())
		return
	} else {
		uwb.Restore("")
		updates := map[string]interface{}{
			"status":     "active",
			"updated_at": now,
		}
		if uwb.StartedAt == nil {
			updates["started_at"] = now
		}
		if err := db.Model(&uwb).Updates(updates).Error; err != nil {
			response.Fail(c, "添加词库失败", err.Error())
			return
		}
	}

	wb, _ := models.GetWordBookByID(db, body.WordBookID)
	item := teacherStudentWordBookItem{
		ID:        body.WordBookID,
		Name:      "",
		WordCount: 0,
	}
	if wb != nil {
		item.Name = wb.Name
		item.WordCount = wb.WordCount
	}
	response.SuccessMsg(c, "ok", item)
}

func (h *Handlers) coachingTeacherRemoveStudentWordBook(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		response.AbortWithStatusJSON(c, http.StatusUnauthorized, errors.New("未登录"))
		return
	}
	sid, ok := coachingParseStudentID(c)
	if !ok {
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, sid); err != nil {
		response.AbortWithStatusJSON(c, http.StatusForbidden, err)
		return
	}
	wbID64, err := strconv.ParseUint(c.Param("wordBookId"), 10, 64)
	if err != nil || wbID64 == 0 {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, errors.New("词库 ID 无效"))
		return
	}
	wbID := uint(wbID64)

	var uwb models.UserWordBook
	if err := db.Where("user_id = ? AND word_book_id = ?", sid, wbID).
		First(&uwb).Error; err != nil {
		response.AbortWithStatusJSON(c, http.StatusNotFound, errors.New("未分配该词库"))
		return
	}
	op := ""
	if u := auth.CurrentUser(c); u != nil {
		op = u.Username
	}
	uwb.SoftDelete(op)
	uwb.Status = "removed"
	if err := db.Save(&uwb).Error; err != nil {
		response.Fail(c, "移除失败", err.Error())
		return
	}
	response.SuccessMsg(c, "ok", gin.H{"studentId": sid, "wordBookId": wbID})
}
