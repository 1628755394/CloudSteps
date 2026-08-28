package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/CloudStepsGo/pkg/utils"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *Handlers) registerCoachingRoutes(r *gin.RouterGroup) {
	adminG := r.Group("coaching")
	adminG.Use(models.AuthRequired, h.requireAdmin)
	{
		adminG.GET("/appointments", h.coachingAdminListAppointments)
		adminG.GET("/appointments/:id", h.coachingAdminGetAppointment)
		adminG.POST("/appointments", h.coachingAdminCreateAppointment)
		adminG.PUT("/appointments/:id", h.coachingAdminUpdateAppointment)
		adminG.DELETE("/appointments/:id", h.coachingAdminDeleteAppointment)
		adminG.GET("/quotas", h.coachingAdminListQuotas)
		adminG.PUT("/quotas", h.coachingAdminUpsertQuota)
		adminG.GET("/teacher-pools", h.coachingAdminListTeacherPools)
		adminG.PUT("/teacher-pools", h.coachingAdminUpsertTeacherPool)
		adminG.GET("/usage-periods", h.coachingAdminListUsagePeriods)
		adminG.PUT("/usage-periods", h.coachingAdminPutUsagePeriod)
		adminG.GET("/audit-logs", h.coachingAdminListAuditLogs)
	}

	t := r.Group("teacher/coaching")
	t.Use(models.AuthRequired, h.requireTeacherOrAdmin)
	{
		t.GET("/week", h.coachingTeacherWeek)
		t.GET("/completed", h.coachingTeacherCompleted)
		t.GET("/quotas", h.coachingTeacherListQuotas)
		t.GET("/teacher-pool", h.coachingTeacherGetMyPool)
		t.POST("/quotas", h.coachingTeacherUpsertQuota)
		t.POST("/students", h.coachingTeacherCreateStudent)
		t.DELETE("/students/:studentId", h.coachingTeacherRemoveStudent)
		t.POST("/students/:studentId/password", h.coachingTeacherSetStudentPassword)
		t.PUT("/students/:studentId/review-curve", h.coachingTeacherSetStudentReviewCurve)
		t.GET("/students/search", h.coachingTeacherSearchStudents)
		t.POST("/appointments", h.coachingTeacherCreateAppointment)
		t.PUT("/appointments/:id", h.coachingTeacherUpdateAppointment)
		t.DELETE("/appointments/:id", h.coachingTeacherDeleteAppointment)
		t.GET("/students/:studentId/coaching-sessions/:sessionId", h.coachingTeacherStudentCoachingSessionDetail)
		t.GET("/students/:studentId/study-sessions/:sessionId", h.coachingTeacherStudentStudySessionDetail)
		t.GET("/students/:studentId/vocab-records/:recordId", h.coachingTeacherStudentVocabRecordDetail)
		t.GET("/students/:studentId/vocab-records", h.coachingTeacherStudentVocabRecords)
		t.GET("/students/:studentId/wordbooks", h.coachingTeacherListStudentWordBooks)
		t.POST("/students/:studentId/wordbooks", h.coachingTeacherAddStudentWordBook)
		t.DELETE("/students/:studentId/wordbooks/:wordBookId", h.coachingTeacherRemoveStudentWordBook)
		t.POST("/appointments/:id/start", h.coachingTeacherStart)
		t.POST("/appointments/:id/end", h.coachingTeacherEnd)
		// 无排课练习：按所选学员开课计时并扣额度
		t.POST("/practice/start", h.coachingTeacherStartPractice)
	}

	s := r.Group("student/coaching")
	s.Use(models.AuthRequired, h.requireStudentOrAdmin)
	{
		s.GET("/week", h.coachingStudentWeek)
	}
}

// coachingIsTeacherRole 老师：role=teacher，或与后台一致的 user（陪练）
func coachingIsTeacherRole(u *models.User) bool {
	if u == nil {
		return false
	}
	return u.IsTeacher() || u.Role == "user"
}

func (h *Handlers) requireTeacherOrAdmin(c *gin.Context) {
	u := models.CurrentUser(c)
	if u == nil || (!coachingIsTeacherRole(u) && !u.IsAdmin()) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "需要老师或管理员权限"})
		c.Abort()
		return
	}
	c.Next()
}

func (h *Handlers) requireStudentOrAdmin(c *gin.Context) {
	u := models.CurrentUser(c)
	if u == nil || (!u.IsStudent() && !u.IsAdmin()) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "需要学员或管理员权限"})
		c.Abort()
		return
	}
	c.Next()
}

func coachingDateOnly(t time.Time) time.Time {
	y, m, d := t.In(time.Local).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.Local)
}

func coachingGetQuota(db *gorm.DB, teacherID, studentID uint) (models.StudentTeacherCoachingQuota, error) {
	var q models.StudentTeacherCoachingQuota
	err := db.Where("teacher_id = ? AND student_id = ? AND is_deleted = ?", teacherID, studentID, 0).First(&q).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.StudentTeacherCoachingQuota{TeacherID: teacherID, StudentID: studentID, RemainingMinutes: 60}, gorm.ErrRecordNotFound
	}
	return q, err
}

