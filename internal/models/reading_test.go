package models

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testReadingDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:reading_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&ReadingPassage{}, &ReadingQuestion{}, &ReadingRecord{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestReadingPassage_TableName(t *testing.T) {
	if (ReadingPassage{}).TableName() != constants.TABLE_READING_PASSAGES {
		t.Fatalf("ReadingPassage table name = %q, want %q",
			(ReadingPassage{}).TableName(), constants.TABLE_READING_PASSAGES)
	}
}

func TestReadingQuestion_TableName(t *testing.T) {
	if (ReadingQuestion{}).TableName() != constants.TABLE_READING_QUESTIONS {
		t.Fatalf("ReadingQuestion table name = %q, want %q",
			(ReadingQuestion{}).TableName(), constants.TABLE_READING_QUESTIONS)
	}
}

func TestReadingRecord_TableName(t *testing.T) {
	if (ReadingRecord{}).TableName() != constants.TABLE_READING_RECORDS {
		t.Fatalf("ReadingRecord table name = %q, want %q",
			(ReadingRecord{}).TableName(), constants.TABLE_READING_RECORDS)
	}
}

func TestReadingPassage_CRUD(t *testing.T) {
	db := testReadingDB(t)
	p := &ReadingPassage{
		Title:            "阅读一",
		Level:            "中阶",
		Content:          "This is a passage.",
		Summary:          "summary",
		Status:           ReadingStatusDraft,
		WordCount:        4,
		EstimatedMinutes: 5,
		SortOrder:        1,
	}
	if err := db.Create(p).Error; err != nil {
		t.Fatalf("create passage: %v", err)
	}
	if p.ID == 0 {
		t.Fatal("expected id assigned")
	}

	var got ReadingPassage
	if err := db.First(&got, p.ID).Error; err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.Title != p.Title || got.WordCount != 4 {
		t.Fatalf("unexpected: %+v", got)
	}

	if err := db.Model(&got).Update("status", ReadingStatusPublished).Error; err != nil {
		t.Fatal(err)
	}
	var got2 ReadingPassage
	if err := db.First(&got2, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got2.Status != ReadingStatusPublished {
		t.Fatalf("status = %q", got2.Status)
	}

	if err := db.Delete(&got2).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&got, p.ID).Error; err == nil {
		t.Fatal("expected soft-deleted hidden")
	}
	if err := db.Unscoped().First(&got, p.ID).Error; err != nil {
		t.Fatalf("unscoped find: %v", err)
	}
	if !got.DeletedAt.Valid {
		t.Fatal("expected deleted_at set")
	}
}

func TestReadingQuestion_CRUD(t *testing.T) {
	db := testReadingDB(t)
	p := &ReadingPassage{Title: "p", Content: "x", Status: ReadingStatusDraft}
	if err := db.Create(p).Error; err != nil {
		t.Fatal(err)
	}
	q := &ReadingQuestion{
		PassageID:   p.ID,
		Stem:        "What is the main idea?",
		Options:     `[{"key":"A","text":"x"},{"key":"B","text":"y"}]`,
		Answer:      "A",
		Explanation: "because",
		SortOrder:   1,
	}
	if err := db.Create(q).Error; err != nil {
		t.Fatalf("create question: %v", err)
	}
	var qs []ReadingQuestion
	if err := db.Where("passage_id = ?", p.ID).Find(&qs).Error; err != nil {
		t.Fatal(err)
	}
	if len(qs) != 1 || qs[0].Answer != "A" {
		t.Fatalf("unexpected: %+v", qs)
	}
}

func TestReadingRecord_CRUDAndSoftDelete(t *testing.T) {
	db := testReadingDB(t)
	p := &ReadingPassage{Title: "p", Content: "x", Status: ReadingStatusDraft}
	if err := db.Create(p).Error; err != nil {
		t.Fatal(err)
	}
	completed := time.Now()
	r := &ReadingRecord{
		UserID:        7,
		PassageID:     p.ID,
		Answers:       `{"0":"A"}`,
		QuestionCount: 1,
		CorrectCount:  0,
		Score:         0,
		DurationSec:   20,
		IsLatest:      true,
		CompletedAt:   &completed,
	}
	if err := db.Create(r).Error; err != nil {
		t.Fatalf("create record: %v", err)
	}
	var got ReadingRecord
	if err := db.First(&got, r.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.Score != 0 || !got.IsLatest {
		t.Fatalf("unexpected: %+v", got)
	}
	if err := db.Delete(&got).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&got, r.ID).Error; err == nil {
		t.Fatal("expected record hidden after soft delete")
	}
	if err := db.Unscoped().First(&got, r.ID).Error; err != nil {
		t.Fatalf("unscoped find: %v", err)
	}
	if !got.DeletedAt.Valid {
		t.Fatal("expected deleted_at set")
	}
}
