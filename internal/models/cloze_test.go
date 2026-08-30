package models

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testClozeDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:cloze_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&ClozePassage{}, &ClozeBlank{}, &ClozeRecord{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestClozePassage_TableName(t *testing.T) {
	if (ClozePassage{}).TableName() != constants.TABLE_CLOZE_PASSAGES {
		t.Fatalf("ClozePassage table name = %q, want %q", (ClozePassage{}).TableName(), constants.TABLE_CLOZE_PASSAGES)
	}
}

func TestClozeBlank_TableName(t *testing.T) {
	if (ClozeBlank{}).TableName() != constants.TABLE_CLOZE_BLANKS {
		t.Fatalf("ClozeBlank table name = %q, want %q", (ClozeBlank{}).TableName(), constants.TABLE_CLOZE_BLANKS)
	}
}

func TestClozeRecord_TableName(t *testing.T) {
	if (ClozeRecord{}).TableName() != constants.TABLE_CLOZE_RECORDS {
		t.Fatalf("ClozeRecord table name = %q, want %q", (ClozeRecord{}).TableName(), constants.TABLE_CLOZE_RECORDS)
	}
}

func TestClozePassage_CRUD(t *testing.T) {
	db := testClozeDB(t)

	p := &ClozePassage{
		Title:            "完形填空一",
		Level:            "初阶",
		Content:          "It {{1}} a good day. She {{2}} happy.",
		Summary:          "summary",
		Status:           ClozeStatusDraft,
		BlankCount:       2,
		EstimatedMinutes: 5,
		SortOrder:        1,
	}
	if err := db.Create(p).Error; err != nil {
		t.Fatalf("create passage: %v", err)
	}
	if p.ID == 0 {
		t.Fatal("expected id assigned")
	}

	var got ClozePassage
	if err := db.First(&got, p.ID).Error; err != nil {
		t.Fatalf("find passage: %v", err)
	}
	if got.Title != p.Title || got.BlankCount != 2 {
		t.Fatalf("unexpected passage: %+v", got)
	}

	// Update
	if err := db.Model(&got).Update("status", ClozeStatusPublished).Error; err != nil {
		t.Fatalf("update passage: %v", err)
	}
	var got2 ClozePassage
	if err := db.First(&got2, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got2.Status != ClozeStatusPublished {
		t.Fatalf("status = %q, want %q", got2.Status, ClozeStatusPublished)
	}

	// Delete
	if err := db.Delete(&got2).Error; err != nil {
		t.Fatalf("delete passage: %v", err)
	}
	var got3 ClozePassage
	if err := db.First(&got3, p.ID).Error; err == nil {
		t.Fatal("expected soft-deleted passage to be hidden")
	}
	// Unscoped still present
	if err := db.Unscoped().First(&got3, p.ID).Error; err != nil {
		t.Fatalf("unscoped find: %v", err)
	}
	if !got3.DeletedAt.Valid {
		t.Fatal("expected deleted_at set")
	}
}

func TestClozeBlank_CRUD(t *testing.T) {
	db := testClozeDB(t)
	p := &ClozePassage{Title: "p", Content: "x {{1}}", Status: ClozeStatusDraft}
	if err := db.Create(p).Error; err != nil {
		t.Fatal(err)
	}
	b := &ClozeBlank{
		PassageID:   p.ID,
		BlankNo:     1,
		Options:     `[{"key":"A","text":"is"},{"key":"B","text":"was"}]`,
		Answer:      "B",
		Explanation: "past tense",
	}
	if err := db.Create(b).Error; err != nil {
		t.Fatalf("create blank: %v", err)
	}
	var blanks []ClozeBlank
	if err := db.Where("passage_id = ?", p.ID).Find(&blanks).Error; err != nil {
		t.Fatal(err)
	}
	if len(blanks) != 1 || blanks[0].Answer != "B" {
		t.Fatalf("unexpected blanks: %+v", blanks)
	}
}

func TestClozeRecord_CRUDAndSoftDelete(t *testing.T) {
	db := testClozeDB(t)
	p := &ClozePassage{Title: "p", Content: "x {{1}}", Status: ClozeStatusDraft}
	if err := db.Create(p).Error; err != nil {
		t.Fatal(err)
	}
	completed := time.Now()
	r := &ClozeRecord{
		UserID:       11,
		PassageID:    p.ID,
		Answers:      `{"1":"B"}`,
		BlankCount:   2,
		CorrectCount: 1,
		Score:        50,
		DurationSec:  30,
		IsLatest:     true,
		CompletedAt:  &completed,
	}
	if err := db.Create(r).Error; err != nil {
		t.Fatalf("create record: %v", err)
	}

	var got ClozeRecord
	if err := db.First(&got, r.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.Score != 50 || !got.IsLatest {
		t.Fatalf("unexpected record: %+v", got)
	}

	// Soft delete
	if err := db.Delete(&got).Error; err != nil {
		t.Fatal(err)
	}
	var after ClozeRecord
	if err := db.First(&after, r.ID).Error; err == nil {
		t.Fatal("expected record hidden after soft delete")
	}
	if err := db.Unscoped().First(&after, r.ID).Error; err != nil {
		t.Fatalf("unscoped find: %v", err)
	}
	if !after.DeletedAt.Valid {
		t.Fatal("expected deleted_at set")
	}
}