func coachingGetOrCreateUsagePeriod(tx *gorm.DB, teacherID uint, ref time.Time) (*models.TeacherCoachingUsagePeriod, error) {
	loc := time.Local
	ref = ref.In(loc)
	y, m, _ := ref.Date()
	periodStart := time.Date(y, m, 1, 0, 0, 0, 0, loc)
	periodEnd := periodStart.AddDate(0, 1, 0)

	var p models.TeacherCoachingUsagePeriod
	err := tx.Where("teacher_id = ? AND period_start = ? AND is_deleted = ?", teacherID, periodStart, 0).First(&p).Error
	if err == nil {
		return &p, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	p = models.TeacherCoachingUsagePeriod{
		TeacherID: teacherID, PeriodStart: periodStart, PeriodEnd: periodEnd, UsedMinutes: 0, CapMinutes: 0,
	}
	if err := tx.Create(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func coachingAppointmentConflicts(db *gorm.DB, ap *models.CoachingAppointment, excludeID uint) error {
	date := coachingDateOnly(ap.ScheduledDate)
	base := db.Model(&models.CoachingAppointment{}).
		Where("is_deleted = ? AND status NOT IN ?", 0, []string{models.CoachingStatusCancelled}).
		Where("scheduled_date = ?", date)
	if excludeID > 0 {
		base = base.Where("id <> ?", excludeID)
	}

	var tList []models.CoachingAppointment
	if err := base.Session(&gorm.Session{NewDB: true}).Where("teacher_id = ?", ap.TeacherID).Find(&tList).Error; err != nil {
		return err
	}
	for _, o := range tList {
		ov, err := models.CoachingSlotOverlap(o.ScheduledDate, ap.ScheduledDate, o.StartTime, o.EndTime, ap.StartTime, ap.EndTime)
		if err != nil {
			return err
		}
		if ov {
			return errors.New("老师在该时段已有排课")
		}
	}

	var sList []models.CoachingAppointment
	if err := base.Session(&gorm.Session{NewDB: true}).Where("student_id = ?", ap.StudentID).Find(&sList).Error; err != nil {
		return err
	}
	for _, o := range sList {
		ov, err := models.CoachingSlotOverlap(o.ScheduledDate, ap.ScheduledDate, o.StartTime, o.EndTime, ap.StartTime, ap.EndTime)
		if err != nil {
			return err
		}
		if ov {
			return errors.New("学员在该时段已有排课")
		}
	}
	return nil
}

func coachingLoadUserRoles(db *gorm.DB, id uint, want string) error {
	var u models.User
	if err := db.Select("id", "role").Where("id = ? AND is_deleted = ?", id, 0).First(&u).Error; err != nil {
		return err
	}
	if want == "teacher" && !coachingIsTeacherRole(&u) {
		return errors.New("用户不是老师角色")
	}
	if want == "student" && !u.IsStudent() {
		return errors.New("用户不是学员角色")
	}
	return nil
}

// --- Admin ---

func (h *Handlers) coachingAdminListAppointments(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	from := c.Query("from")
	to := c.Query("to")
	if from == "" || to == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "需要 from、to（YYYY-MM-DD）"})
		return
	}
	tFrom, err := time.ParseInLocation("2006-01-02", from, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "from 日期格式错误"})
		return
	}
	tTo, err := time.ParseInLocation("2006-01-02", to, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "to 日期格式错误"})
		return
	}

	page := 1
	pageSize := 20
	if p := c.Query("page"); p != "" {
		if v, _ := strconv.Atoi(p); v > 0 {
			page = v
		}
	}
	if ps := c.Query("pageSize"); ps != "" {
		if v, _ := strconv.Atoi(ps); v > 0 && v <= 100 {
			pageSize = v
		}
	}

	base := db.Model(&models.CoachingAppointment{}).
		Where("is_deleted = 0 AND scheduled_date >= ? AND scheduled_date <= ?", coachingDateOnly(tFrom), coachingDateOnly(tTo))
	if tid := c.Query("teacherId"); tid != "" {
		if v, _ := strconv.Atoi(tid); v > 0 {
			base = base.Where("teacher_id = ?", v)
		}
	}
	if sid := c.Query("studentId"); sid != "" {
		if v, _ := strconv.Atoi(sid); v > 0 {
			base = base.Where("student_id = ?", v)
		}
	}
	if st := strings.TrimSpace(c.Query("status")); st != "" && st != "all" {
		base = base.Where("status = ?", st)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	var list []models.CoachingAppointment
	if err := base.
		Preload("Teacher").Preload("Student").Preload("Session").
		Order("scheduled_date DESC, start_time DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&list).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	response.SuccessMsg(c, "ok", gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *Handlers) coachingAdminGetAppointment(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效 id"})
		return
	}
	var ap models.CoachingAppointment
	if err := db.Where("id = ? AND is_deleted = 0", id).
		Preload("Teacher").Preload("Student").Preload("Session").
		First(&ap).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "排课不存在"})
		return
	}
	response.SuccessMsg(c, "ok", ap)
}

type coachingAdminApptBody struct {
	TeacherID     uint   `json:"teacherId" binding:"required"`
	StudentID     uint   `json:"studentId" binding:"required"`
	ScheduledDate string `json:"scheduledDate" binding:"required"`
	StartTime     string `json:"startTime" binding:"required"`
	EndTime       string `json:"endTime" binding:"required"`
	Title         string `json:"title"`
	Notes         string `json:"notes"`
}

