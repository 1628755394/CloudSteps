package models

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

// ErrInvalidCoachingTime 时间格式或区间不合法
var ErrInvalidCoachingTime = errors.New("invalid coaching time")

// 排课状态
const (
	CoachingStatusScheduled  = "scheduled"
	CoachingStatusInProgress = "in_progress"
	CoachingStatusCompleted  = "completed"
	CoachingStatusCancelled  = "cancelled"
	CoachingStatusNoShow     = "no_show"
)

const (
	CoachingSessionStatusCompleted = "completed"
	// SignupTeachingPoolMinutes 新老师注册赠送的可授课总时长（分钟，跨学员合计）。
	SignupTeachingPoolMinutes = 1000
)

// StudentTeacherCoachingQuota 学员在某老师名下的陪练剩余时长（分钟）
type StudentTeacherCoachingQuota struct {
	BaseModel
	TeacherID             uint  `json:"teacherId" gorm:"uniqueIndex:idx_coach_quota_pair;not null;index"`
	StudentID             uint  `json:"studentId" gorm:"uniqueIndex:idx_coach_quota_pair;not null;index"`
	RemainingMinutes      int   `json:"remainingMinutes" gorm:"not null;default:0"`
	TotalAllocatedMinutes int   `json:"totalAllocatedMinutes" gorm:"not null;default:0"`
	Version               int   `json:"version" gorm:"not null;default:0"`
	Teacher               *User `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
	Student               *User `json:"student,omitempty" gorm:"foreignKey:StudentID"`
}

func (StudentTeacherCoachingQuota) TableName() string { return "student_teacher_coaching_quotas" }

// IsSelfCoachingPair 历史误建的自关联额度（teacher_id = student_id），不应出现在学员列表。
func IsSelfCoachingPair(teacherID, studentID uint) bool {
	return teacherID > 0 && teacherID == studentID
}

func cleanupSelfPairCoachingQuota(db *gorm.DB, teacherID uint) error {
	res := db.Model(&StudentTeacherCoachingQuota{}).
		Where("teacher_id = ? AND student_id = ? AND is_deleted = ?", teacherID, teacherID, SoftDeleteStatusActive).
		Updates(map[string]any{"is_deleted": SoftDeleteStatusDeleted})
	return res.Error
}

// clearCoachingBalancesInTx zeros remaining coaching minutes/pool for a user before soft-delete.
func clearCoachingBalancesInTx(tx *gorm.DB, userID uint, operator string) error {
	if tx == nil || userID == 0 {
		return nil
	}
	quotaZero := map[string]any{
		"remaining_minutes":       0,
		"total_allocated_minutes": 0,
		"update_by":               operator,
	}
	if err := tx.Model(&StudentTeacherCoachingQuota{}).
		Where("(teacher_id = ? OR student_id = ?) AND is_deleted = ?", userID, userID, SoftDeleteStatusActive).
		Updates(quotaZero).Error; err != nil {
		return err
	}
	poolZero := map[string]any{
		"remaining_minutes":       0,
		"total_allocated_minutes": 0,
		"update_by":               operator,
	}
	return tx.Model(&TeacherTeachingPool{}).
		Where("teacher_id = ? AND is_deleted = ?", userID, SoftDeleteStatusActive).
		Updates(poolZero).Error
}

// TeacherTeachingPool 老师可授课总池（跨学员合计扣减，非按月）。
type TeacherTeachingPool struct {
	BaseModel
	TeacherID             uint  `json:"teacherId" gorm:"uniqueIndex:idx_teacher_pool_teacher;not null"`
	RemainingMinutes      int   `json:"remainingMinutes" gorm:"not null;default:0"`
	TotalAllocatedMinutes int   `json:"totalAllocatedMinutes" gorm:"not null;default:0"`
	Version               int   `json:"version" gorm:"not null;default:0"`
	Teacher               *User `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
}

func (TeacherTeachingPool) TableName() string { return "teacher_teaching_pools" }

