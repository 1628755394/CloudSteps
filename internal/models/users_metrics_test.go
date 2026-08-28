package models

import (
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMetricDayKey(t *testing.T) {
	cases := map[string]string{
		"2026-08-27":                          "2026-08-27",
		"2026-08-27 00:00:00":                 "2026-08-27",
		"2026-08-27 00:00:00 +0000 UTC":       "2026-08-27",
		"2026-08-27T00:00:00Z":                "2026-08-27",
		" 2026-08-27T16:00:00+08:00 ":         "2026-08-27",
	}
	for in, want := range cases {
		if got := metricDayKey(in); got != want {
			t.Fatalf("metricDayKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCountNewUsersByDay(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}); err != nil {
		t.Fatal(err)
	}

	today := time.Now()
	yesterday := today.AddDate(0, 0, -1)
	mustCreateUserAt(t, db, "new-a", today, RoleTeacher, "web")
	mustCreateUserAt(t, db, "new-b", today, RoleTeacher, "web")
	mustCreateUserAt(t, db, "old-c", yesterday, RoleTeacher, "web")

	from := yesterday.Format("2006-01-02")
	to := today.Format("2006-01-02")
	got, err := CountNewUsersByDay(db, from, to)
	if err != nil {
		t.Fatal(err)
	}
	if got[today.Format("2006-01-02")] != 2 {
		t.Fatalf("today = %v, map=%v", got[today.Format("2006-01-02")], got)
	}
	if got[yesterday.Format("2006-01-02")] != 1 {
		t.Fatalf("yesterday = %v, map=%v", got[yesterday.Format("2006-01-02")], got)
	}
}

func TestCountNewUsersByDay_excludesTeacherCreatedStudents(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}); err != nil {
		t.Fatal(err)
	}

	today := time.Now()
	mustCreateUserAt(t, db, "signup-web", today, RoleTeacher, "web")
	mustCreateUserAt(t, db, "stu-a", today, RoleStudent, "teacher_create")
	mustCreateUserAt(t, db, "stu-b", today, RoleStudent, "teacher_create")
	mustCreateUserAt(t, db, "seeded", today, RoleTeacher, "seed")

	day := today.Format("2006-01-02")
	got, err := CountNewUsersByDay(db, day, day)
	if err != nil {
		t.Fatal(err)
	}
	if got[day] != 1 {
		t.Fatalf("today = %v, map=%v, want 1 public signup", got[day], got)
	}
}

func mustCreateUserAt(t *testing.T, db *gorm.DB, username string, at time.Time, role, source string) {
	t.Helper()
	u := User{Username: username, Role: role, Source: source}
	u.CreatedAt = at
	u.UpdatedAt = at
	u.IsDeleted = SoftDeleteStatusActive
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&u).Update("created_at", at).Error; err != nil {
		t.Fatal(err)
	}
}