func (h *Handlers) coachingAdminCreateAppointment(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	var body coachingAdminApptBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	sd, err := time.ParseInLocation("2006-01-02", body.ScheduledDate, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "scheduledDate 格式错误"})
		return
	}
	dur, err := models.CoachingDurationMinutes(body.StartTime, body.EndTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "开始/结束时间无效"})
		return
	}
	if err := coachingLoadUserRoles(db, body.TeacherID, "teacher"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	if err := coachingLoadUserRoles(db, body.StudentID, "student"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	ap := models.CoachingAppointment{
		TeacherID: body.TeacherID, StudentID: body.StudentID,
		ScheduledDate: coachingDateOnly(sd), StartTime: body.StartTime, EndTime: body.EndTime,
		DurationMinutes: dur, Status: models.CoachingStatusScheduled, Title: body.Title, Notes: body.Notes,
	}
	if err := coachingAppointmentConflicts(db, &ap, 0); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	if err := db.Create(&ap).Error; err != nil {
		response.Fail(c, "创建失败", err.Error())
		return
	}
	_ = db.Preload("Teacher").Preload("Student").First(&ap, ap.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditAppointmentCreate, "appointment", ap.ID, ap.ID, "创建排课", map[string]any{
		"teacherId": ap.TeacherID, "studentId": ap.StudentID,
		"scheduledDate": ap.ScheduledDate.Format("2006-01-02"),
		"startTime":     ap.StartTime, "endTime": ap.EndTime,
	})
	response.SuccessMsg(c, "ok", ap)
}

func (h *Handlers) coachingAdminUpdateAppointment(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效 id"})
		return
	}
	var ap models.CoachingAppointment
	if err := db.Where("id = ? AND is_deleted = 0", id).First(&ap).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "排课不存在"})
		return
	}
	if ap.Status == models.CoachingStatusCompleted || ap.Status == models.CoachingStatusInProgress {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "进行中或已完成的排课不可修改时段"})
		return
	}
	var body coachingAdminApptBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	sd, err := time.ParseInLocation("2006-01-02", body.ScheduledDate, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "scheduledDate 格式错误"})
		return
	}
	dur, err := models.CoachingDurationMinutes(body.StartTime, body.EndTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "开始/结束时间无效"})
		return
	}
	if err := coachingLoadUserRoles(db, body.TeacherID, "teacher"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	if err := coachingLoadUserRoles(db, body.StudentID, "student"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	ap.TeacherID = body.TeacherID
	ap.StudentID = body.StudentID
	ap.ScheduledDate = coachingDateOnly(sd)
	ap.StartTime = body.StartTime
	ap.EndTime = body.EndTime
	ap.DurationMinutes = dur
	ap.Title = body.Title
	ap.Notes = body.Notes
	if err := coachingAppointmentConflicts(db, &ap, ap.ID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	if err := db.Save(&ap).Error; err != nil {
		response.Fail(c, "更新失败", err.Error())
		return
	}
	_ = db.Preload("Teacher").Preload("Student").Preload("Session").First(&ap, ap.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditAppointmentUpdate, "appointment", ap.ID, ap.ID, "更新排课", map[string]any{
		"teacherId": ap.TeacherID, "studentId": ap.StudentID,
		"scheduledDate": ap.ScheduledDate.Format("2006-01-02"),
		"startTime":     ap.StartTime, "endTime": ap.EndTime,
	})
	response.SuccessMsg(c, "ok", ap)
}

func (h *Handlers) coachingAdminDeleteAppointment(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	id, _ := strconv.Atoi(c.Param("id"))
	if err := db.Model(&models.CoachingAppointment{}).Where("id = ?", id).Update("is_deleted", 1).Error; err != nil {
		response.Fail(c, "删除失败", err.Error())
		return
	}
	uid := uint(id)
	coachingWriteCoachingAudit(db, c, coachingAuditAppointmentDelete, "appointment", uid, uid, "删除排课", map[string]any{"appointmentId": id})
	response.SuccessMsg(c, "ok", gin.H{"id": id})
}

func (h *Handlers) coachingAdminListQuotas(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	var list []models.StudentTeacherCoachingQuota
	tx := db.Where("is_deleted = 0 AND student_id <> teacher_id").
		Preload("Teacher").Preload("Student").Order("teacher_id, student_id")
	if tid := c.Query("teacherId"); tid != "" {
		if v, _ := strconv.Atoi(tid); v > 0 {
			tx = tx.Where("teacher_id = ?", v)
		}
	}
	if sid := c.Query("studentId"); sid != "" {
		if v, _ := strconv.Atoi(sid); v > 0 {
			tx = tx.Where("student_id = ?", v)
		}
	}
	if err := tx.Find(&list).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	response.SuccessMsg(c, "ok", list)
}

type coachingQuotaBody struct {
	TeacherID        uint `json:"teacherId" binding:"required"`
	StudentID        uint `json:"studentId" binding:"required"`
	RemainingMinutes int  `json:"remainingMinutes"` // 允许 0
}

func (h *Handlers) coachingAdminUpsertQuota(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	var body coachingQuotaBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	if body.RemainingMinutes < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "remainingMinutes 不能为负"})
		return
	}
	if err := coachingLoadUserRoles(db, body.TeacherID, "teacher"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	if err := coachingLoadUserRoles(db, body.StudentID, "student"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	var q models.StudentTeacherCoachingQuota
	err := db.Where("teacher_id = ? AND student_id = ? AND is_deleted = 0", body.TeacherID, body.StudentID).First(&q).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		q = models.StudentTeacherCoachingQuota{
			TeacherID: body.TeacherID, StudentID: body.StudentID,
			RemainingMinutes: body.RemainingMinutes, TotalAllocatedMinutes: body.RemainingMinutes, Version: 0,
		}
		if err := db.Create(&q).Error; err != nil {
			response.Fail(c, "保存失败", err.Error())
			return
		}
		coachingWriteCoachingAudit(db, c, coachingAuditQuotaUpsert, "quota", q.ID, 0, "新建师生额度", map[string]any{
			"teacherId": body.TeacherID, "studentId": body.StudentID, "remainingMinutes": body.RemainingMinutes,
		})
		response.SuccessMsg(c, "ok", q)
		return
	}
	if err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	if body.RemainingMinutes > q.RemainingMinutes {
		q.TotalAllocatedMinutes += body.RemainingMinutes - q.RemainingMinutes
	}
	q.RemainingMinutes = body.RemainingMinutes
	if err := db.Save(&q).Error; err != nil {
		response.Fail(c, "保存失败", err.Error())
		return
	}
	coachingWriteCoachingAudit(db, c, coachingAuditQuotaUpsert, "quota", q.ID, 0, "更新师生额度", map[string]any{
		"teacherId": body.TeacherID, "studentId": body.StudentID, "remainingMinutes": body.RemainingMinutes,
	})
	response.SuccessMsg(c, "ok", q)
}

func (h *Handlers) coachingAdminListTeacherPools(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tx := db.Where("is_deleted = 0").Preload("Teacher").Order("teacher_id")
	if tid := c.Query("teacherId"); tid != "" {
		if v, _ := strconv.Atoi(tid); v > 0 {
			tx = tx.Where("teacher_id = ?", v)
		}
	}
	var list []models.TeacherTeachingPool
	if err := tx.Find(&list).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	response.SuccessMsg(c, "ok", list)
}

type coachingTeacherPoolBody struct {
	TeacherID        uint `json:"teacherId" binding:"required"`
	RemainingMinutes int  `json:"remainingMinutes"`
}

func (h *Handlers) coachingAdminUpsertTeacherPool(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	var body coachingTeacherPoolBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	if body.RemainingMinutes < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "remainingMinutes 不能为负"})
		return
	}
	if err := coachingLoadUserRoles(db, body.TeacherID, "teacher"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	row, err := models.EnsureTeacherTeachingPool(db, body.TeacherID)
	if err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	if body.RemainingMinutes > row.RemainingMinutes {
		row.TotalAllocatedMinutes += body.RemainingMinutes - row.RemainingMinutes
	}
	row.RemainingMinutes = body.RemainingMinutes
	if err := db.Model(row).Updates(map[string]any{
		"remaining_minutes":       row.RemainingMinutes,
		"total_allocated_minutes": row.TotalAllocatedMinutes,
	}).Error; err != nil {
		response.Fail(c, "保存失败", err.Error())
		return
	}
	_ = db.Preload("Teacher").First(row, row.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditQuotaUpsert, "teacher_pool", row.ID, 0, "更新老师授课池", map[string]any{
		"teacherId": body.TeacherID, "remainingMinutes": body.RemainingMinutes,
	})
	response.SuccessMsg(c, "ok", row)
}

func (h *Handlers) coachingAdminListUsagePeriods(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	limit := 50
	if l := c.Query("limit"); l != "" {
		if v, _ := strconv.Atoi(l); v > 0 && v <= 200 {
			limit = v
		}
	}
	tx := db.Where("is_deleted = 0").Preload("Teacher").Order("period_start DESC")
	if tidStr := c.Query("teacherId"); tidStr != "" {
		if tid, _ := strconv.Atoi(tidStr); tid > 0 {
			tx = tx.Where("teacher_id = ?", tid)
		}
	}
	var rows []models.TeacherCoachingUsagePeriod
	if err := tx.Limit(limit).Find(&rows).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	response.SuccessMsg(c, "ok", rows)
}

type coachingUsagePeriodBody struct {
	TeacherID   uint   `json:"teacherId" binding:"required"`
	Month       string `json:"month" binding:"required"` // YYYY-MM
	CapMinutes  *int   `json:"capMinutes"`
	UsedMinutes *int   `json:"usedMinutes"`
}

