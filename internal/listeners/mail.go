package listeners

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/internal/notify"
	"gorm.io/gorm"
)

func init() {
	notify.RegisterChannelLoader(EnabledMailConfigs)
	notify.RegisterEmailTemplateLoader(loadEmailTemplate)
	notify.RegisterInboxTemplateLoader(loadInboxTemplate)
}

// EnabledMailConfigs returns all enabled email channels for the system mail service.
func EnabledMailConfigs(db *gorm.DB) ([]notify.MailConfig, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	var rows []models.NotificationChannel
	if err := db.Where("type = ? AND enabled = ? AND is_deleted = ?", models.NotificationChannelTypeEmail, true, models.SoftDeleteStatusActive).
		Order("sort_order ASC, id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]notify.MailConfig, 0, len(rows))
	for _, row := range rows {
		raw := strings.TrimSpace(row.ConfigJSON)
		if raw == "" {
			continue
		}
		var cfg notify.MailConfig
		if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
			continue
		}
		if strings.TrimSpace(cfg.Name) == "" {
			cfg.Name = row.Name
		}
		out = append(out, cfg)
	}
	if len(out) == 0 {
		return nil, errors.New("no enabled email notification channels")
	}
	return out, nil
}

func loadEmailTemplate(db *gorm.DB, code, locale string) (notify.LoadedEmailTemplate, error) {
	tpl, err := models.GetMailTemplateByCodeAndType(db, code, locale, models.NotificationTemplateTypeEmail)
	if err != nil {
		return notify.LoadedEmailTemplate{}, err
	}
	return notify.LoadedEmailTemplate{
		Subject:  tpl.Subject,
		HTMLBody: tpl.HTMLBody,
	}, nil
}

func loadInboxTemplate(db *gorm.DB, code, locale string) (notify.LoadedInboxTemplate, error) {
	tpl, err := models.GetMailTemplateByCodeAndType(db, code, locale, models.NotificationTemplateTypeInbox)
	if err != nil {
		return notify.LoadedInboxTemplate{}, err
	}
	return notify.LoadedInboxTemplate{
		Title: tpl.InboxTitle,
		Body:  tpl.InboxBody,
	}, nil
}
