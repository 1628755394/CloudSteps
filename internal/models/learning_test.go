package models

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testLearningDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:learning_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&UserWordBook{}, &UserWordState{}, &ReviewQueue{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestUserWordBook_TableName(t *testing.T) {
	if (UserWordBook{}).TableName() != constants.TABLE_USER_WORD_BOOKS {
		t.Fatalf("UserWordBook table name = %q, want %q",
			(UserWordBook{}).TableName(), constants.TABLE_USER_WORD_BOOKS)
	}
}

func TestUserWordState_TableName(t *testing.T) {
	if (UserWordState{}).TableName() != constants.TABLE_USER_WORD_STATES {
		t.Fatalf("UserWordState table name = %q, want %q",
			(UserWordState{}).TableName(), constants.TABLE_USER_WORD_STATES)
	}
}

func TestReviewQueue_TableName(t *testing.T) {
	if (ReviewQueue{}).TableName() != constants.TABLE_REVIEW_QUEUE {
		t.Fatalf("ReviewQueue table name = %q, want %q",
			(ReviewQueue{}).TableName(), constants.TABLE_REVIEW_QUEUE)
	}
}

func TestUserWordBook_CRUDAndSoftDelete(t *testing.T) {
	db := testLearningDB(t)
	started := time.Now()
	uwb := &UserWordBook{
		UserID:          1,
		WordBookID:      2,
		Status:          "active",
		ScreenProgress:  3,
		ScreenCompleted: false,
		StartedAt:       &started,
	}
	if err := db.Create(uwb).Error; err != nil {
		t.Fatalf("create: %v", err)
	}
	if uwb.ID == 0 {
		t.Fatal("expected id assigned")
	}

	var got UserWordBook
	if err := db.First(&got, uwb.ID).Error; err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.UserID != 1 || got.WordBookID != 2 || got.ScreenProgress != 3 {
		t.Fatalf("unexpected: %+v", got)
	}

	if err := db.Model(&got).Update("screen_completed", true).Error; err != nil {
		t.Fatal(err)
	}
	var got2 UserWordBook
	if err := db.First(&got2, uwb.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !got2.ScreenCompleted {
		t.Fatal("expected screen completed true")
	}

	if err := db.Delete(&got2).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&got, uwb.ID).Error; err == nil {
		t.Fatal("expected soft-deleted hidden")
	}
	if err := db.Unscoped().First(&got, uwb.ID).Error; err != nil {
		t.Fatalf("unscoped find: %v", err)
	}
	if !got.DeletedAt.Valid {
		t.Fatal("expected deleted_at set")
	}
}

func TestUserWordState_CRUD(t *testing.T) {
	db := testLearningDB(t)
	now := time.Now()
	st := &UserWordState{
		UserID:         1,
		WordID:         10,
		WordBookID:     2,
		ScreenResult:   "pass",
		ScreenAt:       &now,
		LearnStatus:    "pending",
		ReviewStage:    0,
		FirstLearnedAt: &now,
	}
	if err := db.Create(st).Error; err != nil {
		t.Fatalf("create: %v", err)
	}
	var got UserWordState
	if err := db.First(&got, st.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.LearnStatus != "pending" {
		t.Fatalf("status = %q", got.LearnStatus)
	}
	if err := db.Model(&got).Update("learn_status", "learned").Error; err != nil {
		t.Fatal(err)
	}
	var got2 UserWordState
	if err := db.First(&got2, st.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got2.LearnStatus != "learned" {
		t.Fatalf("status = %q", got2.LearnStatus)
	}
}

func TestReviewQueue_CRUDAndSoftDelete(t *testing.T) {
	db := testLearningDB(t)
	due := time.Now().Add(time.Hour)
	rq := &ReviewQueue{
		UserID:          1,
		WordID:          10,
		WordBookID:      2,
		SourceSessionID: 99,
		DueAt:           due,
		Stage:           1,
		Status:          "pending",
	}
	if err := db.Create(rq).Error; err != nil {
		t.Fatalf("create: %v", err)
	}
	var got ReviewQueue
	if err := db.First(&got, rq.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.Stage != 1 || got.Status != "pending" {
		t.Fatalf("unexpected: %+v", got)
	}
	if err := db.Model(&got).Update("status", "done").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Delete(&got).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&got, rq.ID).Error; err == nil {
		t.Fatal("expected soft-deleted hidden")
	}
	if err := db.Unscoped().First(&got, rq.ID).Error; err != nil {
		t.Fatalf("unscoped find: %v", err)
	}
	if !got.DeletedAt.Valid {
		t.Fatal("expected deleted_at set")
	}
}