func (h *Handlers) coachingAdminPutUsagePeriod(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	var body coachingUsagePeriodBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	var coachUser models.User
	if err := db.Select("id", "role").Where("id = ? AND is_deleted = 0", body.TeacherID).First(&coachUser).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "用户不存在"})
		return
	}
	if !coachingIsTeacherRole(&coachUser) {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "用户不是老师/陪练角色"})
		return
	}
	t, err := time.ParseInLocation("2006-01", body.Month, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "month 格式应为 YYYY-MM"})
		return
	}
	y, m, _ := t.Date()
	periodStart := time.Date(y, m, 1, 0, 0, 0, 0, time.Local)
	periodEnd := periodStart.AddDate(0, 1, 0)

	var row models.TeacherCoachingUsagePeriod
	err = db.Where("teacher_id = ? AND period_start = ? AND is_deleted = 0", body.TeacherID, periodStart).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row = models.TeacherCoachingUsagePeriod{
			TeacherID: body.TeacherID, PeriodStart: periodStart, PeriodEnd: periodEnd,
			UsedMinutes: 0, CapMinutes: 0,
		}
		if body.CapMinutes != nil {
			row.CapMinutes = *body.CapMinutes
		}
		if body.UsedMinutes != nil {
			row.UsedMinutes = *body.UsedMinutes
		}
		if row.CapMinutes < 0 || row.UsedMinutes < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "分钟数不能为负"})
			return
		}
		if err := db.Create(&row).Error; err != nil {
			response.Fail(c, "创建失败", err.Error())
			return
		}
		coachingWriteCoachingAudit(db, c, coachingAuditUsagePeriodPut, "usage_period", row.ID, 0, "创建老师计量周期", map[string]any{
			"teacherId": body.TeacherID, "month": body.Month, "capMinutes": row.CapMinutes, "usedMinutes": row.UsedMinutes,
		})
		response.SuccessMsg(c, "ok", row)
		return
	}
	if err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	updates := map[string]any{}
	if body.CapMinutes != nil {
		if *body.CapMinutes < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "capMinutes 不能为负"})
			return
		}
		updates["cap_minutes"] = *body.CapMinutes
	}
	if body.UsedMinutes != nil {
		if *body.UsedMinutes < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "usedMinutes 不能为负"})
			return
		}
		updates["used_minutes"] = *body.UsedMinutes
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "至少提供 capMinutes 或 usedMinutes"})
		return
	}
	if err := db.Model(&row).Updates(updates).Error; err != nil {
		response.Fail(c, "更新失败", err.Error())
		return
	}
	_ = db.Preload("Teacher").First(&row, row.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditUsagePeriodPut, "usage_period", row.ID, 0, "更新老师计量周期", map[string]any{
		"teacherId": body.TeacherID, "month": body.Month, "updates": updates,
	})
	response.SuccessMsg(c, "ok", row)
}

// --- Teacher week / start / end ---

func coachingWeekItems(db *gorm.DB, teacherID, studentID uint, weekRef string) ([]models.CoachingAppointment, error) {
	d, err := time.ParseInLocation("2006-01-02", weekRef, time.Local)
	if err != nil {
		return nil, err
	}
	mon, sun := models.CoachingWeekMondaySunday(d, time.Local)

	var list []models.CoachingAppointment
	tx := db.Where("is_deleted = 0 AND scheduled_date >= ? AND scheduled_date <= ?", coachingDateOnly(mon), coachingDateOnly(sun)).
		Preload("Teacher").Preload("Student").Preload("Session").
		Order("scheduled_date, start_time")
	if teacherID > 0 {
		tx = tx.Where("teacher_id = ?", teacherID)
	}
	if studentID > 0 {
		tx = tx.Where("student_id = ?", studentID)
	}
	if err := tx.Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}

func (h *Handlers) coachingTeacherWeek(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	date := c.Query("date")
	if date == "" {
		date = time.Now().In(time.Local).Format("2006-01-02")
	}
	var tid uint
	if user.IsAdmin() {
		if q := c.Query("teacherId"); q != "" {
			if v, _ := strconv.Atoi(q); v > 0 {
				tid = uint(v)
			}
		}
		if tid == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "管理员查询周课表请传 teacherId"})
			return
		}
	} else {
		tid = user.ID
	}
	list, err := coachingWeekItems(db, tid, 0, date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "日期无效"})
		return
	}
	response.SuccessMsg(c, "ok", gin.H{"schedules": coachingToWeekDTO(list)})
}

func (h *Handlers) coachingTeacherListQuotas(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	_ = models.RepairTeacherCoachingRelations(db, tid)

	limit := 20
	if ps := c.Query("limit"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	q := strings.TrimSpace(c.Query("q"))
	var cursorID uint
	if raw := strings.TrimSpace(c.Query("cursor")); raw != "" {
		if v, err := strconv.ParseUint(raw, 10, 64); err == nil {
			cursorID = uint(v)
		}
	}

	includeSelf := strings.TrimSpace(c.Query("includeSelf")) == "1" ||
		strings.EqualFold(strings.TrimSpace(c.Query("includeSelf")), "true")
	tx := db.Model(&models.StudentTeacherCoachingQuota{}).
		Joins("INNER JOIN users ON users.id = student_teacher_coaching_quotas.student_id AND users.is_deleted = ?", models.SoftDeleteStatusActive).
		Where("student_teacher_coaching_quotas.teacher_id = ? AND student_teacher_coaching_quotas.is_deleted = 0", tid)
	if !includeSelf {
		tx = tx.Where("student_teacher_coaching_quotas.student_id != ?", tid)
	}
	if cursorID > 0 {
		tx = tx.Where("student_teacher_coaching_quotas.id < ?", cursorID)
	}
	if q != "" {
		like := "%" + q + "%"
		tx = tx.Where(
			"users.display_name LIKE ? OR users.username LIKE ? OR users.phone LIKE ? OR CAST(student_teacher_coaching_quotas.student_id AS CHAR) LIKE ?",
			like, like, like, like,
		)
	}

	var list []models.StudentTeacherCoachingQuota
	if err := tx.Preload("Student").
		Order("student_teacher_coaching_quotas.id DESC").
		Limit(limit + 1).
		Find(&list).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}

	hasMore := len(list) > limit
	if hasMore {
		list = list[:limit]
	}
	var nextCursor string
	if hasMore && len(list) > 0 {
		nextCursor = strconv.FormatUint(uint64(list[len(list)-1].ID), 10)
	}

	items, err := coachingEnrichTeacherQuotaList(db, tid, list)
	if err != nil {
		response.Fail(c, "汇总测评数据失败", err.Error())
		return
	}
	response.SuccessMsg(c, "ok", gin.H{
		"list":       items,
		"nextCursor": nextCursor,
		"hasMore":    hasMore,
		"limit":      limit,
	})
}

