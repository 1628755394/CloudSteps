package models

import (
	"testing"
	"time"
)

func TestFirstReviewDueAtIsNextDay(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Now().In(loc)
	due := FirstReviewDueAt(loc)
	want := LearnDayStart(now, loc).AddDate(0, 0, 1).UTC()
	if !due.Equal(want) {
		t.Fatalf("due=%v want next day start %v", due, want)
	}
}

func TestReviewScheduleDaysStartFromDay2(t *testing.T) {
	want10 := []int{2, 3, 4, 6, 8, 10, 13, 15, 18, 22}
	got10 := ReviewScheduleDaysForPreset("times10")
	if len(got10) != len(want10) {
		t.Fatalf("times10 len=%d want %d", len(got10), len(want10))
	}
	for i := range want10 {
		if got10[i] != want10[i] {
			t.Fatalf("times10[%d]=%d want %d", i, got10[i], want10[i])
		}
	}
	if got := ReviewScheduleDaysForPreset("times3"); len(got) != 3 || got[0] != 2 || got[2] != 5 {
		t.Fatalf("times3=%v", got)
	}
	if got := ReviewScheduleDaysForPreset("times5"); len(got) != 5 || got[0] != 2 || got[4] != 12 {
		t.Fatalf("times5=%v", got)
	}
	if got := ReviewScheduleDaysForPreset("times7"); len(got) != 7 || got[0] != 2 || got[6] != 21 {
		t.Fatalf("times7=%v", got)
	}
}

func TestReviewDueAtForStageExample(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	anchor := time.Date(2025, 7, 28, 10, 0, 0, 0, loc)
	// times10 stage 0 = 第 2 天 → 2025-07-29
	due0 := ReviewDueAtForStage(anchor, 0, "times10", loc)
	want0 := time.Date(2025, 7, 29, 0, 0, 0, 0, loc).UTC()
	if !due0.Equal(want0) {
		t.Fatalf("stage0 due=%v want %v", due0, want0)
	}
	// 第 4 次复习 = stage 3 = 第 6 天 → 2025-08-02
	due := ReviewDueAtForStage(anchor, 3, "times10", loc)
	want := time.Date(2025, 8, 2, 0, 0, 0, 0, loc).UTC()
	if !due.Equal(want) {
		t.Fatalf("stage3 due=%v want %v", due, want)
	}
	// 第 10 次 = stage 9 = 第 22 天 → 2025-08-18
	due10 := ReviewDueAtForStage(anchor, 9, "times10", loc)
	want10 := time.Date(2025, 8, 18, 0, 0, 0, 0, loc).UTC()
	if !due10.Equal(want10) {
		t.Fatalf("stage9 due=%v want %v", due10, want10)
	}
}

func TestReviewRemainingDueFallsOnDayProjectsFullCurve(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	anchor := time.Date(2026, 9, 1, 22, 0, 0, 0, loc)
	// times5: 第2/3/5/8/12 天 → 9/2, 9/3, 9/5, 9/8, 9/12
	day1 := time.Date(2026, 9, 1, 0, 0, 0, 0, loc)
	day2 := time.Date(2026, 9, 2, 0, 0, 0, 0, loc)
	day3 := time.Date(2026, 9, 3, 0, 0, 0, 0, loc)
	day4 := time.Date(2026, 9, 4, 0, 0, 0, 0, loc)
	day5 := time.Date(2026, 9, 5, 0, 0, 0, 0, loc)
	if ReviewRemainingDueFallsOnDay(anchor, 0, "times5", day1, loc) {
		t.Fatal("stage0 should not appear on class day")
	}
	if !ReviewRemainingDueFallsOnDay(anchor, 0, "times5", day2, loc) {
		t.Fatal("stage0 should appear on day2 plan")
	}
	if !ReviewRemainingDueFallsOnDay(anchor, 0, "times5", day3, loc) {
		t.Fatal("stage0 should appear on day3 plan")
	}
	if ReviewRemainingDueFallsOnDay(anchor, 0, "times5", day4, loc) {
		t.Fatal("stage0 should not appear on day4 (not in times5)")
	}
	if !ReviewRemainingDueFallsOnDay(anchor, 0, "times5", day5, loc) {
		t.Fatal("stage0 should appear on day5 plan")
	}
	if ReviewRemainingDueFallsOnDay(anchor, 1, "times5", day2, loc) {
		t.Fatal("stage1 should not still list day2")
	}
	if !ReviewRemainingDueFallsOnDay(anchor, 1, "times5", day3, loc) {
		t.Fatal("stage1 should still list day3")
	}
}
