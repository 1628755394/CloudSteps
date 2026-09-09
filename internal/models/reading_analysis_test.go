package models

import (
	"context"
	"errors"
	"strings"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testAnalysisDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:analysis_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := db.AutoMigrate(&ReadingPassage{}, &UserReadingPassage{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestSplitReadingSentences(t *testing.T) {
	got := SplitReadingSentences("Cats sleep. Dogs run! Birds fly?")
	if len(got) != 3 || got[0] != "Cats sleep." || got[2] != "Birds fly?" {
		t.Fatalf("%+v", got)
	}
}

func TestParseReadingAnalysisJSON(t *testing.T) {
	if items, err := ParseReadingAnalysisJSON(""); err != nil || items != nil {
		t.Fatalf("empty: %v %v", items, err)
	}
	items, err := ParseReadingAnalysisJSON(`[{
		"sentence":" Cats sleep. ",
		"translation":" 猫睡觉。 ",
		"components":[{"label":"主语","text":"Cats"},{"label":"","text":"x"}],
		"keyPhrases":[{"text":"sleep","explanation":"睡觉"},{"text":"","explanation":"x"}]
	},{"sentence":"","translation":"x"}]`)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Sentence != "Cats sleep." || items[0].Translation != "猫睡觉。" {
		t.Fatalf("%+v", items)
	}
	if len(items[0].Components) != 1 || items[0].Components[0].Label != "主语" {
		t.Fatalf("components %+v", items[0].Components)
	}
	if len(items[0].KeyPhrases) != 1 || items[0].KeyPhrases[0].Text != "sleep" {
		t.Fatalf("phrases %+v", items[0].KeyPhrases)
	}
	if !AnalysisJSONReady("[]") {
		t.Fatal("[] should count as generated")
	}
}

func TestEnsureReadingPassageAnalysis_cacheHit(t *testing.T) {
	db := testAnalysisDB(t)
	p := ReadingPassage{
		Title: "T", Content: "Hello world.", Status: ReadingStatusPublished,
		AnalysisJSON: `[{"sentence":"Hello world.","translation":"你好世界。","components":[],"keyPhrases":[]}]`,
	}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	calls := 0
	items, err := EnsureReadingPassageAnalysis(context.Background(), db, p.ID, func(context.Context, string, string) (string, error) {
		calls++
		return `[{"sentence":"new","translation":"x","components":[],"keyPhrases":[]}]`, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if calls != 0 {
		t.Fatalf("chat called %d", calls)
	}
	if len(items) != 1 || items[0].Sentence != "Hello world." {
		t.Fatalf("%+v", items)
	}
}

func TestEnsureReadingPassageAnalysis_generateAndStore(t *testing.T) {
	db := testAnalysisDB(t)
	p := ReadingPassage{Title: "Cats", Content: "Cats sleep a lot.", Status: ReadingStatusPublished}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	calls := 0
	items, err := EnsureReadingPassageAnalysis(context.Background(), db, p.ID, func(_ context.Context, system, user string) (string, error) {
		calls++
		if system == "" || !strings.Contains(user, "Cats sleep a lot.") {
			t.Fatalf("prompt missing content: %s", user)
		}
		return "```json\n[{\"sentence\":\"Cats sleep a lot.\",\"translation\":\"猫经常睡觉。\",\"components\":[{\"label\":\"主语\",\"text\":\"Cats\"}],\"keyPhrases\":[{\"text\":\"a lot\",\"explanation\":\"很多；经常\"}]}]\n```", nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 || len(items) != 1 || items[0].Translation != "猫经常睡觉。" {
		t.Fatalf("calls=%d items=%+v", calls, items)
	}
	var again ReadingPassage
	if err := db.First(&again, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !AnalysisJSONReady(again.AnalysisJSON) {
		t.Fatal("not stored")
	}
	items2, err := EnsureReadingPassageAnalysis(context.Background(), db, p.ID, func(context.Context, string, string) (string, error) {
		t.Fatal("should not regenerate")
		return "", errors.New("nope")
	})
	if err != nil || len(items2) != 1 {
		t.Fatalf("%v %+v", err, items2)
	}
}

func TestEnsureReadingPassageAnalysis_resumePartial(t *testing.T) {
	db := testAnalysisDB(t)
	p := ReadingPassage{
		Title: "T", Content: "One. Two.", Status: ReadingStatusPublished,
		AnalysisJSON: `[{"sentence":"One.","translation":"一。","components":[],"keyPhrases":[]}]`,
	}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	calls := 0
	items, err := EnsureReadingPassageAnalysis(context.Background(), db, p.ID, func(_ context.Context, _, user string) (string, error) {
		calls++
		if strings.Contains(user, "One.") {
			t.Fatalf("should only ask for missing: %s", user)
		}
		if !strings.Contains(user, "Two.") {
			t.Fatalf("missing Two: %s", user)
		}
		return `[{"sentence":"Two.","translation":"二。","components":[],"keyPhrases":[]}]`, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 || len(items) != 2 {
		t.Fatalf("calls=%d items=%+v", calls, items)
	}
	if items[0].Translation != "一。" || items[1].Translation != "二。" {
		t.Fatalf("%+v", items)
	}
}

func TestEnsureReadingPassageAnalysis_emptyArrayCached(t *testing.T) {
	db := testAnalysisDB(t)
	p := ReadingPassage{Title: "T", Content: "", Status: ReadingStatusPublished}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	calls := 0
	items, err := EnsureReadingPassageAnalysis(context.Background(), db, p.ID, func(context.Context, string, string) (string, error) {
		calls++
		return `[{"sentence":"x","translation":"y","components":[],"keyPhrases":[]}]`, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	// Empty content → no sentences → no chat, empty result cached.
	if calls != 0 || len(items) != 0 {
		t.Fatalf("calls=%d len=%d", calls, len(items))
	}
	var again ReadingPassage
	if err := db.First(&again, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !AnalysisJSONReady(again.AnalysisJSON) {
		t.Fatal("empty [] should be stored")
	}
}
