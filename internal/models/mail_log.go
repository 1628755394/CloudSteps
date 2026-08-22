package models

import (
	"time"

	"github.com/LingByte/ling-base/notification/inbox"
	"gorm.io/gorm"
)

// InternalNotification is a gorm-registered alias for the ling-base
// inbox.GormMessage so AutoMigrate calls and legacy table rows keep working.
type InternalNotification = inbox.GormMessage

// MailLog is a persisted record of an outbound email.
type MailLog struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"index" json:"user_id"`
	Provider    string    `gorm:"size:32;index" json:"provider"`
	ChannelName string    `gorm:"size:128;index" json:"channel_name"`
	ToEmail     string    `gorm:"index" json:"to_email"`
	Subject     string    `json:"subject"`
	Status      string    `gorm:"index" json:"status"`
	HtmlBody    string    `json:"html_body"`
	ErrorMsg    string    `gorm:"type:text" json:"error_msg"`
	MessageID   string    `gorm:"type:varchar(255);index" json:"message_id"`
	IPAddress   string    `gorm:"size:64" json:"ip_address"`
	RetryCount  int       `json:"retry_count"`
	SentAt      time.Time `json:"sent_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (MailLog) TableName() string { return "mail_logs" }

func CreateMailLog(db *gorm.DB, userID uint, provider, channelName, toEmail, subject, htmlBody, messageID, status, ip string) (*MailLog, error) {
	log := &MailLog{
		UserID:      userID,
		Provider:    provider,
		ChannelName: channelName,
		ToEmail:     toEmail,
		Subject:     subject,
		HtmlBody:    htmlBody,
		Status:      status,
		MessageID:   messageID,
		IPAddress:   ip,
		SentAt:      time.Now(),
	}
	if err := db.Create(log).Error; err != nil {
		return nil, err
	}
	return log, nil
}

func CreateFailedMailLog(db *gorm.DB, userID uint, provider, channelName, toEmail, subject, htmlBody, errMsg string, retries int, ip string) (*MailLog, error) {
	log := &MailLog{
		UserID:      userID,
		Provider:    provider,
		ChannelName: channelName,
		ToEmail:     toEmail,
		Subject:     subject,
		HtmlBody:    htmlBody,
		Status:      "failed",
		ErrorMsg:    errMsg,
		RetryCount:  retries,
		IPAddress:   ip,
		SentAt:      time.Now(),
	}
	if err := db.Create(log).Error; err != nil {
		return nil, err
	}
	return log, nil
}

func UpdateMailLogStatus(db *gorm.DB, messageID, status, errorMsg string) error {
	return db.Model(&MailLog{}).
		Where("message_id = ?", messageID).
		Updates(map[string]interface{}{
			"status":    status,
			"error_msg": errorMsg,
		}).Error
}

func GetMailLogs(db *gorm.DB, userID uint, page, pageSize int) ([]MailLog, int64, error) {
	var logs []MailLog
	var total int64
	query := db.Where("user_id = ?", userID)
	if err := query.Model(&MailLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

func GetMailLogByID(db *gorm.DB, id uint) (*MailLog, error) {
	var log MailLog
	if err := db.First(&log, id).Error; err != nil {
		return nil, err
	}
	return &log, nil
}
