package models

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCreateUser_grantsSignupTeacherPool(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}, &StudentTeacherCoachingQuota{}, &TeacherTeachingPool{}); err != nil {
		t.Fatal(err)
	}

	user, err := CreateUser(db, "gift@example.com", "password1")
	if err != nil {
		t.Fatal(err)
	}

	var selfN int64
	if err := db.Model(&StudentTeacherCoachingQuota{}).
		Where("teacher_id = ? AND student_id = ?", user.ID, user.ID).
		Count(&selfN).Error; err != nil {
		t.Fatal(err)
	}
	if selfN != 0 {
		t.Fatalf("self-pair quota rows = %d", selfN)
	}

	var pool TeacherTeachingPool
	if err := db.Where("teacher_id = ?", user.ID).First(&pool).Error; err != nil {
		t.Fatal(err)
	}
	if pool.RemainingMinutes != SignupTeachingPoolMinutes || pool.TotalAllocatedMinutes != SignupTeachingPoolMinutes {
		t.Fatalf("pool %+v", pool)
	}

	if err := GrantSignupTeacherTeachingPool(db, user.ID); err != nil {
		t.Fatal(err)
	}
	var n int64
	if err := db.Model(&TeacherTeachingPool{}).Where("teacher_id = ?", user.ID).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("pool rows = %d", n)
	}
}

func TestGrantSignupTeacherTeachingPool_cleansLegacySelfPair(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&StudentTeacherCoachingQuota{}, &TeacherTeachingPool{}); err != nil {
		t.Fatal(err)
	}
	teacherID := uint(23)
	legacy := StudentTeacherCoachingQuota{
		TeacherID:             teacherID,
		StudentID:             teacherID,
		RemainingMinutes:      1000,
		TotalAllocatedMinutes: 1000,
	}
	if err := db.Create(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	if err := GrantSignupTeacherTeachingPool(db, teacherID); err != nil {
		t.Fatal(err)
	}
	var activeSelf int64
	if err := db.Model(&StudentTeacherCoachingQuota{}).
		Where("teacher_id = ? AND student_id = ?", teacherID, teacherID).
		Count(&activeSelf).Error; err != nil {
		t.Fatal(err)
	}
	if activeSelf != 0 {
		t.Fatalf("active self-pair = %d", activeSelf)
	}
	var pool TeacherTeachingPool
	if err := db.Where("teacher_id = ?", teacherID).First(&pool).Error; err != nil {
		t.Fatal(err)
	}
	if pool.RemainingMinutes != SignupTeachingPoolMinutes {
		t.Fatalf("pool %+v", pool)
	}
}

func TestEnsureTeacherTeachingPool_defaultsZero(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&TeacherTeachingPool{}); err != nil {
		t.Fatal(err)
	}
	pool, err := EnsureTeacherTeachingPool(db, 5)
	if err != nil || pool == nil {
		t.Fatal(err)
	}
	if pool.RemainingMinutes != 0 || pool.TotalAllocatedMinutes != 0 {
		t.Fatalf("pool %+v", pool)
	}
}
