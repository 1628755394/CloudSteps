package models

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newUsersSoftDeleteTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&User{}, &StudentTeacherCoachingQuota{}, &TeacherTeachingPool{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func createSoftDeletedUser(t *testing.T, db *gorm.DB, username, role string) User {
	t.Helper()
	user := User{Username: username, Role: role}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Delete(&user).Error; err != nil {
		t.Fatalf("soft delete user: %v", err)
	}
	var deleted User
	if err := db.Unscoped().First(&deleted, user.ID).Error; err != nil {
		t.Fatalf("reload deleted user: %v", err)
	}
	return deleted
}

func TestCheckUserAllowLoginRejectsDeletedUser(t *testing.T) {
	db := newUsersSoftDeleteTestDB(t)
	user := createSoftDeletedUser(t, db, "deleted", RoleStudent)
	if err := CheckUserAllowLogin(db, &user); err == nil {
		t.Fatal("expected deleted user to be rejected")
	}
}

func TestGetUserByUsernameExcludesDeleted(t *testing.T) {
	db := newUsersSoftDeleteTestDB(t)
	_ = createSoftDeletedUser(t, db, "gone", RoleTeacher)
	if _, err := GetUserByUsername(db, "gone"); err == nil {
		t.Fatal("expected deleted username lookup to fail")
	}
	anyUser, err := GetUserByUsernameAny(db, "gone")
	if err != nil || anyUser == nil {
		t.Fatalf("expected deleted user via any lookup: %v", err)
	}
}

func TestCreateUser_newAccountAfterSoftDelete(t *testing.T) {
	db := newUsersSoftDeleteTestDB(t)
	deleted := createSoftDeletedUser(t, db, "reuse@example.com", RoleTeacher)
	if IsExistsByUsername(db, "reuse@example.com") {
		t.Fatal("deleted username should not count as existing")
	}
	user, err := CreateUser(db, "reuse@example.com", "newpass1")
	if err != nil {
		t.Fatalf("create after delete: %v", err)
	}
	if user.ID == deleted.ID {
		t.Fatalf("expected new user row, got reactivated id %d", user.ID)
	}
	if !UserIsActive(user) {
		t.Fatal("new user should be active")
	}
	if !CheckPassword(user, "newpass1") {
		t.Fatal("password should be set")
	}
}

func TestSoftDeleteTeacherWithStudents(t *testing.T) {
	db := newUsersSoftDeleteTestDB(t)
	teacher := User{Username: "t1", Role: RoleTeacher}
	student1 := User{Username: "s1", Role: RoleStudent}
	student2 := User{Username: "s2", Role: RoleStudent}
	otherTeacher := User{Username: "t2", Role: RoleTeacher}
	for _, u := range []*User{&teacher, &student1, &student2, &otherTeacher} {
		if err := db.Create(u).Error; err != nil {
			t.Fatalf("create user: %v", err)
		}
	}
	quotas := []StudentTeacherCoachingQuota{
		{TeacherID: teacher.ID, StudentID: student1.ID, RemainingMinutes: 10},
		{TeacherID: teacher.ID, StudentID: student2.ID, RemainingMinutes: 20},
		{TeacherID: otherTeacher.ID, StudentID: student2.ID, RemainingMinutes: 30},
	}
	for i := range quotas {
		if err := db.Create(&quotas[i]).Error; err != nil {
			t.Fatalf("create quota: %v", err)
		}
	}

	if err := SoftDeleteTeacherWithStudents(db, teacher.ID, "admin"); err != nil {
		t.Fatalf("soft delete teacher: %v", err)
	}

	assertDeleted := func(id uint) {
		var u User
		if err := db.Unscoped().First(&u, id).Error; err != nil {
			t.Fatalf("load user %d: %v", id, err)
		}
		if !u.DeletedAt.Valid {
			t.Fatalf("user %d should be deleted", id)
		}
	}
	assertActive := func(id uint) {
		var u User
		if err := db.First(&u, id).Error; err != nil {
			t.Fatalf("load user %d: %v", id, err)
		}
		if u.DeletedAt.Valid {
			t.Fatalf("user %d should remain active", id)
		}
	}

	assertDeleted(teacher.ID)
	assertDeleted(student1.ID)
	assertDeleted(student2.ID)
	assertActive(otherTeacher.ID)

	var activeQuotas int64
	db.Model(&StudentTeacherCoachingQuota{}).
		Where("teacher_id = ?", teacher.ID).
		Count(&activeQuotas)
	if activeQuotas != 0 {
		t.Fatalf("expected no active quotas for deleted teacher, got %d", activeQuotas)
	}
}

func TestSoftDeleteUser_clearsCoachingBalances(t *testing.T) {
	db := newUsersSoftDeleteTestDB(t)
	teacher := User{Username: "t-pool", Role: RoleTeacher}
	student := User{Username: "s-quota", Role: RoleStudent}
	if err := db.Create(&teacher).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&student).Error; err != nil {
		t.Fatal(err)
	}
	quota := StudentTeacherCoachingQuota{
		TeacherID:             teacher.ID,
		StudentID:             student.ID,
		RemainingMinutes:      120,
		TotalAllocatedMinutes: 200,
	}
	if err := db.Create(&quota).Error; err != nil {
		t.Fatal(err)
	}
	pool := TeacherTeachingPool{
		TeacherID:             teacher.ID,
		RemainingMinutes:      800,
		TotalAllocatedMinutes: 1000,
	}
	if err := db.Create(&pool).Error; err != nil {
		t.Fatal(err)
	}

	if err := SoftDeleteUser(db, student.ID, "self"); err != nil {
		t.Fatalf("soft delete student: %v", err)
	}
	if err := db.Unscoped().First(&quota, quota.ID).Error; err != nil {
		t.Fatal(err)
	}
	if quota.RemainingMinutes != 0 || quota.TotalAllocatedMinutes != 0 {
		t.Fatalf("quota not cleared: %+v", quota)
	}
	if !quota.DeletedAt.Valid {
		t.Fatal("quota should be soft-deleted")
	}

	if err := SoftDeleteTeacherWithStudents(db, teacher.ID, "admin"); err != nil {
		t.Fatalf("soft delete teacher: %v", err)
	}
	if err := db.Unscoped().First(&pool, pool.ID).Error; err != nil {
		t.Fatal(err)
	}
	if pool.RemainingMinutes != 0 || pool.TotalAllocatedMinutes != 0 {
		t.Fatalf("pool not cleared: %+v", pool)
	}
}
