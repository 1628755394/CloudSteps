package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCoachingAdminGetAppointment_returnsNamesAndSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := coachingTestDB(t)
	teacher := mustCreateTeacher(t, db, "admin-coach")
	student := mustCreateStudent(t, db, "admin-stu")
	day := time.Date(2026, 8, 20, 0, 0, 0, 0, time.Local)
	ap := mustCreateAppointment(t, db, teacher.ID, student.ID, day, models.CoachingStatusCompleted, "晚课")
	sess := models.CoachingSessionRecord{
		AppointmentID:          ap.ID,
		TeacherID:              teacher.ID,
		StudentID:              student.ID,
		StartedAt:              day.Add(10 * time.Hour),
		EndedAt:                day.Add(10*time.Hour + 30*time.Minute),
		ActualMinutes:          30,
		BilledMinutes:          30,
		TeacherCreditedMinutes: 30,
		Status:                 models.CoachingSessionStatusCompleted,
	}
	if err := db.Create(&sess).Error; err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/coaching/appointments/"+strconv.Itoa(int(ap.ID)), nil)
	c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(int(ap.ID))}}
	c.Set(constants.DbField, db)
	h := &Handlers{}
	h.coachingAdminGetAppointment(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body %s", w.Code, w.Body.String())
	}
	var envelope struct {
		Code int `json:"code"`
		Data struct {
			ID      uint   `json:"id"`
			Title   string `json:"title"`
			Teacher *struct {
				Username string `json:"username"`
			} `json:"teacher"`
			Student *struct {
				Username string `json:"username"`
			} `json:"student"`
			Session *struct {
				BilledMinutes int `json:"billedMinutes"`
			} `json:"session"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Code != 200 || envelope.Data.Title != "晚课" {
		t.Fatalf("body %s", w.Body.String())
	}
	if envelope.Data.Teacher == nil || envelope.Data.Teacher.Username != "admin-coach" {
		t.Fatalf("teacher %+v", envelope.Data.Teacher)
	}
	if envelope.Data.Student == nil || envelope.Data.Student.Username != "admin-stu" {
		t.Fatalf("student %+v", envelope.Data.Student)
	}
	if envelope.Data.Session == nil || envelope.Data.Session.BilledMinutes != 30 {
		t.Fatalf("session %+v", envelope.Data.Session)
	}
}

func TestCoachingAdminListAppointments_filtersByStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := coachingTestDB(t)
	teacher := mustCreateTeacher(t, db, "list-coach")
	student := mustCreateStudent(t, db, "list-stu")
	day := time.Date(2026, 8, 20, 0, 0, 0, 0, time.Local)
	mustCreateAppointment(t, db, teacher.ID, student.ID, day, models.CoachingStatusCompleted, "已完成课")
	mustCreateAppointment(t, db, teacher.ID, student.ID, day, models.CoachingStatusScheduled, "未上课")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/coaching/appointments?from=2026-08-01&to=2026-08-31&status=completed&page=1&pageSize=20", nil)
	c.Set(constants.DbField, db)
	h := &Handlers{}
	h.coachingAdminListAppointments(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body %s", w.Code, w.Body.String())
	}
	var envelope struct {
		Code int `json:"code"`
		Data struct {
			Total int `json:"total"`
			List  []struct {
				Title  string `json:"title"`
				Status string `json:"status"`
			} `json:"list"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.Total != 1 || len(envelope.Data.List) != 1 || envelope.Data.List[0].Title != "已完成课" {
		t.Fatalf("got %+v body %s", envelope.Data, w.Body.String())
	}
}

func coachingTestDB(t *testing.T) *gorm.DB {
	t.Helper()
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
	return db
}
