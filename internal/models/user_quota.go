package models

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

const (
	// SignupUserQuotaMinutes 注册赠送的用户额度（分钟）
	SignupUserQuotaMinutes = 180
	// DailyCheckInMinutes 每日签到赠送的额度（分钟）
	DailyCheckInMinutes = 60
)

// UserQuota 用户额度（分钟），用于学习/练习等场景
type UserQuota struct {
	BaseModel
	UserID               uint  `json:"userId" gorm:"uniqueIndex:idx_user_quota_user;not null;index"`
	RemainingMinutes     int   `json:"remainingMinutes" gorm:"not null;default:0"`
	TotalAllocatedMinutes int  `json:"totalAllocatedMinutes" gorm:"not null;default:0"`
	User                 *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

func (UserQuota) TableName() string { return "user_quotas" }

// UserCheckIn 用户每日签到记录
type UserCheckIn struct {
	BaseModel
	UserID         uint      `json:"userId" gorm:"uniqueIndex:idx_user_checkin_user_date;not null;index"`
	CheckInDate    string    `json:"checkInDate" gorm:"uniqueIndex:idx_user_checkin_user_date;type:date;not null"`
	MinutesAwarded int       `json:"minutesAwarded" gorm:"not null;default:0"`
	User           *User     `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

func (UserCheckIn) TableName() string { return "user_check_ins" }

// EnsureUserQuota 确保用户额度行存在（默认 0）
func EnsureUserQuota(db *gorm.DB, userID uint) (*UserQuota, error) {
	if db == nil || userID == 0 {
		return nil, nil
	}
	var row UserQuota
	err := db.Where("user_id = ? AND is_deleted = ?", userID, SoftDeleteStatusActive).First(&row).Error
	if err == nil {
		return &row, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	row = UserQuota{
		UserID:               userID,
		RemainingMinutes:     0,
		TotalAllocatedMinutes: 0,
	}
	if err := db.Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// GrantSignupUserQuota 注册赠送：用户额度 +SignupUserQuotaMinutes（一次性）
func GrantSignupUserQuota(db *gorm.DB, userID uint) error {
	if db == nil || userID == 0 {
		return nil
	}
	row, err := EnsureUserQuota(db, userID)
	if err != nil {
		return err
	}
	if row == nil {
		return nil
	}
	if row.TotalAllocatedMinutes >= SignupUserQuotaMinutes {
		return nil
	}
	add := SignupUserQuotaMinutes - row.TotalAllocatedMinutes
	if add <= 0 {
		return nil
	}
	return db.Model(row).Updates(map[string]any{
		"remaining_minutes":        row.RemainingMinutes + add,
		"total_allocated_minutes":  row.TotalAllocatedMinutes + add,
	}).Error
}

// HasCheckedInToday 检查用户今日是否已签到
func HasCheckedInToday(db *gorm.DB, userID uint) (bool, error) {
	if db == nil || userID == 0 {
		return false, nil
	}
	today := time.Now().Format("2006-01-02")
	var count int64
	err := db.Model(&UserCheckIn{}).
		Where("user_id = ? AND check_in_date = ? AND is_deleted = ?", userID, today, SoftDeleteStatusActive).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// PerformCheckIn 执行每日签到，赠送 DailyCheckInMinutes 分钟
func PerformCheckIn(db *gorm.DB, userID uint) (*UserCheckIn, error) {
	if db == nil || userID == 0 {
		return nil, errors.New("invalid parameters")
	}
	today := time.Now().Format("2006-01-02")

	var record UserCheckIn
	err := db.Where("user_id = ? AND check_in_date = ? AND is_deleted = ?", userID, today, SoftDeleteStatusActive).First(&record).Error
	if err == nil {
		// 已签到
		return &record, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		// 创建签到记录
		record = UserCheckIn{
			UserID:         userID,
			CheckInDate:    today,
			MinutesAwarded: DailyCheckInMinutes,
		}
		if err := tx.Create(&record).Error; err != nil {
			return err
		}
		// 增加用户额度
		quota, err := EnsureUserQuota(tx, userID)
		if err != nil {
			return err
		}
		if quota == nil {
			return errors.New("quota not found")
		}
		return tx.Model(quota).Updates(map[string]any{
			"remaining_minutes":       quota.RemainingMinutes + DailyCheckInMinutes,
			"total_allocated_minutes": quota.TotalAllocatedMinutes + DailyCheckInMinutes,
		}).Error
	})
	if err != nil {
		return nil, err
	}
	return &record, nil
}
