package handlers

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupReviewBooksDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.WordBook{},
		&models.ReviewQueue{},
		&models.StudySession{},
		&models.SessionWord{},
		&models.UserWordState{},
		&models.CoachingAppointment{},
		&models.CoachingSessionRecord{},
		&models.StudentTeacherCoachingQuota{},
	); err != nil {
		t.Fatal(err)
	}
	return db
}

// 老师自练写入自己的队列，即使 study_session.student_id 指向学员，
// 抗遗忘也必须按 queue.user_id 归属老师——否则列表挂学员名、点开查学员空队列。
func TestReviewBooksByDate_attributesByQueueOwnerNotSessionStudent(t *testing.T) {
	db := setupReviewBooksDB(t)
	loc := time.FixedZone("CST", 8*3600)
	day := time.Date(2026, 9, 6, 0, 0, 0, 0, loc)
	dayEnd := day.Add(24 * time.Hour)
	started := time.Date(2026, 9, 6, 15, 58, 0, 0, loc)

	teacher := &models.User{}
	teacher.ID = 1001
	teacher.Username = "Teacher1"
	teacher.DisplayName = "Teacher 1"
	teacher.ReviewCurvePreset = "times5"
	if err := db.Create(teacher).Error; err != nil {
		t.Fatal(err)
	}
	student := &models.User{}
	student.ID = 11
	student.Username = "11"
	student.DisplayName = "11"
	student.ReviewCurvePreset = "times5"
	if err := db.Create(student).Error; err != nil {
		t.Fatal(err)
	}

	wb := &models.WordBook{}
	wb.ID = 50
	wb.Name = "小学考纲"
	wb.Level = "小学"
	if err := db.Create(wb).Error; err != nil {
		t.Fatal(err)
	}

	// 课次标记了学员，但队列仍在老师名下（线上真实脏数据形态）
	session := &models.StudySession{}
	session.ID = 9001
	session.UserID = teacher.ID
	session.StudentID = student.ID
	session.WordBookID = wb.ID
	session.SessionType = "learn"
	session.Status = "completed"
	session.StartedAt = started
	session.WordCount = 5
	if err := db.Create(session).Error; err != nil {
		t.Fatal(err)
	}

	due := day
	for _, wid := range []uint{1, 2, 3, 4, 5} {
		if err := db.Create(&models.ReviewQueue{
			UserID:          teacher.ID,
			WordID:          wid,
			WordBookID:      wb.ID,
			SourceSessionID: session.ID,
			DueAt:           due,
			Stage:           0,
			Status:          "pending",
		}).Error; err != nil {
			t.Fatal(err)
		}
		learned := started
		if err := db.Create(&models.UserWordState{
			UserID:         teacher.ID,
			WordID:         wid,
			WordBookID:     wb.ID,
			LearnStatus:    "learned",
			FirstLearnedAt: &learned,
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	stats, err := reviewBooksByDateForUsers(db, []uint{teacher.ID, student.ID}, day, dayEnd, loc, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(stats) != 1 {
		t.Fatalf("stats len=%d want 1; %+v", len(stats), stats)
	}
	if stats[0].StudentID != teacher.ID {
		t.Fatalf("attributed studentId=%d want teacher %d (queue owner)", stats[0].StudentID, teacher.ID)
	}
	if stats[0].Count != 5 {
		t.Fatalf("count=%d want 5", stats[0].Count)
	}
}

func TestReviewBooksByDate_keepsExplicitCoachingStudent(t *testing.T) {
	db := setupReviewBooksDB(t)
	loc := time.FixedZone("CST", 8*3600)
	day := time.Date(2026, 9, 6, 0, 0, 0, 0, loc)
	dayEnd := day.Add(24 * time.Hour)
	started := time.Date(2026, 9, 6, 15, 58, 0, 0, loc)

	teacher := &models.User{}
	teacher.ID = 1001
	teacher.Username = "Teacher1"
	teacher.DisplayName = "Teacher 1"
	teacher.ReviewCurvePreset = "times5"
	if err := db.Create(teacher).Error; err != nil {
		t.Fatal(err)
	}
	student := &models.User{}
	student.ID = 11
	student.Username = "11"
	student.DisplayName = "11"
	student.ReviewCurvePreset = "times5"
	if err := db.Create(student).Error; err != nil {
		t.Fatal(err)
	}

	wb := &models.WordBook{}
	wb.ID = 50
	wb.Name = "小学考纲"
	if err := db.Create(wb).Error; err != nil {
		t.Fatal(err)
	}

	session := &models.StudySession{}
	session.ID = 9002
	session.UserID = teacher.ID
	session.StudentID = student.ID
	session.WordBookID = wb.ID
	session.SessionType = "learn"
	session.Status = "completed"
	session.StartedAt = started
	session.WordCount = 5
	if err := db.Create(session).Error; err != nil {
		t.Fatal(err)
	}

	due := day
	for _, wid := range []uint{10, 11, 12, 13, 14} {
		if err := db.Create(&models.ReviewQueue{
			UserID:          student.ID, // 代练：队列在学员名下
			WordID:          wid,
			WordBookID:      wb.ID,
			SourceSessionID: session.ID,
			DueAt:           due,
			Stage:           0,
			Status:          "pending",
		}).Error; err != nil {
			t.Fatal(err)
		}
		learned := started
		if err := db.Create(&models.UserWordState{
			UserID:         student.ID,
			WordID:         wid,
			WordBookID:     wb.ID,
			LearnStatus:    "learned",
			FirstLearnedAt: &learned,
		}).Error; err != nil {
			t.Fatal(err)
		}
	}

	stats, err := reviewBooksByDateForUsers(db, []uint{teacher.ID, student.ID}, day, dayEnd, loc, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(stats) != 1 {
		t.Fatalf("stats len=%d want 1; %+v", len(stats), stats)
	}
	if stats[0].StudentID != student.ID {
		t.Fatalf("studentId=%d want %d", stats[0].StudentID, student.ID)
	}
	if stats[0].Count != 5 {
		t.Fatalf("count=%d want 5", stats[0].Count)
	}
}
