package notify

import (
	"fmt"
	"strings"

	"github.com/LingByte/ling-base/notification/email"
)

const (
	ProviderSMTP      = "smtp"
	ProviderSendCloud = "sendcloud"
)

// MailConfig is the JSON stored on NotificationChannel.ConfigJSON.
// Same shape as LingEchoX pkg/notification/mail.MailConfig.
type MailConfig struct {
	Provider string `json:"provider"` // "smtp" | "sendcloud"
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int64  `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	APIUser  string `json:"api_user"`
	APIKey   string `json:"api_key"`
	From     string `json:"from"`
	FromName string `json:"from_name,omitempty"`
}

// ProvidersFromConfigs builds ling-base email providers, skipping invalid slots.
func ProvidersFromConfigs(cfgs []MailConfig) []email.MailProvider {
	out := make([]email.MailProvider, 0, len(cfgs))
	for _, cfg := range cfgs {
		p, err := providerFromConfig(cfg)
		if err != nil {
			continue
		}
		out = append(out, p)
	}
	return out
}

func providerFromConfig(cfg MailConfig) (email.MailProvider, error) {
	switch strings.ToLower(strings.TrimSpace(cfg.Provider)) {
	case ProviderSendCloud:
		if strings.TrimSpace(cfg.APIUser) == "" || strings.TrimSpace(cfg.APIKey) == "" || strings.TrimSpace(cfg.From) == "" {
			return nil, fmt.Errorf("notification: sendcloud requires api_user, api_key, from")
		}
		return email.NewSendCloudProvider(email.SendCloudConfig{
			APIUser:  cfg.APIUser,
			APIKey:   cfg.APIKey,
			From:     cfg.From,
			FromName: cfg.FromName,
		})
	default:
		if strings.TrimSpace(cfg.Host) == "" || cfg.Port == 0 || strings.TrimSpace(cfg.From) == "" {
			return nil, fmt.Errorf("notification: smtp requires host, port, from")
		}
		return email.NewSMTPProvider(email.SMTPConfig{
			Host:     cfg.Host,
			Port:     int(cfg.Port),
			Username: cfg.Username,
			Password: cfg.Password,
			From:     cfg.From,
			FromName: cfg.FromName,
		}), nil
	}
}

func channelLabel(cfg MailConfig) string {
	if strings.TrimSpace(cfg.Name) != "" {
		return strings.TrimSpace(cfg.Name)
	}
	switch strings.ToLower(strings.TrimSpace(cfg.Provider)) {
	case ProviderSendCloud:
		if cfg.APIUser != "" {
			return "sendcloud:" + cfg.APIUser
		}
		return ProviderSendCloud
	default:
		if cfg.Host != "" {
			return cfg.Host
		}
		return ProviderSMTP
	}
}

func initialMailStatus(kind string) string {
	if strings.EqualFold(kind, ProviderSMTP) {
		return "delivered"
	}
	return "sent"
}
