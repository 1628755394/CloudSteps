package models

import (
	"strings"
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testScenarioDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:scenario_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&ScenarioDialogueScenario{}, &ScenarioDialogueSession{}, &ScenarioDialogueTurn{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestScenarioDialogueScenario_TableName(t *testing.T) {
	if (ScenarioDialogueScenario{}).TableName() != constants.TABLE_SCENARIO_DIALOGUE_SCENARIOS {
		t.Fatalf("ScenarioDialogueScenario table name = %q, want %q",
			(ScenarioDialogueScenario{}).TableName(), constants.TABLE_SCENARIO_DIALOGUE_SCENARIOS)
	}
}

func TestScenarioDialogueSession_TableName(t *testing.T) {
	if (ScenarioDialogueSession{}).TableName() != constants.TABLE_SCENARIO_DIALOGUE_SESSIONS {
		t.Fatalf("ScenarioDialogueSession table name = %q, want %q",
			(ScenarioDialogueSession{}).TableName(), constants.TABLE_SCENARIO_DIALOGUE_SESSIONS)
	}
}

func TestScenarioDialogueTurn_TableName(t *testing.T) {
	if (ScenarioDialogueTurn{}).TableName() != constants.TABLE_SCENARIO_DIALOGUE_TURNS {
		t.Fatalf("ScenarioDialogueTurn table name = %q, want %q",
			(ScenarioDialogueTurn{}).TableName(), constants.TABLE_SCENARIO_DIALOGUE_TURNS)
	}
}

func TestScenarioDialogueScenario_CRUDAndUniqueSlug(t *testing.T) {
	db := testScenarioDB(t)
	s := &ScenarioDialogueScenario{
		Slug:        "restaurant",
		Name:        "餐厅点餐",
		Description: "desc",
		Icon:        "utensils",
		Difficulty:  "easy",
		AIRole:      "a waiter",
		Prompt:      "Flow: greet",
		Enabled:     true,
		SortOrder:   1,
	}
	if err := db.Create(s).Error; err != nil {
		t.Fatalf("create scenario: %v", err)
	}
	if s.ID == 0 {
		t.Fatal("expected id assigned")
	}

	var got ScenarioDialogueScenario
	if err := db.First(&got, s.ID).Error; err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.Slug != "restaurant" || got.Name != "餐厅点餐" {
		t.Fatalf("unexpected: %+v", got)
	}

	// Unique slug constraint
	dup := &ScenarioDialogueScenario{Slug: "restaurant", Name: "dup"}
	if err := db.Create(dup).Error; err == nil {
		t.Fatal("expected unique constraint on slug")
	}

	// Update
	if err := db.Model(&got).Update("difficulty", "hard").Error; err != nil {
		t.Fatal(err)
	}
	var got2 ScenarioDialogueScenario
	if err := db.First(&got2, s.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got2.Difficulty != "hard" {
		t.Fatalf("difficulty = %q", got2.Difficulty)
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

func TestScenarioDialogueSession_CRUDWithTurns(t *testing.T) {
	db := testScenarioDB(t)
	sc := &ScenarioDialogueScenario{Slug: "airport", Name: "机场", Difficulty: "medium"}
	if err := db.Create(sc).Error; err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	ended := started.Add(5 * time.Minute)
	sess := &ScenarioDialogueSession{
		UserID:             3,
		ScenarioID:         sc.ID,
		Status:             ScenarioSessionStatusActive,
		StartedAt:          &started,
		EndedAt:            &ended,
		DurationSec:        300,
		FluencyScore:       80,
		AccuracyScore:      70,
		PronunciationScore: 60,
		OverallScore:       70,
		TurnCount:          2,
		UserWordCount:      50,
		CorrectionCount:    1,
		PronunciationHints: 1,
		ReviewSummary:      "good",
		ReviewDetail:       "detail",
	}
	if err := db.Create(sess).Error; err != nil {
		t.Fatalf("create session: %v", err)
	}

	turn1 := &ScenarioDialogueTurn{
		SessionID: sess.ID, Role: "assistant", Content: "Hi", TurnIndex: 0,
	}
	turn2 := &ScenarioDialogueTurn{
		SessionID: sess.ID, Role: "user", Content: "Hello", HasCorrection: true, TurnIndex: 1,
	}
	if err := db.Create(turn1).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(turn2).Error; err != nil {
		t.Fatal(err)
	}

	var got ScenarioDialogueSession
	if err := db.Preload("Turns").First(&got, sess.ID).Error; err != nil {
		t.Fatalf("find session: %v", err)
	}
	if got.OverallScore != 70 || len(got.Turns) != 2 {
		t.Fatalf("unexpected session: %+v turns=%d", got, len(got.Turns))
	}

	// Complete the session
	if err := db.Model(&got).Update("status", ScenarioSessionStatusCompleted).Error; err != nil {
		t.Fatal(err)
	}
	var got2 ScenarioDialogueSession
	if err := db.First(&got2, sess.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got2.Status != ScenarioSessionStatusCompleted {
		t.Fatalf("status = %q", got2.Status)
	}
}

func TestScenarioDialogueTurn_CRUD(t *testing.T) {
	db := testScenarioDB(t)
	sc := &ScenarioDialogueScenario{Slug: "hotel", Name: "酒店", Difficulty: "easy"}
	if err := db.Create(sc).Error; err != nil {
		t.Fatal(err)
	}
	sess := &ScenarioDialogueSession{UserID: 1, ScenarioID: sc.ID, Status: ScenarioSessionStatusPending}
	if err := db.Create(sess).Error; err != nil {
		t.Fatal(err)
	}
	tr := &ScenarioDialogueTurn{
		SessionID:        sess.ID,
		Role:             "user",
		Content:          "I want a room",
		HasCorrection:    true,
		HasPronunciation: false,
		TurnIndex:        0,
	}
	if err := db.Create(tr).Error; err != nil {
		t.Fatalf("create turn: %v", err)
	}
	var got ScenarioDialogueTurn
	if err := db.First(&got, tr.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.Role != "user" || !got.HasCorrection {
		t.Fatalf("unexpected: %+v", got)
	}
}

func TestBuildScenarioSystemPrompt(t *testing.T) {
	// nil scenario -> default base prompt
	got := BuildScenarioSystemPrompt(nil)
	if !strings.Contains(got, "English conversation partner") {
		t.Fatalf("nil scenario prompt missing default role: %q", got)
	}

	// scenario with empty prompt -> uses Name-derived specific
	s := &ScenarioDialogueScenario{
		Name:        "餐厅点餐",
		AIRole:      "a waiter",
		Description: "desc",
	}
	got = BuildScenarioSystemPrompt(s)
	if !strings.Contains(got, "a waiter") {
		t.Fatalf("prompt missing role: %q", got)
	}
	if !strings.Contains(got, "餐厅点餐") {
		t.Fatalf("prompt missing scene name: %q", got)
	}
	if !strings.Contains(got, "# Scenario flow") {
		t.Fatalf("prompt missing flow section: %q", got)
	}
	if !strings.Contains(got, `Guide the learner through a realistic "餐厅点餐" conversation.`) {
		t.Fatalf("prompt missing default specific flow: %q", got)
	}

	// scenario with custom prompt -> uses it
	s.Prompt = "Custom flow: step 1 then step 2"
	got = BuildScenarioSystemPrompt(s)
	if !strings.Contains(got, "Custom flow: step 1 then step 2") {
		t.Fatalf("prompt missing custom flow: %q", got)
	}
}

func TestDefaultScenarioBasePrompt_emptyDescription(t *testing.T) {
	got := defaultScenarioBasePrompt("role", "scene", "")
	if !strings.Contains(got, "Help the learner practice spoken English in this situation.") {
		t.Fatalf("expected fallback description, got %q", got)
	}
	got2 := defaultScenarioBasePrompt("role", "scene", "custom desc")
	if !strings.Contains(got2, "custom desc") {
		t.Fatalf("expected custom description, got %q", got2)
	}
}

func TestDefaultScenarios_seedData(t *testing.T) {
	if len(DefaultScenarios) == 0 {
		t.Fatal("expected default scenarios seeded")
	}
	slugs := map[string]bool{}
	for _, s := range DefaultScenarios {
		if s.Slug == "" {
			t.Fatal("scenario missing slug")
		}
		if slugs[s.Slug] {
			t.Fatalf("duplicate slug in defaults: %s", s.Slug)
		}
		slugs[s.Slug] = true
	}
	// Known built-in scenarios
	for _, want := range []string{"restaurant", "airport", "job-interview", "hotel", "shopping"} {
		if !slugs[want] {
			t.Fatalf("missing default scenario slug: %s", want)
		}
	}
}