func (h *Handlers) coachingTeacherGetMyPool(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	_ = models.RepairTeacherCoachingRelations(db, tid)
	pool, err := models.EnsureTeacherTeachingPool(db, tid)
	if err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	remaining, total := 0, 0
	if pool != nil {
		remaining = pool.RemainingMinutes
		total = pool.TotalAllocatedMinutes
	}
	response.SuccessMsg(c, "ok", gin.H{
		"remainingMinutes":      remaining,
		"totalAllocatedMinutes": total,
	})
}

func (h *Handlers) coachingStudentWeek(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	date := c.Query("date")
	if date == "" {
		date = time.Now().In(time.Local).Format("2006-01-02")
	}
	var sid uint
	if user.IsAdmin() {
		if q := c.Query("studentId"); q != "" {
			if v, _ := strconv.Atoi(q); v > 0 {
				sid = uint(v)
			}
		}
		if sid == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "管理员查询周课表请传 studentId"})
			return
		}
	} else {
		sid = user.ID
	}
	list, err := coachingWeekItems(db, 0, sid, date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "日期无效"})
		return
	}
	response.SuccessMsg(c, "ok", gin.H{"schedules": coachingToWeekDTO(list)})
}

type coachingWeekScheduleDTO struct {
	ID            uint     `json:"id"`
	Title         string   `json:"title"`
	ScheduledDate string   `json:"scheduledDate"`
	StartTime     string   `json:"startTime"`
	EndTime       string   `json:"endTime"`
	TeacherID     uint     `json:"teacherId"`
	StudentID     uint     `json:"studentId"`
	Status        string   `json:"status"`
	Students      []string `json:"students,omitempty"`
	Session       any      `json:"session,omitempty"`
}

func coachingToWeekDTO(list []models.CoachingAppointment) []coachingWeekScheduleDTO {
	out := make([]coachingWeekScheduleDTO, 0, len(list))
	for _, a := range list {
		title := a.Title
		if title == "" && a.Student != nil {
			title = displayNameOrEmail(a.Student)
		}
		students := []string{}
		if a.Student != nil {
			students = append(students, displayNameOrEmail(a.Student))
		}
		var sess any
		if a.Session != nil && a.Session.ID > 0 {
			sess = gin.H{
				"status":                 a.Session.Status,
				"startedAt":              a.Session.StartedAt,
				"endedAt":                a.Session.EndedAt,
				"actualMinutes":          a.Session.ActualMinutes,
				"billedMinutes":          a.Session.BilledMinutes,
				"teacherCreditedMinutes": a.Session.TeacherCreditedMinutes,
			}
		} else if a.Status == models.CoachingStatusInProgress && a.ActualStartedAt != nil {
			loc := time.Local
			_, slotEnd, planned, _ := models.CoachingAppointmentSlotBounds(&a, loc)
			sess = gin.H{
				"status":         "in_progress",
				"startedAt":      *a.ActualStartedAt,
				"scheduledEndAt": slotEnd,
				"plannedMinutes": planned,
			}
		}
		out = append(out, coachingWeekScheduleDTO{
			ID:            a.ID,
			Title:         title,
			ScheduledDate: a.ScheduledDate.Format("2006-01-02"),
			StartTime:     a.StartTime,
			EndTime:       a.EndTime,
			TeacherID:     a.TeacherID,
			StudentID:     a.StudentID,
			Status:        a.Status,
			Students:      students,
			Session:       sess,
		})
	}
	return out
}

func displayNameOrEmail(u *models.User) string {
	if u == nil {
		return ""
	}
	if u.DisplayName != "" {
		return u.DisplayName
	}
	return u.Username
}

type coachingTeacherApptBody struct {
	StudentID     uint   `json:"studentId" binding:"required"`
	ScheduledDate string `json:"scheduledDate" binding:"required"`
	StartTime     string `json:"startTime" binding:"required"`
	EndTime       string `json:"endTime" binding:"required"`
	Title         string `json:"title"`
	Notes         string `json:"notes"`
}

type coachingTeacherQuotaBody struct {
	StudentID        uint `json:"studentId" binding:"required"`
	RemainingMinutes int  `json:"remainingMinutes"`
}

const coachingDefaultStudentPassword = "student123"

type coachingTeacherCreateStudentBody struct {
	DisplayName string `json:"displayName" binding:"required"`
	Password    string `json:"password"`   // 可选；默认 student123
	StudyHours  int    `json:"studyHours"` // 学时 → 转成分钟额度
}

type coachingTeacherSetStudentPasswordBody struct {
	Password string `json:"password"` // 空则重置为 student123
}

// coachingUsernameFromDisplayName 姓名（可含中文）+ 随机数字，生成可登录账号
func coachingUsernameFromDisplayName(db *gorm.DB, displayName string) (string, error) {
	base := strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, strings.TrimSpace(displayName))
	if base == "" {
		base = "学员"
	}
	runes := []rune(base)
	if len(runes) > 16 {
		base = string(runes[:16])
	}
	for i := 0; i < 12; i++ {
		suffix := strconv.FormatInt(time.Now().UnixNano()%10000, 10)
		for len(suffix) < 4 {
			suffix = "0" + suffix
		}
		cand := base + suffix
		if err := utils.ValidateUserName(cand); err != nil {
			// 极端非法字符时退回英文前缀
			cand = "st" + strconv.FormatInt(time.Now().UnixNano()%1e8, 10)
		}
		if !models.IsExistsByUsername(db, cand) {
			return cand, nil
		}
		time.Sleep(time.Millisecond)
	}
	return "", errors.New("生成账号失败")
}

func (h *Handlers) coachingTeacherCreateStudent(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	var body coachingTeacherCreateStudentBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	name := strings.TrimSpace(body.DisplayName)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请填写学生姓名"})
		return
	}
	if body.StudyHours < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学时不能为负"})
		return
	}

	remaining := body.StudyHours * 60
	username, err := coachingUsernameFromDisplayName(db, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "生成账号失败，请重试"})
		return
	}

	pwd := strings.TrimSpace(body.Password)
	if pwd == "" {
		pwd = coachingDefaultStudentPassword
	}
	if len(pwd) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "密码至少 6 位"})
		return
	}
	student := models.User{
		Username:    username,
		Password:    models.HashPassword(pwd),
		DisplayName: name,
		Role:        models.RoleStudent,
		Source:      "teacher_create",
	}
	runes := []rune(name)
	if len(runes) > 0 {
		student.FirstName = string(runes[0])
	}
	if len(runes) > 1 {
		student.LastName = string(runes[1:])
	}

	var quota models.StudentTeacherCoachingQuota
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&student).Error; err != nil {
			return err
		}
		quota = models.StudentTeacherCoachingQuota{
			TeacherID:             tid,
			StudentID:             student.ID,
			RemainingMinutes:      remaining,
			TotalAllocatedMinutes: remaining,
		}
		return tx.Create(&quota).Error
	})
	if err != nil {
		response.Fail(c, "创建失败", err.Error())
		return
	}
	_ = db.Preload("Student").First(&quota, quota.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditQuotaUpsert, "quota", quota.ID, 0, "老师新建学员", map[string]any{
		"teacherId": tid, "studentId": student.ID, "displayName": name,
		"remainingMinutes": remaining, "username": username,
	})
	response.SuccessMsg(c, "ok", gin.H{
		"quota":           quota,
		"student":         student,
		"username":        username,
		"initialPassword": pwd,
	})
}

