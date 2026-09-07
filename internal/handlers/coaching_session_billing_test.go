package handlers

import (
	"errors"
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCoachingBillingDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.StudentTeacherCoachingQuota{},
		&models.TeacherTeachingPool{},
		&models.TeacherCoachingUsagePeriod{},
		&models.CoachingAppointment{},
		&models.CoachingSessionRecord{},
		&models.CoachingAuditLog{},
	); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestCoachingComplete_onlyDebitsTeacherPool(t *testing.T) {
	db := setupCoachingBillingDB(t)
	teacher := &models.User{Username: "t-bill", Role: models.RoleTeacher}
	student := &models.User{Username: "s-bill", Role: models.RoleStudent}
	if err := db.Create(teacher).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(student).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.StudentTeacherCoachingQuota{
		TeacherID: teacher.ID, StudentID: student.ID,
		RemainingLessons: 5, TotalAllocatedLessons: 5,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.TeacherTeachingPool{
		TeacherID: teacher.ID, RemainingMinutes: 100, TotalAllocatedMinutes: 100,
	}).Error; err != nil {
		t.Fatal(err)
	}

	loc := time.Local
	day := time.Now().In(loc)
	start := time.Date(day.Year(), day.Month(), day.Day(), 10, 0, 0, 0, loc)
	ap := models.CoachingAppointment{
		TeacherID: teacher.ID, StudentID: student.ID,
		ScheduledDate: start, StartTime: "10:00", EndTime: "11:00",
		DurationMinutes: 60, Status: models.CoachingStatusInProgress,
		ActualStartedAt: &start, Title: "正式排课",
	}
	if err := db.Create(&ap).Error; err != nil {
		t.Fatal(err)
	}

	ended := start.Add(30 * time.Minute)
	rec, _, err := coachingCompleteAppointment(db, ap.ID, ended, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if rec.TeacherCreditedMinutes <= 0 {
		t.Fatalf("expected teacher minutes credited, got %+v", rec)
	}
	if rec.StudentLessonsBilled != 0 {
		t.Fatalf("complete must not bill student lessons, got %d", rec.StudentLessonsBilled)
	}

	var q models.StudentTeacherCoachingQuota
	_ = db.Where("teacher_id = ? AND student_id = ?", teacher.ID, student.ID).First(&q).Error
	if q.RemainingLessons != 5 {
		t.Fatalf("student lessons should stay 5, got %d", q.RemainingLessons)
	}
	var pool models.TeacherTeachingPool
	_ = db.Where("teacher_id = ?", teacher.ID).First(&pool).Error
	if pool.RemainingMinutes != 100-rec.TeacherCreditedMinutes {
		t.Fatalf("pool remaining=%d want %d", pool.RemainingMinutes, 100-rec.TeacherCreditedMinutes)
	}
}

func TestCoachingConsumeStudentLesson_scheduledOnly(t *testing.T) {
	db := setupCoachingBillingDB(t)
	teacher := &models.User{Username: "t-les", Role: models.RoleTeacher}
	student := &models.User{Username: "s-les", Role: models.RoleStudent}
	if err := db.Create(teacher).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(student).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.StudentTeacherCoachingQuota{
		TeacherID: teacher.ID, StudentID: student.ID,
		RemainingLessons: 3, TotalAllocatedLessons: 3,
	}).Error; err != nil {
		t.Fatal(err)
	}

	loc := time.Local
	day := time.Now().In(loc)
	start := time.Date(day.Year(), day.Month(), day.Day(), 14, 0, 0, 0, loc)
	ap := models.CoachingAppointment{
		TeacherID: teacher.ID, StudentID: student.ID,
		ScheduledDate: start, StartTime: "14:00", EndTime: "15:00",
		DurationMinutes: 60, Status: models.CoachingStatusInProgress,
		ActualStartedAt: &start, Title: "排课",
	}
	if err := db.Create(&ap).Error; err != nil {
		t.Fatal(err)
	}

	updated, err := coachingConsumeStudentLesson(db, ap.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if updated.StudentLessonsBilled != 1 {
		t.Fatalf("billed=%d", updated.StudentLessonsBilled)
	}
	var q models.StudentTeacherCoachingQuota
	_ = db.Where("teacher_id = ? AND student_id = ?", teacher.ID, student.ID).First(&q).Error
	if q.RemainingLessons != 2 {
		t.Fatalf("lessons=%d want 2", q.RemainingLessons)
	}

	// idempotent
	_, err = coachingConsumeStudentLesson(db, ap.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	_ = db.Where("teacher_id = ? AND student_id = ?", teacher.ID, student.ID).First(&q).Error
	if q.RemainingLessons != 2 {
		t.Fatalf("after second consume lessons=%d want 2", q.RemainingLessons)
	}
}

func TestCoachingConsumeStudentLesson_practiceRejected(t *testing.T) {
	db := setupCoachingBillingDB(t)
	teacher := &models.User{Username: "t-prac", Role: models.RoleTeacher}
	student := &models.User{Username: "s-prac", Role: models.RoleStudent}
	if err := db.Create(teacher).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(student).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.StudentTeacherCoachingQuota{
		TeacherID: teacher.ID, StudentID: student.ID,
		RemainingLessons: 3, TotalAllocatedLessons: 3,
	}).Error; err != nil {
		t.Fatal(err)
	}
	loc := time.Local
	day := time.Now().In(loc)
	start := time.Date(day.Year(), day.Month(), day.Day(), 16, 0, 0, 0, loc)
	ap := models.CoachingAppointment{
		TeacherID: teacher.ID, StudentID: student.ID,
		ScheduledDate: start, StartTime: "16:00", EndTime: "17:00",
		DurationMinutes: 60, Status: models.CoachingStatusInProgress,
		ActualStartedAt: &start, Notes: "practice", Title: "单词练习",
	}
	if err := db.Create(&ap).Error; err != nil {
		t.Fatal(err)
	}
	_, err := coachingConsumeStudentLesson(db, ap.ID, nil)
	if !errors.Is(err, errCoachingLessonNotEligible) {
		t.Fatalf("err=%v want not eligible", err)
	}
	var q models.StudentTeacherCoachingQuota
	_ = db.Where("teacher_id = ? AND student_id = ?", teacher.ID, student.ID).First(&q).Error
	if q.RemainingLessons != 3 {
		t.Fatalf("practice must not debit lessons, got %d", q.RemainingLessons)
	}
}
