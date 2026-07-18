package handlers

import (
	"errors"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// coachingCompleteAppointment 完课：扣学员额度、计老师用量、写入 session（幂等：已有 session 则返回）
func coachingCompleteAppointment(db *gorm.DB, appointmentID uint, endedAt time.Time, auditC *gin.Context, autoEnd bool) (*models.CoachingSessionRecord, *models.CoachingAppointment, error) {
	var existing models.CoachingSessionRecord
	if err := db.Where("appointment_id = ?", appointmentID).First(&existing).Error; err == nil {
		var ap models.CoachingAppointment
		_ = db.Where("id = ?", appointmentID).First(&ap).Error
		return &existing, &ap, nil
	}

	var ap models.CoachingAppointment
	if err := db.Where("id = ? AND is_deleted = 0", appointmentID).First(&ap).Error; err != nil {
		return nil, nil, err
	}
	if ap.Status != models.CoachingStatusInProgress {
		return nil, nil, errors.New("只有上课中的排课可以下课")
	}
	if ap.ActualStartedAt == nil {
		return nil, nil, errors.New("缺少实际上课开始时间")
	}

	loc := time.Local
	endedAt = models.CoachingEffectiveEndTime(&ap, endedAt, loc)
	actual := models.CoachingBillingActualMinutes(&ap, *ap.ActualStartedAt, endedAt, loc)

	var rec models.CoachingSessionRecord
	err := db.Transaction(func(tx *gorm.DB) error {
		var q models.StudentTeacherCoachingQuota
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("teacher_id = ? AND student_id = ? AND is_deleted = 0", ap.TeacherID, ap.StudentID).
			First(&q).Error; err != nil {
			return err
		}
		billedStudent := actual
		if q.RemainingMinutes < billedStudent {
			billedStudent = q.RemainingMinutes
		}
		res := tx.Model(&models.StudentTeacherCoachingQuota{}).
			Where("id = ? AND version = ?", q.ID, q.Version).
			Updates(map[string]any{
				"remaining_minutes": q.RemainingMinutes - billedStudent,
				"version":           q.Version + 1,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("额度更新冲突，请重试")
		}
		period, err := coachingGetOrCreateUsagePeriod(tx, ap.TeacherID, endedAt)
		if err != nil {
			return err
		}
		var lockedPeriod models.TeacherCoachingUsagePeriod
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", period.ID).First(&lockedPeriod).Error; err != nil {
			return err
		}
		teacherCred := billedStudent
		if lockedPeriod.CapMinutes > 0 {
			room := lockedPeriod.CapMinutes - lockedPeriod.UsedMinutes
			if room < 0 {
				room = 0
			}
			if teacherCred > room {
				teacherCred = room
			}
		}
		if err := tx.Model(&lockedPeriod).Update("used_minutes", lockedPeriod.UsedMinutes+teacherCred).Error; err != nil {
			return err
		}
		rec = models.CoachingSessionRecord{
			AppointmentID: appointmentID, TeacherID: ap.TeacherID, StudentID: ap.StudentID,
			StartedAt: *ap.ActualStartedAt, EndedAt: endedAt,
			ActualMinutes: actual, BilledMinutes: billedStudent, TeacherCreditedMinutes: teacherCred,
			Status: models.CoachingSessionStatusCompleted,
		}
		if err := tx.Create(&rec).Error; err != nil {
			return err
		}
		return tx.Model(&ap).Updates(map[string]any{
			"status": models.CoachingStatusCompleted,
		}).Error
	})
	if err != nil {
		return nil, nil, err
	}
	_ = db.First(&rec, rec.ID).Error
	_ = db.First(&ap, ap.ID).Error

	if auditC != nil {
		summary := "下课完课"
		action := coachingAuditSessionEnd
		if autoEnd {
			summary = "排课结束自动下课"
			action = coachingAuditSessionAutoEnd
		}
		coachingWriteCoachingAudit(db, auditC, action, "session", rec.ID, appointmentID, summary, map[string]any{
			"teacherId": rec.TeacherID, "studentId": rec.StudentID,
			"actualMinutes": rec.ActualMinutes, "billedMinutes": rec.BilledMinutes,
			"teacherCreditedMinutes": rec.TeacherCreditedMinutes, "autoEnd": autoEnd,
		})
	} else {
		coachingWriteCoachingAuditSystem(db, coachingAuditSessionAutoEnd, "session", rec.ID, appointmentID, "排课结束自动下课", map[string]any{
			"appointmentId": appointmentID, "actualMinutes": rec.ActualMinutes,
		})
	}
	return &rec, &ap, nil
}

// CoachingAutoEndOverdueSessions 将已过排课结束时间但仍 in_progress 的课自动完课
func CoachingAutoEndOverdueSessions(db *gorm.DB) (int, error) {
	loc := time.Local
	now := time.Now().In(loc)
	var list []models.CoachingAppointment
	if err := db.Where("is_deleted = 0 AND status = ?", models.CoachingStatusInProgress).Find(&list).Error; err != nil {
		return 0, err
	}
	n := 0
	for i := range list {
		ap := list[i]
		_, slotEnd, _, err := models.CoachingAppointmentSlotBounds(&ap, loc)
		if err != nil {
			continue
		}
		if now.Before(slotEnd) {
			continue
		}
		if _, _, err := coachingCompleteAppointment(db, ap.ID, slotEnd, nil, true); err != nil {
			continue
		}
		n++
	}
	return n, nil
}
