package models

import (
	"testing"
	"time"
)

func TestFirstReviewDueAtIsTomorrowLocal(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Now().In(loc)
	due := FirstReviewDueAt(loc)
	want := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, 1).UTC()
	if !due.Equal(want) {
		t.Fatalf("due=%v want=%v", due, want)
	}
	todayEnd := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, 1)
	if due.Before(todayEnd.UTC()) {
		t.Fatalf("first review should be on or after tomorrow local midnight")
	}
}

func TestReviewIntervalsByTimes(t *testing.T) {
	if got := len(ReviewIntervalsForPreset("times3")); got != 3 {
		t.Fatalf("times3 len=%d want 3", got)
	}
	if got := len(ReviewIntervalsForPreset("times10")); got != 10 {
		t.Fatalf("times10 len=%d want 10", got)
	}
	if ReviewIntervalsForPreset("times3")[0] != 1 {
		t.Fatal("first interval should be 1 day (tomorrow)")
	}
	if ReviewTimesCount("interval5") != 5 {
		t.Fatal("legacy interval5 should map to 5 times")
	}
}
