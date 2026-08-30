package models

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testStudySessionsDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:studysessions_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&StudySession{}, &SessionWord{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestStudySession_TableName(t *testing.T) {
	if (StudySession{}).TableName() != constants.TABLE_STUDY_SESSIONS {
		t.Fatalf("StudySession table name = %q, want %q",
			(StudySession{}).TableName(), constants.TABLE_STUDY_SESSIONS)
	}
}

func TestSessionWord_TableName(t *testing.T) {
	if (SessionWord{}).TableName() != constants.TABLE_SESSION_WORDS {
		t.Fatalf("SessionWord table name = %q, want %q",
			(SessionWord{}).TableName(), constants.TABLE_SESSION_WORDS)
	}
}

func TestStudySession_CRUDAndSoftDelete(t *testing.T) {
	db := testStudySessionsDB(t)
	started := time.Now()
	s := &StudySession{
		UserID:       1,
		WordBookID:   2,
		SessionType:  "screening",
		Status:       "in_progress",
		StartedAt:    started,
		WordCount:    10,
		CorrectCount: 0,
	}
	if err := db.Create(s).Error; err != nil {
		t.Fatalf("create session: %v", err)
	}
	if s.ID == 0 {
		t.Fatal("expected id assigned")
	}

	var got StudySession
	if err := db.First(&got, s.ID).Error; err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.SessionType != "screening" || got.Status != "in_progress" {
		t.Fatalf("unexpected: %+v", got)
	}

	// Complete the session
	completed := time.Now()
	if err := db.Model(&got).Updates(map[string]interface{}{
		"status":        "completed",
		"completed_at":  completed,
		"correct_count": 8,
	}).Error; err != nil {
		t.Fatal(err)
	}
	var got2 StudySession
	if err := db.First(&got2, s.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got2.Status != "completed" || got2.CorrectCount != 8 {
		t.Fatalf("unexpected: %+v", got2)
	}
	if got2.CompletedAt == nil || got2.CompletedAt.IsZero() {
		t.Fatal("expected completed_at set")
	}

	// Soft delete
	if err := db.Delete(&got2).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&got, s.ID).Error; err == nil {
		t.Fatal("expected soft-deleted hidden")
	}
	if err := db.Unscoped().First(&got, s.ID).Error; err != nil {
		t.Fatalf("unscoped find: %v", err)
	}
	if !got.DeletedAt.Valid {
		t.Fatal("expected deleted_at set")
	}
}

func TestSessionWord_CRUDAndUniqueConstraint(t *testing.T) {
	db := testStudySessionsDB(t)
	started := time.Now()
	s := &StudySession{UserID: 1, WordBookID: 2, SessionType: "learn", Status: "in_progress", StartedAt: started}
	if err := db.Create(s).Error; err != nil {
		t.Fatal(err)
	}

	answered := time.Now()
	remembered := true
	sw := &SessionWord{
		SessionID:  s.ID,
		WordID:     100,
		Remembered: &remembered,
		AnsweredAt: &answered,
	}
	if err := db.Create(sw).Error; err != nil {
		t.Fatalf("create session word: %v", err)
	}

	var got SessionWord
	if err := db.First(&got, sw.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.SessionID != s.ID || got.WordID != 100 {
		t.Fatalf("unexpected: %+v", got)
	}
	if got.Remembered == nil || !*got.Remembered {
		t.Fatal("expected remembered true")
	}

	// Unique constraint on (session_id, word_id)
	remembered2 := false
	dup := &SessionWord{SessionID: s.ID, WordID: 100, Remembered: &remembered2}
	if err := db.Create(dup).Error; err == nil {
		t.Fatal("expected unique constraint on (session_id, word_id)")
	}

	// Soft delete
	if err := db.Delete(&got).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&got, sw.ID).Error; err == nil {
		t.Fatal("expected soft-deleted hidden")
	}
	if err := db.Unscoped().First(&got, sw.ID).Error; err != nil {
		t.Fatalf("unscoped find: %v", err)
	}
	if !got.DeletedAt.Valid {
		t.Fatal("expected deleted_at set")
	}
}
