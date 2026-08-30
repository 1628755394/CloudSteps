package models

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testGrammarDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:grammar_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&GrammarLesson{}, &GrammarQuestion{}, &GrammarRecord{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestGrammarLesson_TableName(t *testing.T) {
	if (GrammarLesson{}).TableName() != constants.TABLE_GRAMMAR_LESSONS {
		t.Fatalf("GrammarLesson table name = %q, want %q",
			(GrammarLesson{}).TableName(), constants.TABLE_GRAMMAR_LESSONS)
	}
}

func TestGrammarQuestion_TableName(t *testing.T) {
	if (GrammarQuestion{}).TableName() != constants.TABLE_GRAMMAR_QUESTIONS {
		t.Fatalf("GrammarQuestion table name = %q, want %q",
			(GrammarQuestion{}).TableName(), constants.TABLE_GRAMMAR_QUESTIONS)
	}
}

func TestGrammarRecord_TableName(t *testing.T) {
	if (GrammarRecord{}).TableName() != constants.TABLE_GRAMMAR_RECORDS {
		t.Fatalf("GrammarRecord table name = %q, want %q",
			(GrammarRecord{}).TableName(), constants.TABLE_GRAMMAR_RECORDS)
	}
}

func TestGrammarLesson_CRUD(t *testing.T) {
	db := testGrammarDB(t)
	l := &GrammarLesson{
		Title:            "一般现在时",
		Topic:            "tense",
		Level:            "初阶",
		Explanation:      "subject + base verb",
		Examples:         `[{"en":"I run.","zh":"我跑。"}]`,
		Summary:          "summary",
		Status:           GrammarStatusDraft,
		EstimatedMinutes: 5,
		SortOrder:        1,
	}
	if err := db.Create(l).Error; err != nil {
		t.Fatalf("create lesson: %v", err)
	}
	if l.ID == 0 {
		t.Fatal("expected id assigned")
	}

	var got GrammarLesson
	if err := db.First(&got, l.ID).Error; err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.Title != l.Title || got.Topic != "tense" {
		t.Fatalf("unexpected: %+v", got)
	}

	if err := db.Model(&got).Update("status", GrammarStatusPublished).Error; err != nil {
		t.Fatal(err)
	}
	var got2 GrammarLesson
	if err := db.First(&got2, l.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got2.Status != GrammarStatusPublished {
		t.Fatalf("status = %q", got2.Status)
	}

	if err := db.Delete(&got2).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&got, l.ID).Error; err == nil {
		t.Fatal("expected soft-deleted lesson hidden")
	}
	if err := db.Unscoped().First(&got, l.ID).Error; err != nil {
		t.Fatalf("unscoped find: %v", err)
	}
	if !got.DeletedAt.Valid {
		t.Fatal("expected deleted_at set")
	}
}

func TestGrammarQuestion_CRUD(t *testing.T) {
	db := testGrammarDB(t)
	l := &GrammarLesson{Title: "l", Explanation: "x", Status: GrammarStatusDraft}
	if err := db.Create(l).Error; err != nil {
		t.Fatal(err)
	}
	q := &GrammarQuestion{
		LessonID:    l.ID,
		Stem:        "She ___ to school.",
		Options:     `[{"key":"A","text":"go"},{"key":"B","text":"goes"}]`,
		Answer:      "B",
		Explanation: "third person singular",
		SortOrder:   1,
	}
	if err := db.Create(q).Error; err != nil {
		t.Fatalf("create question: %v", err)
	}
	var qs []GrammarQuestion
	if err := db.Where("lesson_id = ?", l.ID).Order("sort_order ASC").Find(&qs).Error; err != nil {
		t.Fatal(err)
	}
	if len(qs) != 1 || qs[0].Answer != "B" {
		t.Fatalf("unexpected: %+v", qs)
	}
}

func TestGrammarRecord_CRUDAndSoftDelete(t *testing.T) {
	db := testGrammarDB(t)
	l := &GrammarLesson{Title: "l", Explanation: "x", Status: GrammarStatusDraft}
	if err := db.Create(l).Error; err != nil {
		t.Fatal(err)
	}
	completed := time.Now()
	r := &GrammarRecord{
		UserID:        5,
		LessonID:      l.ID,
		Answers:       `{"0":"B"}`,
		QuestionCount: 1,
		CorrectCount:  1,
		Score:         100,
		DurationSec:   12,
		IsLatest:      true,
		CompletedAt:   &completed,
	}
	if err := db.Create(r).Error; err != nil {
		t.Fatalf("create record: %v", err)
	}
	var got GrammarRecord
	if err := db.First(&got, r.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.Score != 100 || !got.IsLatest {
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
