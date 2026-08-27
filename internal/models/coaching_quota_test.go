package models

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCreateUser_grantsSignupCoachingQuota(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}, &StudentTeacherCoachingQuota{}); err != nil {
		t.Fatal(err)
	}

	user, err := CreateUser(db, "gift@example.com", "password1")
	if err != nil {
		t.Fatal(err)
	}
	if user.ID == 0 {
		t.Fatal("expected user id")
	}

	var q StudentTeacherCoachingQuota
	if err := db.Where("teacher_id = ? AND student_id = ?", user.ID, user.ID).First(&q).Error; err != nil {
		t.Fatal(err)
	}
	if q.RemainingMinutes != SignupCoachingQuotaMinutes || q.TotalAllocatedMinutes != SignupCoachingQuotaMinutes {
		t.Fatalf("quota %+v", q)
	}

	if err := GrantSignupCoachingQuota(db, user.ID); err != nil {
		t.Fatal(err)
	}
	var n int64
	if err := db.Model(&StudentTeacherCoachingQuota{}).
		Where("teacher_id = ? AND student_id = ?", user.ID, user.ID).
		Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("quota rows = %d", n)
	}
}