func (h *Handlers) coachingTeacherSetStudentPassword(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid, err := strconv.ParseUint(c.Param("studentId"), 10, 64)
	if err != nil || sid == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学员 ID 无效"})
		return
	}
	var body coachingTeacherSetStudentPasswordBody
	_ = c.ShouldBindJSON(&body)

	var quota models.StudentTeacherCoachingQuota
	if err := db.Where("teacher_id = ? AND student_id = ?", tid, sid).First(&quota).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "该学员不在你的名下"})
			return
		}
		response.Fail(c, "查询失败", err.Error())
		return
	}

	var user models.User
	if err := db.First(&user, sid).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "学员不存在"})
		return
	}

	pwd := strings.TrimSpace(body.Password)
	if pwd == "" {
		pwd = coachingDefaultStudentPassword
	}
	if len(pwd) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "密码至少 6 位"})
		return
	}
	if err := models.ResetPassword(db, &user, pwd); err != nil {
		response.Fail(c, "设置密码失败", err.Error())
		return
	}
	coachingWriteCoachingAudit(db, c, "student_password_set", "student", user.ID, 0, "老师设置学员密码", map[string]any{
		"teacherId": tid, "studentId": user.ID, "resetToDefault": strings.TrimSpace(body.Password) == "",
	})
	response.SuccessMsg(c, "ok", gin.H{
		"studentId": user.ID,
		"username":  user.Username,
		"password":  pwd,
	})
}

type coachingTeacherSetStudentReviewCurveBody struct {
	ReviewCurvePreset string `json:"reviewCurvePreset" binding:"required"`
}

func (h *Handlers) coachingTeacherSetStudentReviewCurve(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid, err := strconv.ParseUint(c.Param("studentId"), 10, 64)
	if err != nil || sid == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学员 ID 无效"})
		return
	}
	var body coachingTeacherSetStudentReviewCurveBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数无效"})
		return
	}
	preset := string(models.NormalizeReviewCurvePreset(body.ReviewCurvePreset))

	if err := coachingTeacherHasStudentPair(db, tid, uint(sid)); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}

	var user models.User
	if err := db.First(&user, sid).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "学员不存在"})
		return
	}
	if err := models.UpdateUser(db, &user, map[string]any{"review_curve_preset": preset}); err != nil {
		response.Fail(c, "保存失败", err.Error())
		return
	}
	user.ReviewCurvePreset = preset
	coachingWriteCoachingAudit(db, c, "student_review_curve_set", "student", user.ID, 0, "老师设置抗遗忘次数", map[string]any{
		"teacherId":         tid,
		"studentId":         user.ID,
		"reviewCurvePreset": preset,
		"reviewTimes":       models.ReviewTimesCount(preset),
	})
	response.SuccessMsg(c, "ok", gin.H{
		"studentId":         user.ID,
		"reviewCurvePreset": preset,
		"reviewTimes":       models.ReviewTimesCount(preset),
		"presetLabel":       models.ReviewCurvePresetLabel(preset),
	})
}

func (h *Handlers) coachingTeacherRemoveStudent(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	sid, err := strconv.ParseUint(c.Param("studentId"), 10, 64)
	if err != nil || sid == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "学员 ID 无效"})
		return
	}
	if models.IsSelfCoachingPair(tid, uint(sid)) {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无法移除自练额度"})
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, uint(sid)); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": err.Error()})
		return
	}

	var q models.StudentTeacherCoachingQuota
	if err := db.Where("teacher_id = ? AND student_id = ? AND is_deleted = 0", tid, sid).First(&q).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "学员不在你的名下"})
			return
		}
		response.Fail(c, "查询失败", err.Error())
		return
	}

	op := ""
	if u := models.CurrentUser(c); u != nil {
		op = u.Username
	}
	q.SoftDelete(op)
	if err := db.Model(&q).Updates(map[string]any{
		"is_deleted": q.IsDeleted,
		"update_by":  q.UpdateBy,
		"updated_at": q.UpdatedAt,
	}).Error; err != nil {
		response.Fail(c, "移除失败", err.Error())
		return
	}

	coachingWriteCoachingAudit(db, c, coachingAuditQuotaRemove, "quota", q.ID, 0, "老师移除学员", map[string]any{
		"teacherId": tid, "studentId": sid,
	})
	response.SuccessMsg(c, "ok", gin.H{"studentId": sid})
}

func (h *Handlers) coachingTeacherCompleted(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	from := c.Query("from")
	to := c.Query("to")
	if from == "" || to == "" {
		now := time.Now().In(time.Local)
		to = now.Format("2006-01-02")
		from = now.AddDate(0, 0, -90).Format("2006-01-02")
	}
	tFrom, err := time.ParseInLocation("2006-01-02", from, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "from 日期格式错误"})
		return
	}
	tTo, err := time.ParseInLocation("2006-01-02", to, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "to 日期格式错误"})
		return
	}
	page := 1
	pageSize := 20
	if p := c.Query("page"); p != "" {
		if v, _ := strconv.Atoi(p); v > 0 {
			page = v
		}
	}
	if ps := c.Query("pageSize"); ps != "" {
		if v, _ := strconv.Atoi(ps); v > 0 && v <= 100 {
			pageSize = v
		}
	}
	offset := (page - 1) * pageSize

	var total int64
	base := db.Model(&models.CoachingAppointment{}).
		Where("is_deleted = 0 AND teacher_id = ? AND status = ?", tid, models.CoachingStatusCompleted).
		Where("scheduled_date >= ? AND scheduled_date <= ?", coachingDateOnly(tFrom), coachingDateOnly(tTo))
	if err := base.Count(&total).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	var list []models.CoachingAppointment
	if err := base.
		Preload("Teacher").Preload("Student").Preload("Session").
		Order("scheduled_date DESC, start_time DESC").
		Offset(offset).Limit(pageSize).
		Find(&list).Error; err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	response.SuccessMsg(c, "ok", gin.H{
		"schedules": coachingToWeekDTO(list),
		"total":     total,
		"page":      page,
		"pageSize":  pageSize,
	})
}

