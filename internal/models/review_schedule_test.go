package models

import (
	"testing"
	"time"
)

func TestFirstReviewDueAtIsClassDay(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Now().In(loc)
	due := FirstReviewDueAt(loc)
	want := LearnDayStart(now, loc).UTC()
	if !due.Equal(want) {
		t.Fatalf("due=%v want class day start %v", due, want)
	}
}

func TestReviewScheduleDaysMatchPrintTool(t *testing.T) {
	want10 := []int{1, 2, 3, 5, 7, 9, 12, 14, 17, 21}
	got10 := ReviewScheduleDaysForPreset("times10")
	if len(got10) != len(want10) {
		t.Fatalf("times10 len=%d want %d", len(got10), len(want10))
	}
	for i := range want10 {
		if got10[i] != want10[i] {
			t.Fatalf("times10[%d]=%d want %d", i, got10[i], want10[i])
		}
	}
	if got := ReviewScheduleDaysForPreset("times3"); len(got) != 3 || got[2] != 4 {
		t.Fatalf("times3=%v", got)
	}
	if got := ReviewScheduleDaysForPreset("times5"); len(got) != 5 || got[4] != 11 {
		t.Fatalf("times5=%v", got)
	}
	if got := ReviewScheduleDaysForPreset("times7"); len(got) != 7 || got[6] != 20 {
		t.Fatalf("times7=%v", got)
	}
}

func TestReviewDueAtForStageExample(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	anchor := time.Date(2025, 7, 28, 10, 0, 0, 0, loc)
	// 第 4 次复习 = stage 3 = 第 5 天 → 2025-08-01
	due := ReviewDueAtForStage(anchor, 3, "times10", loc)
	want := time.Date(2025, 8, 1, 0, 0, 0, 0, loc).UTC()
	if !due.Equal(want) {
		t.Fatalf("stage3 due=%v want %v", due, want)
	}
	// 第 10 次 = stage 9 = 第 21 天 → 2025-08-17
	due10 := ReviewDueAtForStage(anchor, 9, "times10", loc)
	want10 := time.Date(2025, 8, 17, 0, 0, 0, 0, loc).UTC()
	if !due10.Equal(want10) {
		t.Fatalf("stage9 due=%v want %v", due10, want10)
	}
}

func TestReviewRemainingDueFallsOnDayProjectsFullCurve(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	anchor := time.Date(2026, 9, 1, 22, 0, 0, 0, loc)
	// times5: 第1/2/4/7/11 天 → 9/1, 9/2, 9/4, 9/7, 9/11
	day2 := time.Date(2026, 9, 2, 0, 0, 0, 0, loc)
	day3 := time.Date(2026, 9, 3, 0, 0, 0, 0, loc)
	day4 := time.Date(2026, 9, 4, 0, 0, 0, 0, loc)
	if !ReviewRemainingDueFallsOnDay(anchor, 0, "times5", day2, loc) {
		t.Fatal("stage0 should appear on day2 plan")
	}
	if ReviewRemainingDueFallsOnDay(anchor, 0, "times5", day3, loc) {
		t.Fatal("stage0 should not appear on day3 (not in times5)")
	}
	if !ReviewRemainingDueFallsOnDay(anchor, 0, "times5", day4, loc) {
		t.Fatal("stage0 should appear on day4 plan")
	}
	day1 := time.Date(2026, 9, 1, 0, 0, 0, 0, loc)
	if ReviewRemainingDueFallsOnDay(anchor, 1, "times5", day1, loc) {
		t.Fatal("stage1 should not still list day1")
	}
	if !ReviewRemainingDueFallsOnDay(anchor, 1, "times5", day2, loc) {
		t.Fatal("stage1 should still list day2")
	}
}
