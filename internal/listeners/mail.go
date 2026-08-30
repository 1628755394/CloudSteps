package listeners

import (
	"encoding/json"
	"errors"
	"strings"

	notify2 "github.com/LingByte/CloudStepsGo/pkg/notify"
	"gorm.io/gorm"
)

func init() {
	notify2.RegisterChannelLoader(EnabledMailConfigs)
	notify2.RegisterEmailTemplateLoader(loadEmailTemplate)
	notify2.RegisterInboxTemplateLoader(loadInboxTemplate)
}

// EnabledMailConfigs returns all enabled email channels for the system mail service.
func EnabledMailConfigs(db *gorm.DB) ([]notify2.MailConfig, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	var rows []notify2.NotificationChannel
	if err := db.Where("type = ? AND enabled = ?", notify2.NotificationChannelTypeEmail, true).
		Order("sort_order ASC, id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]notify2.MailConfig, 0, len(rows))
	for _, row := range rows {
		raw := strings.TrimSpace(row.ConfigJSON)
		if raw == "" {
			continue
		}
		var cfg notify2.MailConfig
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

func loadEmailTemplate(db *gorm.DB, code, locale string) (notify2.LoadedEmailTemplate, error) {
	tpl, err := notify2.GetMailTemplateByCodeAndType(db, code, locale, notify2.NotificationTemplateTypeEmail)
	if err != nil {
		return notify2.LoadedEmailTemplate{}, err
	}
	return notify2.LoadedEmailTemplate{
		Subject:  tpl.Subject,
		HTMLBody: tpl.HTMLBody,
	}, nil
}

func loadInboxTemplate(db *gorm.DB, code, locale string) (notify2.LoadedInboxTemplate, error) {
	tpl, err := notify2.GetMailTemplateByCodeAndType(db, code, locale, notify2.NotificationTemplateTypeInbox)
	if err != nil {
		return notify2.LoadedInboxTemplate{}, err
	}
	return notify2.LoadedInboxTemplate{
		Title: tpl.InboxTitle,
		Body:  tpl.InboxBody,
	}, nil
}
