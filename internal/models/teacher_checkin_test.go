package models

import (
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testCheckInDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:checkin_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := db.AutoMigrate(&TeacherCheckIn{}, &TeacherTeachingPool{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func mustParseDay(s string) time.Time {
	t, err := time.ParseInLocation("2006-01-02", s, time.Local)
	if err != nil {
		panic(err)
	}
	return t
}

func TestCheckInRewardForStreak(t *testing.T) {
	cases := []struct {
		streak int
		want   int
	}{
		{1, 60},
		{2, 60},
		{3, 70},
		{4, 80},
		{14, 180},
		{30, 180},
		{0, 0},
	}
	for _, tc := range cases {
		if got := CheckInRewardForStreak(tc.streak); got != tc.want {
			t.Fatalf("streak=%d got=%d want=%d", tc.streak, got, tc.want)
		}
	}
}

func TestStreakAfterCheckIn(t *testing.T) {
	today := localDateOnly(mustParseDay("2026-08-29"))
	yest := localDateOnly(mustParseDay("2026-08-28"))
	gap := localDateOnly(mustParseDay("2026-08-26"))

	if streakAfterCheckIn(nil, today, 0) != 1 {
		t.Fatal("first day")
	}
	if streakAfterCheckIn(&yest, today, 5) != 6 {
		t.Fatal("continue")
	}
	if streakAfterCheckIn(&gap, today, 5) != 1 {
		t.Fatal("reset")
	}
	if streakAfterCheckIn(&today, today, 3) != 3 {
		t.Fatal("same day keep")
	}
}

func TestDoTeacherCheckIn_grantsAndIdempotent(t *testing.T) {
	db := testCheckInDB(t)
	now := mustParseDay("2026-08-29")

	r1, err := DoTeacherCheckIn(db, 42, now)
	if err != nil {
		t.Fatal(err)
	}
	if r1.AlreadyCheckedIn || r1.GrantedMinutes != 60 || r1.BonusMinutes != 0 {
		t.Fatalf("first: %+v", r1)
	}
	if r1.CurrentStreak != 1 {
		t.Fatalf("streak=%d", r1.CurrentStreak)
	}

	r2, err := DoTeacherCheckIn(db, 42, now)
	if err != nil {
		t.Fatal(err)
	}
	if !r2.AlreadyCheckedIn || r2.GrantedMinutes != 0 {
		t.Fatalf("second: %+v", r2)
	}

	pool, err := EnsureTeacherTeachingPool(db, 42)
	if err != nil {
		t.Fatal(err)
	}
	if pool.RemainingMinutes != 60 {
		t.Fatalf("pool=%d", pool.RemainingMinutes)
	}
}

func TestDoTeacherCheckIn_day3Is70(t *testing.T) {
	db := testCheckInDB(t)
	day1 := mustParseDay("2026-08-27")
	day2 := mustParseDay("2026-08-28")
	day3 := mustParseDay("2026-08-29")

	if _, err := DoTeacherCheckIn(db, 7, day1); err != nil {
		t.Fatal(err)
	}
	if _, err := DoTeacherCheckIn(db, 7, day2); err != nil {
		t.Fatal(err)
	}
	r3, err := DoTeacherCheckIn(db, 7, day3)
	if err != nil {
		t.Fatal(err)
	}
	if r3.CurrentStreak != 3 || r3.GrantedMinutes != 70 || r3.BonusMinutes != 10 {
		t.Fatalf("day3: %+v", r3)
	}
	pool, err := EnsureTeacherTeachingPool(db, 7)
	if err != nil {
		t.Fatal(err)
	}
	if pool.RemainingMinutes != 60+60+70 {
		t.Fatalf("pool=%d", pool.RemainingMinutes)
	}
}

func TestListUnreadPublishedAnnouncements_multi(t *testing.T) {
	db := testAnnouncementDB(t)
	now := time.Now()
	for _, title := range []string{"A", "B"} {
		a := &Announcement{
			Title: title, Content: title, Status: AnnouncementStatusPublished,
			PublishedAt: &now, Priority: 1,
		}
		if err := CreateAnnouncement(db, a); err != nil {
			t.Fatal(err)
		}
	}
	list, err := ListUnreadPublishedAnnouncements(db, 9, 20)
	if err != nil || len(list) != 2 {
		t.Fatalf("list=%d err=%v", len(list), err)
	}
}