func (h *Handlers) coachingTeacherSearchStudents(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	q := strings.TrimSpace(c.Query("q"))
	if len(q) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "搜索关键词至少 2 个字符"})
		return
	}
	like := "%" + q + "%"
	var users []models.User
	if err := db.Select("id", "username", "display_name", "phone", "role").
		Where("is_deleted = 0 AND role = ?", "student").
		Where("username LIKE ? OR display_name LIKE ? OR phone LIKE ?", like, like, like).
		Order("display_name, username").
		Limit(20).
		Find(&users).Error; err != nil {
		response.Fail(c, "搜索失败", err.Error())
		return
	}
	items := make([]gin.H, 0, len(users))
	for _, u := range users {
		items = append(items, gin.H{
			"id":          u.ID,
			"username":    u.Username,
			"displayName": u.DisplayName,
			"phone":       u.Phone,
		})
	}
	response.SuccessMsg(c, "ok", items)
}

func (h *Handlers) coachingTeacherUpsertQuota(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	var body coachingTeacherQuotaBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	if body.RemainingMinutes < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "remainingMinutes 不能为负"})
		return
	}
	if err := coachingLoadUserRoles(db, body.StudentID, "student"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	var q models.StudentTeacherCoachingQuota
	err := db.Where("teacher_id = ? AND student_id = ? AND is_deleted = 0", tid, body.StudentID).First(&q).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		q = models.StudentTeacherCoachingQuota{
			TeacherID: tid, StudentID: body.StudentID,
			RemainingMinutes: body.RemainingMinutes, TotalAllocatedMinutes: body.RemainingMinutes, Version: 0,
		}
		if err := db.Create(&q).Error; err != nil {
			response.Fail(c, "保存失败", err.Error())
			return
		}
		_ = db.Preload("Student").First(&q, q.ID).Error
		coachingWriteCoachingAudit(db, c, coachingAuditQuotaUpsert, "quota", q.ID, 0, "老师添加学员", map[string]any{
			"teacherId": tid, "studentId": body.StudentID, "remainingMinutes": body.RemainingMinutes,
		})
		response.SuccessMsg(c, "ok", q)
		return
	}
	if err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	if body.RemainingMinutes > q.RemainingMinutes {
		q.TotalAllocatedMinutes += body.RemainingMinutes - q.RemainingMinutes
	}
	q.RemainingMinutes = body.RemainingMinutes
	if err := db.Save(&q).Error; err != nil {
		response.Fail(c, "保存失败", err.Error())
		return
	}
	_ = db.Preload("Student").First(&q, q.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditQuotaUpsert, "quota", q.ID, 0, "老师更新学员额度", map[string]any{
		"teacherId": tid, "studentId": body.StudentID, "remainingMinutes": body.RemainingMinutes,
	})
	response.SuccessMsg(c, "ok", q)
}

func (h *Handlers) coachingTeacherCreateAppointment(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	var body coachingTeacherApptBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, body.StudentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请先添加该学员后再排课"})
		return
	}
	sd, err := time.ParseInLocation("2006-01-02", body.ScheduledDate, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "scheduledDate 格式错误"})
		return
	}
	dur, err := models.CoachingDurationMinutes(body.StartTime, body.EndTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "开始/结束时间无效"})
		return
	}
	ap := models.CoachingAppointment{
		TeacherID: tid, StudentID: body.StudentID,
		ScheduledDate: coachingDateOnly(sd), StartTime: body.StartTime, EndTime: body.EndTime,
		DurationMinutes: dur, Status: models.CoachingStatusScheduled, Title: body.Title, Notes: body.Notes,
	}
	if err := coachingAppointmentConflicts(db, &ap, 0); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	if err := db.Create(&ap).Error; err != nil {
		response.Fail(c, "创建失败", err.Error())
		return
	}
	_ = db.Preload("Teacher").Preload("Student").First(&ap, ap.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditAppointmentCreate, "appointment", ap.ID, ap.ID, "老师创建排课", map[string]any{
		"teacherId": ap.TeacherID, "studentId": ap.StudentID,
		"scheduledDate": ap.ScheduledDate.Format("2006-01-02"),
		"startTime":     ap.StartTime, "endTime": ap.EndTime,
	})
	response.SuccessMsg(c, "ok", ap)
}

func (h *Handlers) coachingTeacherUpdateAppointment(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "无效 id"})
		return
	}
	var ap models.CoachingAppointment
	if err := db.Where("id = ? AND is_deleted = 0 AND teacher_id = ?", id, tid).First(&ap).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "排课不存在"})
		return
	}
	if ap.Status == models.CoachingStatusCompleted || ap.Status == models.CoachingStatusInProgress {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "进行中或已完成的排课不可修改"})
		return
	}
	var body coachingTeacherApptBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}
	if err := coachingTeacherHasStudentPair(db, tid, body.StudentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请先添加该学员后再排课"})
		return
	}
	sd, err := time.ParseInLocation("2006-01-02", body.ScheduledDate, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "scheduledDate 格式错误"})
		return
	}
	dur, err := models.CoachingDurationMinutes(body.StartTime, body.EndTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "开始/结束时间无效"})
		return
	}
	ap.StudentID = body.StudentID
	ap.ScheduledDate = coachingDateOnly(sd)
	ap.StartTime = body.StartTime
	ap.EndTime = body.EndTime
	ap.DurationMinutes = dur
	ap.Title = body.Title
	ap.Notes = body.Notes
	if err := coachingAppointmentConflicts(db, &ap, ap.ID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	if err := db.Save(&ap).Error; err != nil {
		response.Fail(c, "更新失败", err.Error())
		return
	}
	_ = db.Preload("Teacher").Preload("Student").Preload("Session").First(&ap, ap.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditAppointmentUpdate, "appointment", ap.ID, ap.ID, "老师更新排课", map[string]any{
		"teacherId": ap.TeacherID, "studentId": ap.StudentID,
		"scheduledDate": ap.ScheduledDate.Format("2006-01-02"),
		"startTime":     ap.StartTime, "endTime": ap.EndTime,
	})
	response.SuccessMsg(c, "ok", ap)
}

func (h *Handlers) coachingTeacherDeleteAppointment(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	var ap models.CoachingAppointment
	if err := db.Where("id = ? AND is_deleted = 0 AND teacher_id = ?", id, tid).First(&ap).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "排课不存在"})
		return
	}
	if ap.Status == models.CoachingStatusInProgress {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "上课中的排课不可删除"})
		return
	}
	if err := db.Model(&ap).Update("is_deleted", 1).Error; err != nil {
		response.Fail(c, "删除失败", err.Error())
		return
	}
	uid := uint(id)
	coachingWriteCoachingAudit(db, c, coachingAuditAppointmentDelete, "appointment", uid, uid, "老师删除排课", map[string]any{"appointmentId": id})
	response.SuccessMsg(c, "ok", gin.H{"id": id})
}

