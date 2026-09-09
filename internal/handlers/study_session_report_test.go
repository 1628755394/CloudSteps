package handlers

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupStudyReportDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.WordBook{},
		&models.StudySession{},
		&models.SessionWord{},
		&models.UserWordState{},
		&models.StudentTeacherCoachingQuota{},
	); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestBuildStudySessionReport_aggregatesMultipleRounds(t *testing.T) {
	db := setupStudyReportDB(t)
	teacher := &models.User{Username: "t-agg", Role: models.RoleTeacher}
	student := &models.User{Username: "s-agg", Role: models.RoleStudent}
	if err := db.Create(teacher).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(student).Error; err != nil {
		t.Fatal(err)
	}
	wb := &models.WordBook{Name: "CEFR A1", WordCount: 100}
	if err := db.Create(wb).Error; err != nil {
		t.Fatal(err)
	}

	start1 := time.Date(2026, 9, 8, 14, 0, 0, 0, time.UTC)
	end1 := start1.Add(20 * time.Minute)
	start2 := start1.Add(25 * time.Minute)
	end2 := start2.Add(15 * time.Minute)

	s1 := &models.StudySession{
		UserID: teacher.ID, StudentID: student.ID, WordBookID: wb.ID,
		SessionType: "learn", Status: "completed",
		StartedAt: start1, CompletedAt: &end1,
		WordCount: 10, CorrectCount: 8,
		ScreenedKnownCount: 0, ScreenedUnknownCount: 10,
	}
	s2 := &models.StudySession{
		UserID: teacher.ID, StudentID: student.ID, WordBookID: wb.ID,
		SessionType: "learn", Status: "completed",
		StartedAt: start2, CompletedAt: &end2,
		WordCount: 10, CorrectCount: 10,
		ScreenedKnownCount: 0, ScreenedUnknownCount: 10,
	}
	if err := db.Create(s1).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(s2).Error; err != nil {
		t.Fatal(err)
	}

	report := buildStudySessionReport(db, s2, s1)
	if report.ScreenedUnknownCount != 20 {
		t.Fatalf("screened unknown=%d want 20", report.ScreenedUnknownCount)
	}
	if report.WordCount != 20 {
		t.Fatalf("wordCount=%d want 20", report.WordCount)
	}
	if report.CorrectCount != 18 {
		t.Fatalf("correct=%d want 18", report.CorrectCount)
	}
	if report.ForgotCount != 2 {
		t.Fatalf("forgot=%d want 2", report.ForgotCount)
	}
	if report.DurationMinutes < 35 || report.DurationMinutes > 45 {
		t.Fatalf("duration=%d want ~40", report.DurationMinutes)
	}
}

func TestBuildStudySessionReport_learnedCountUsesStudentNotTeacher(t *testing.T) {
	db := setupStudyReportDB(t)
	teacher := &models.User{Username: "t-prog", Role: models.RoleTeacher}
	student := &models.User{Username: "andy", DisplayName: "Andy", Role: models.RoleStudent}
	if err := db.Create(teacher).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(student).Error; err != nil {
		t.Fatal(err)
	}
	wb := &models.WordBook{Name: "四级必备词汇", WordCount: 4509}
	if err := db.Create(wb).Error; err != nil {
		t.Fatal(err)
	}

	now := time.Now().UTC()
	for i := 0; i < 10; i++ {
		st := models.UserWordState{
			UserID: student.ID, WordBookID: wb.ID, WordID: uint(1000 + i),
			LearnStatus: "learned", ScreenResult: "unknown",
		}
		st.ID = uint(2000 + i)
		if err := db.Create(&st).Error; err != nil {
			t.Fatal(err)
		}
	}
	// Teacher has no learned words in this book — bug used to count teacher → 0.

	start := now.Add(-2 * time.Minute)
	end := now
	session := &models.StudySession{
		UserID: teacher.ID, StudentID: student.ID, WordBookID: wb.ID,
		SessionType: "learn", Status: "completed",
		StartedAt: start, CompletedAt: &end,
		WordCount: 10, CorrectCount: 10,
		ScreenedKnownCount: 0, ScreenedUnknownCount: 10,
	}
	if err := db.Create(session).Error; err != nil {
		t.Fatal(err)
	}

	report := buildStudySessionReport(db, session)
	if report.StudentName != "Andy" {
		t.Fatalf("studentName=%q want Andy", report.StudentName)
	}
	if report.WordBookWordCount != 4509 {
		t.Fatalf("wordBookWordCount=%d want 4509", report.WordBookWordCount)
	}
	if report.LearnedCount != 10 {
		t.Fatalf("learnedCount=%d want 10 (must use student word states, not teacher)", report.LearnedCount)
	}
	if report.RemainPending != 4509-10 {
		t.Fatalf("remainPending=%d want %d", report.RemainPending, 4509-10)
	}
}