// EnsureTeacherTeachingPool 确保老师授课池行存在（默认 0，不自动赠送）。
func EnsureTeacherTeachingPool(db *gorm.DB, teacherID uint) (*TeacherTeachingPool, error) {
	if db == nil || teacherID == 0 {
		return nil, nil
	}
	var row TeacherTeachingPool
	err := db.Where("teacher_id = ? AND is_deleted = ?", teacherID, SoftDeleteStatusActive).First(&row).Error
	if err == nil {
		return &row, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	row = TeacherTeachingPool{
		TeacherID:             teacherID,
		RemainingMinutes:      0,
		TotalAllocatedMinutes: 0,
	}
	if err := db.Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// GrantSignupTeacherTeachingPool 注册赠送：可授课总池 +SignupTeachingPoolMinutes（一次性，非按月）。
func GrantSignupTeacherTeachingPool(db *gorm.DB, teacherID uint) error {
	if db == nil || teacherID == 0 {
		return nil
	}
	if err := cleanupSelfPairCoachingQuota(db, teacherID); err != nil {
		return err
	}
	row, err := EnsureTeacherTeachingPool(db, teacherID)
	if err != nil {
		return err
	}
	if row == nil {
		return nil
	}
	if row.TotalAllocatedMinutes >= SignupTeachingPoolMinutes {
		return nil
	}
	add := SignupTeachingPoolMinutes - row.TotalAllocatedMinutes
	if add <= 0 {
		return nil
	}
	return db.Model(row).Updates(map[string]any{
		"remaining_minutes":       row.RemainingMinutes + add,
		"total_allocated_minutes": row.TotalAllocatedMinutes + add,
	}).Error
}

// RepairTeacherCoachingRelations 清理历史误数据并确保授课池行存在（不赠送分钟）。
func RepairTeacherCoachingRelations(db *gorm.DB, teacherID uint) error {
	if err := cleanupSelfPairCoachingQuota(db, teacherID); err != nil {
		return err
	}
	_, err := EnsureTeacherTeachingPool(db, teacherID)
	return err
}

// GrantSignupTeacherTeachingCap 兼容旧名。
func GrantSignupTeacherTeachingCap(db *gorm.DB, teacherID uint) error {
	return GrantSignupTeacherTeachingPool(db, teacherID)
}

// GrantSignupCoachingQuota 兼容旧名。
func GrantSignupCoachingQuota(db *gorm.DB, userID uint) error {
	return GrantSignupTeacherTeachingPool(db, userID)
}

// TeacherCoachingUsagePeriod 老师按周期的已上分钟数（计费计量，仅统计）
type TeacherCoachingUsagePeriod struct {
	BaseModel
	TeacherID   uint      `json:"teacherId" gorm:"uniqueIndex:idx_coach_usage_period;not null;index"`
	PeriodStart time.Time `json:"periodStart" gorm:"uniqueIndex:idx_coach_usage_period;type:date;not null"`
	PeriodEnd   time.Time `json:"periodEnd" gorm:"type:date;not null"` // 周期结束日（不含当日或文档约定）
	UsedMinutes int       `json:"usedMinutes" gorm:"not null;default:0"`
	CapMinutes  int       `json:"capMinutes" gorm:"not null;default:0"` // 0 表示不限制
	Teacher     *User     `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
}

func (TeacherCoachingUsagePeriod) TableName() string { return "teacher_coaching_usage_periods" }

// CoachingAppointment 一对一排课
type CoachingAppointment struct {
	BaseModel
	TeacherID       uint       `json:"teacherId" gorm:"index;not null"`
	StudentID       uint       `json:"studentId" gorm:"index;not null"`
	ScheduledDate   time.Time  `json:"scheduledDate" gorm:"index;not null;type:date"`
	StartTime       string     `json:"startTime" gorm:"size:8;not null"` // HH:MM
	EndTime         string     `json:"endTime" gorm:"size:8;not null"`
	DurationMinutes int        `json:"durationMinutes" gorm:"not null;default:0"`
	Status          string     `json:"status" gorm:"size:32;not null;index;default:'scheduled'"`
	Title           string     `json:"title" gorm:"size:256"`
	Notes           string     `json:"notes" gorm:"type:text"`
	ActualStartedAt *time.Time `json:"actualStartedAt,omitempty"` // 老师点击「开始上课」
	Teacher         *User      `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
	Student         *User      `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	Session         *CoachingSessionRecord `json:"session,omitempty" gorm:"foreignKey:AppointmentID"`
}

func (CoachingAppointment) TableName() string { return "coaching_appointments" }

// CoachingSessionRecord 完课记录（actual / billed 分钟）
type CoachingSessionRecord struct {
	BaseModel
	AppointmentID  uint      `json:"appointmentId" gorm:"uniqueIndex;not null"`
	TeacherID      uint      `json:"teacherId" gorm:"index;not null"`
	StudentID      uint      `json:"studentId" gorm:"index;not null"`
	StartedAt      time.Time `json:"startedAt" gorm:"not null"`
	EndedAt        time.Time `json:"endedAt" gorm:"not null"`
	ActualMinutes           int `json:"actualMinutes" gorm:"not null"`
	BilledMinutes           int `json:"billedMinutes" gorm:"not null"` // 从学员剩余中扣减的分钟
	TeacherCreditedMinutes  int `json:"teacherCreditedMinutes" gorm:"not null;default:0"` // 计入老师周期用量的分钟（受 cap 截断时可能 < BilledMinutes）
	Status                  string `json:"status" gorm:"size:32;not null;default:'completed'"`
	Appointment    *CoachingAppointment `json:"appointment,omitempty" gorm:"foreignKey:AppointmentID"`
}

func (CoachingSessionRecord) TableName() string { return "coaching_session_records" }

// CoachingAuditLog 陪练模块操作审计（追加写入）
type CoachingAuditLog struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	CreatedAt     time.Time `json:"createdAt" gorm:"index"`
	ActorID       uint      `json:"actorId" gorm:"index"`
	ActorUsername string    `json:"actorUsername" gorm:"size:128"`
	ActorRole     string    `json:"actorRole" gorm:"size:32"`
	Action        string    `json:"action" gorm:"size:64;index"`
	TargetType    string    `json:"targetType" gorm:"size:32"`
	TargetID      uint      `json:"targetId" gorm:"index"`
	AppointmentID uint      `json:"appointmentId" gorm:"index"`
	Summary       string    `json:"summary" gorm:"size:512"`
	DetailJSON    string    `json:"-" gorm:"type:text"`
	IP            string    `json:"ip,omitempty" gorm:"size:64"`
}

func (CoachingAuditLog) TableName() string { return "coaching_audit_logs" }

// ParseCoachingHM 解析 HH:MM 为当日从 00:00 起的分钟数
func ParseCoachingHM(s string) (int, error) {
	s = strings.TrimSpace(s)
	parts := strings.Split(s, ":")
	if len(parts) != 2 {
		return 0, ErrInvalidCoachingTime
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil || h < 0 || h > 23 {
		return 0, ErrInvalidCoachingTime
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil || m < 0 || m > 59 {
		return 0, ErrInvalidCoachingTime
	}
	return h*60 + m, nil
}

// CoachingSlotOverlap 同一天两段 [start1,end1) [start2,end2) 是否重叠（闭开区间按分钟）
func CoachingSlotOverlap(date1, date2 time.Time, startA, endA, startB, endB string) (bool, error) {
	y1, m1, d1 := date1.Date()
	y2, m2, d2 := date2.Date()
	if y1 != y2 || m1 != m2 || d1 != d2 {
		return false, nil
	}
	a1, err := ParseCoachingHM(startA)
	if err != nil {
		return false, err
	}
	a2, err := ParseCoachingHM(endA)
	if err != nil {
		return false, err
	}
	b1, err := ParseCoachingHM(startB)
	if err != nil {
		return false, err
	}
	b2, err := ParseCoachingHM(endB)
	if err != nil {
		return false, err
	}
	if a2 <= a1 || b2 <= b1 {
		return false, ErrInvalidCoachingTime
	}
	return a1 < b2 && b1 < a2, nil
}

// CoachingDurationMinutes 同日计划时长（分钟）
func CoachingDurationMinutes(start, end string) (int, error) {
	a1, err := ParseCoachingHM(start)
	if err != nil {
		return 0, err
	}
	a2, err := ParseCoachingHM(end)
	if err != nil {
		return 0, err
	}
	if a2 <= a1 {
		return 0, ErrInvalidCoachingTime
	}
	return a2 - a1, nil
}

// CoachingWeekMondaySunday 返回 date 所在周的周一 00:00 与周日 23:59:59（loc 本地）
func CoachingWeekMondaySunday(date time.Time, loc *time.Location) (monday, sunday time.Time) {
	if loc == nil {
		loc = time.Local
	}
	d := date.In(loc)
	wd := int(d.Weekday()) // Sun=0, Mon=1
	daysFromMonday := (wd + 6) % 7
	mon := d.AddDate(0, 0, -daysFromMonday)
	y, m, day := mon.Date()
	monday = time.Date(y, m, day, 0, 0, 0, 0, loc)
	sunday = monday.AddDate(0, 0, 6).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	return monday, sunday
}

// CoachingActualMinutesFloor 实际时长整分钟（向下取整）
func CoachingActualMinutesFloor(startedAt, endedAt time.Time) int {
	if !endedAt.After(startedAt) {
		return 0
	}
	return int(endedAt.Sub(startedAt) / time.Minute)
}

// CoachingAppointmentSlotBounds 排课计划起止时刻（本地时区）与计划分钟数
func CoachingAppointmentSlotBounds(ap *CoachingAppointment, loc *time.Location) (slotStart, slotEnd time.Time, plannedMinutes int, err error) {
	if ap == nil {
		return time.Time{}, time.Time{}, 0, ErrInvalidCoachingTime
	}
	if loc == nil {
		loc = time.Local
	}
	startMin, err := ParseCoachingHM(ap.StartTime)
	if err != nil {
		return time.Time{}, time.Time{}, 0, err
	}
	endMin, err := ParseCoachingHM(ap.EndTime)
	if err != nil {
		return time.Time{}, time.Time{}, 0, err
	}
	y, m, d := ap.ScheduledDate.In(loc).Date()
	slotStart = time.Date(y, m, d, startMin/60, startMin%60, 0, 0, loc)
	slotEnd = time.Date(y, m, d, endMin/60, endMin%60, 0, 0, loc)
	return slotStart, slotEnd, endMin - startMin, nil
}

// CoachingCanStartAt 校验排课时段配置是否有效。
// 允许提前/延后开始：不再限制必须落在 [start, end) 内。
func CoachingCanStartAt(ap *CoachingAppointment, now time.Time, loc *time.Location) error {
	_, _, _, err := CoachingAppointmentSlotBounds(ap, loc)
	return err
}

// CoachingEffectiveEndTime 完课时刻不超过排课结束时间
func CoachingEffectiveEndTime(ap *CoachingAppointment, endedAt time.Time, loc *time.Location) time.Time {
	_, slotEnd, _, err := CoachingAppointmentSlotBounds(ap, loc)
	if err != nil {
		return endedAt
	}
	endedAt = endedAt.In(loc)
	if endedAt.After(slotEnd) {
		return slotEnd
	}
	return endedAt
}

// CoachingBillingActualMinutes 计费实际分钟：按有效结束时刻计，且不超过计划时长
func CoachingBillingActualMinutes(ap *CoachingAppointment, startedAt, endedAt time.Time, loc *time.Location) int {
	effectiveEnd := CoachingEffectiveEndTime(ap, endedAt, loc)
	actual := CoachingActualMinutesFloor(startedAt, effectiveEnd)
	_, _, planned, err := CoachingAppointmentSlotBounds(ap, loc)
	if err != nil || planned <= 0 {
		return actual
	}
	if actual > planned {
		return planned
	}
	return actual
}