func (h *Handlers) coachingTeacherStart(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	var ap models.CoachingAppointment
	if err := db.Where("id = ? AND is_deleted = 0", id).First(&ap).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "排课不存在"})
		return
	}
	if coachingIsTeacherRole(user) && !user.IsAdmin() && ap.TeacherID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "无权操作此排课"})
		return
	}
	if ap.Status != models.CoachingStatusScheduled {
		if ap.Status == models.CoachingStatusInProgress {
			response.SuccessMsg(c, "ok", gin.H{"appointment": ap, "message": "已在上课中"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "当前状态不可开始"})
		return
	}
	q, err := coachingGetQuota(db, ap.TeacherID, ap.StudentID)
	if errors.Is(err, gorm.ErrRecordNotFound) || q.RemainingMinutes <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "陪练剩余时长不足，无法开始上课"})
		return
	}
	if err != nil {
		response.Fail(c, "查询额度失败", err.Error())
		return
	}
	now := time.Now()
	if err := models.CoachingCanStartAt(&ap, now, time.Local); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	if err := coachingTeacherPoolAllowsStart(db, ap.TeacherID); err != nil {
		if errors.Is(err, errCoachingTeacherPoolEmpty) {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
			return
		}
		response.Fail(c, "查询老师计量失败", err.Error())
		return
	}
	ap.Status = models.CoachingStatusInProgress
	ap.ActualStartedAt = &now
	if err := db.Model(&ap).Updates(map[string]any{
		"status": models.CoachingStatusInProgress, "actual_started_at": now,
	}).Error; err != nil {
		response.Fail(c, "开始失败", err.Error())
		return
	}
	_ = db.First(&ap, ap.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditSessionStart, "appointment", uint(id), uint(id), "开始上课", map[string]any{
		"teacherId": ap.TeacherID, "studentId": ap.StudentID,
	})
	response.SuccessMsg(c, "ok", ap)
}

func (h *Handlers) coachingTeacherEnd(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var ap models.CoachingAppointment
	if err := db.Where("id = ? AND is_deleted = 0", id).First(&ap).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "msg": "排课不存在"})
		return
	}
	if coachingIsTeacherRole(user) && !user.IsAdmin() && ap.TeacherID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "无权操作此排课"})
		return
	}

	rec, apCompleted, err := coachingCompleteAppointment(db, uint(id), time.Now(), c, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	response.SuccessMsg(c, "ok", gin.H{"session": rec, "appointment": apCompleted})
}

type coachingPracticeStartBody struct {
	StudentID      uint `json:"studentId" binding:"required"`
	PlannedMinutes int  `json:"plannedMinutes"` // 计划练习分钟，默认 45，范围 1–180
}

// coachingTeacherStartPractice 无排课练习开课：为所选学员创建临时课次并立即开始，结束时走普通下课扣额度。
func (h *Handlers) coachingTeacherStartPractice(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}
	var body coachingPracticeStartBody
	if err := c.ShouldBindJSON(&body); err != nil || body.StudentID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请选择学员"})
		return
	}
	planned := body.PlannedMinutes
	if planned <= 0 {
		planned = 45
	}
	if planned > 180 {
		planned = 180
	}

	if err := coachingTeacherHasStudentPair(db, tid, body.StudentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请先添加该学员后再练习"})
		return
	}
	q, err := coachingGetQuota(db, tid, body.StudentID)
	if errors.Is(err, gorm.ErrRecordNotFound) || q.RemainingMinutes <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "陪练剩余时长不足，无法开始练习"})
		return
	}
	if err != nil {
		response.Fail(c, "查询额度失败", err.Error())
		return
	}

	now := time.Now().In(time.Local)
	if err := coachingTeacherPoolAllowsStart(db, tid); err != nil {
		if errors.Is(err, errCoachingTeacherPoolEmpty) {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
			return
		}
		response.Fail(c, "查询老师计量失败", err.Error())
		return
	}

	// 已有进行中课次：同学员复用；其他学员则提示先下课
	var inProgress []models.CoachingAppointment
	if err := db.Where("is_deleted = 0 AND teacher_id = ? AND status = ?", tid, models.CoachingStatusInProgress).
		Find(&inProgress).Error; err != nil {
		response.Fail(c, "查询上课中课次失败", err.Error())
		return
	}
	for i := range inProgress {
		ap := inProgress[i]
		if ap.StudentID == body.StudentID {
			_ = db.Preload("Teacher").Preload("Student").First(&ap, ap.ID).Error
			dto := coachingToWeekDTO([]models.CoachingAppointment{ap})
			var out any
			if len(dto) > 0 {
				out = dto[0]
			} else {
				out = ap
			}
			response.SuccessMsg(c, "ok", gin.H{
				"appointment":   out,
				"appointmentId": ap.ID,
				"studentId":     ap.StudentID,
				"owned":         false,
				"reused":        true,
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "当前已有其他学员的上课中课次，请先结束后再开始练习",
		})
		return
	}

	endAt := now.Add(time.Duration(planned) * time.Minute)
	startHm := now.Format("15:04")
	endHm := endAt.Format("15:04")
	if endAt.Day() != now.Day() || endHm <= startHm {
		endHm = "23:59"
	}
	dur, err := models.CoachingDurationMinutes(startHm, endHm)
	if err != nil || dur < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "练习时段无效"})
		return
	}

	title := "单词练习"
	ap := models.CoachingAppointment{
		TeacherID: tid, StudentID: body.StudentID,
		ScheduledDate:   coachingDateOnly(now),
		StartTime:       startHm,
		EndTime:         endHm,
		DurationMinutes: dur,
		Status:          models.CoachingStatusInProgress,
		Title:           title,
		Notes:           "practice",
		ActualStartedAt: &now,
	}
	// 练习课次不与已有「已排定」课表做冲突拦截（否则临近有排课就无法练习），
	// 仅上面已拦截「上课中」冲突。
	if err := db.Create(&ap).Error; err != nil {
		response.Fail(c, "创建练习课次失败", err.Error())
		return
	}
	_ = db.Preload("Teacher").Preload("Student").First(&ap, ap.ID).Error
	coachingWriteCoachingAudit(db, c, coachingAuditSessionStart, "appointment", ap.ID, ap.ID, "无排课练习开课", map[string]any{
		"teacherId": ap.TeacherID, "studentId": ap.StudentID,
		"plannedMinutes": planned, "practice": true,
	})
	dto := coachingToWeekDTO([]models.CoachingAppointment{ap})
	var out any
	if len(dto) > 0 {
		out = dto[0]
	} else {
		out = ap
	}
	response.SuccessMsg(c, "ok", gin.H{
		"appointment":   out,
		"appointmentId": ap.ID,
		"studentId":     ap.StudentID,
		"owned":         true,
		"reused":        false,
	})
}
