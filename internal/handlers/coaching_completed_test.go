package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCoachingTeacherCompleted_scopedToCurrentTeacher(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.CoachingAppointment{},
		&models.CoachingSessionRecord{},
	); err != nil {
		t.Fatal(err)
	}

	teacherA := mustCreateTeacher(t, db, "coach-a")
	teacherB := mustCreateTeacher(t, db, "coach-b")
	studentA := mustCreateStudent(t, db, "stu-a")
	studentB := mustCreateStudent(t, db, "stu-b")
	day := time.Date(2026, 8, 20, 0, 0, 0, 0, time.Local)

	mustCreateAppointment(t, db, teacherA.ID, studentA.ID, day, models.CoachingStatusCompleted, "A完成")
	mustCreateAppointment(t, db, teacherB.ID, studentB.ID, day, models.CoachingStatusCompleted, "B完成")
	mustCreateAppointment(t, db, teacherA.ID, studentA.ID, day, models.CoachingStatusScheduled, "A未上")

	a := completedForTeacher(t, db, teacherA)
	if a.Total != 1 || len(a.Titles) != 1 || a.Titles[0] != "A完成" {
		t.Fatalf("teacher A completed = total %d titles %v, want only A完成", a.Total, a.Titles)
	}

	b := completedForTeacher(t, db, teacherB)
	if b.Total != 1 || len(b.Titles) != 1 || b.Titles[0] != "B完成" {
		t.Fatalf("teacher B completed = total %d titles %v, want only B完成", b.Total, b.Titles)
	}
}

type completedList struct {
	Total  int
	Titles []string
}

func completedForTeacher(t *testing.T, db *gorm.DB, teacher *models.User) completedList {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodGet, "/teacher/coaching/completed?from=2026-08-01&to=2026-08-31&page=1&pageSize=20", nil)
	c.Request = req
	c.Set(lbconstants.DbField, db)
	c.Set(constants.UserField, teacher)

	h := &Handlers{}
	h.coachingTeacherCompleted(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body %s", w.Code, w.Body.String())
	}

	var envelope struct {
		Code int `json:"code"`
		Data struct {
			Total     int `json:"total"`
			Schedules []struct {
				Title     string `json:"title"`
				TeacherID uint   `json:"teacherId"`
			} `json:"schedules"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("json: %v body %s", err, w.Body.String())
	}
	if envelope.Code != 200 {
		t.Fatalf("code %d body %s", envelope.Code, w.Body.String())
	}

	titles := make([]string, 0, len(envelope.Data.Schedules))
	for _, s := range envelope.Data.Schedules {
		if s.TeacherID != teacher.ID {
			t.Fatalf("schedule %q teacherId=%d, want %d", s.Title, s.TeacherID, teacher.ID)
		}
		titles = append(titles, s.Title)
	}
	return completedList{Total: envelope.Data.Total, Titles: titles}
}

func mustCreateTeacher(t *testing.T, db *gorm.DB, username string) *models.User {
	t.Helper()
	u := models.User{Username: username, Role: models.RoleTeacher}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return &u
}

func mustCreateStudent(t *testing.T, db *gorm.DB, username string) *models.User {
	t.Helper()
	u := models.User{Username: username, Role: models.RoleStudent}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return &u
}

func mustCreateAppointment(t *testing.T, db *gorm.DB, teacherID, studentID uint, day time.Time, status, title string) models.CoachingAppointment {
	t.Helper()
	ap := models.CoachingAppointment{
		TeacherID:       teacherID,
		StudentID:       studentID,
		ScheduledDate:   day,
		StartTime:       "10:00",
		EndTime:         "10:30",
		DurationMinutes: 30,
		Status:          status,
		Title:           title,
	}
	if err := db.Create(&ap).Error; err != nil {
		t.Fatal(err)
	}
	return ap
}

func TestCoachingTeacherListQuotas_excludesSelfPair(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.StudentTeacherCoachingQuota{},
		&models.VocabTestRecord{},
		&models.CoachingSessionRecord{},
		&models.StudySession{},
		&models.TeacherTeachingPool{},
	); err != nil {
		t.Fatal(err)
	}

	teacher := mustCreateTeacher(t, db, "coach-self")
	student := mustCreateStudent(t, db, "real-stu")
	legacy := models.StudentTeacherCoachingQuota{
		TeacherID:             teacher.ID,
		StudentID:             teacher.ID,
		RemainingMinutes:      1000,
		TotalAllocatedMinutes: 1000,
	}
	if err := db.Create(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	real := models.StudentTeacherCoachingQuota{
		TeacherID:             teacher.ID,
		StudentID:             student.ID,
		RemainingMinutes:      120,
		TotalAllocatedMinutes: 120,
	}
	if err := db.Create(&real).Error; err != nil {
		t.Fatal(err)
	}

	listFor := func(includeSelf bool) []uint {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		url := "/teacher/coaching/quotas?limit=20"
		if includeSelf {
			url += "&includeSelf=1"
		}
		c.Request = httptest.NewRequest(http.MethodGet, url, nil)
		c.Set(lbconstants.DbField, db)
		c.Set(constants.UserField, teacher)

		h := &Handlers{}
		h.coachingTeacherListQuotas(c)
		if w.Code != http.StatusOK {
			t.Fatalf("status %d body %s", w.Code, w.Body.String())
		}
		var envelope struct {
			Code int `json:"code"`
			Data struct {
				List []struct {
					StudentID uint `json:"studentId"`
				} `json:"list"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
			t.Fatalf("json: %v", err)
		}
		ids := make([]uint, 0, len(envelope.Data.List))
		for _, row := range envelope.Data.List {
			ids = append(ids, row.StudentID)
		}
		return ids
	}

	defaultIDs := listFor(false)
	if len(defaultIDs) != 1 || defaultIDs[0] != student.ID {
		t.Fatalf("default list studentIds=%v want only %d", defaultIDs, student.ID)
	}
	withSelf := listFor(true)
	if len(withSelf) != 1 || withSelf[0] != student.ID {
		t.Fatalf("includeSelf list studentIds=%v want only %d", withSelf, student.ID)
	}
}
