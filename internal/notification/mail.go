// Package notification holds CloudSteps-specific notification helpers
// built on top of ling-base/notification/email and ling-base/notification/inbox.
//
// The ling-base modules provide the provider implementations (SMTP,
// SendCloud) and the inbox Store interface; this package wires them to
// CloudSteps configuration, embedded email templates, and the gorm DB.
package notification

import (
	"bytes"
	"context"
	"fmt"
	"html/template"

	CloudStepsGo "github.com/LingByte/CloudStepsGo"
	"github.com/LingByte/CloudStepsGo/pkg/logger"
	"github.com/LingByte/ling-base/notification/email"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// MailConfig is the CloudSteps mail configuration, mirroring the old
// pkg/notification.MailConfig. It is kept here so pkg/config can stay
// free of ling-base imports while still constructing a provider list.
type MailConfig struct {
	Provider string `json:"provider"`

	// SMTP
	Host     string `json:"host"`
	Port     int64  `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`

	// SendCloud
	APIUser string `json:"api_user"`
	APIKey  string `json:"api_key"`

	// Common
	From string `json:"from"`
}

// BuildMailProviders constructs the ling-base email.MailProvider list
// from a CloudSteps MailConfig. When Provider is empty the list is
// empty (callers should handle that case).
func BuildMailProviders(cfg MailConfig) []email.MailProvider {
	switch cfg.Provider {
	case "sendcloud":
		p, err := email.NewSendCloudProvider(email.SendCloudConfig{
			APIUser: cfg.APIUser,
			APIKey:  cfg.APIKey,
			From:    cfg.From,
		})
		if err != nil {
			logger.Warn("failed to build sendcloud provider", zap.Error(err))
			return nil
		}
		return []email.MailProvider{p}
	case "smtp":
		return []email.MailProvider{
			email.NewSMTPProvider(email.SMTPConfig{
				Host:     cfg.Host,
				Port:     int(cfg.Port),
				Username: cfg.Username,
				Password: cfg.Password,
				From:     cfg.From,
			}),
		}
	default:
		return nil
	}
}

// MailNotification wraps a ling-base email.Mailer and adds CloudSteps-
// specific template rendering and mail-log persistence.
type MailNotification struct {
	mailer    *email.Mailer
	db        *gorm.DB
	userID    uint
	ipAddress string
}

// NewMailNotification creates a MailNotification without a DB (no mail
// logging).
func NewMailNotification(cfg MailConfig) *MailNotification {
	providers := BuildMailProviders(cfg)
	if len(providers) == 0 {
		return &MailNotification{}
	}
	return &MailNotification{mailer: email.NewMailer(providers)}
}

// NewMailNotificationWithDB creates a MailNotification with a DB and
// user ID for mail-log tracking.
func NewMailNotificationWithDB(cfg MailConfig, db *gorm.DB, userID uint) *MailNotification {
	providers := BuildMailProviders(cfg)
	if len(providers) == 0 {
		return &MailNotification{db: db, userID: userID}
	}
	return &MailNotification{mailer: email.NewMailer(providers), db: db, userID: userID}
}

// NewMailNotificationWithIP creates a MailNotification with a DB and
// IP address for anonymous-send mail-log tracking.
func NewMailNotificationWithIP(cfg MailConfig, db *gorm.DB, ipAddress string) *MailNotification {
	providers := BuildMailProviders(cfg)
	if len(providers) == 0 {
		return &MailNotification{db: db, ipAddress: ipAddress}
	}
	return &MailNotification{mailer: email.NewMailer(providers), db: db, ipAddress: ipAddress}
}

// SendHTML sends an HTML email and records a mail log when a DB is
// configured.
func (m *MailNotification) SendHTML(to, subject, htmlBody string) error {
	if m.mailer == nil {
		return fmt.Errorf("notification: no mail provider configured")
	}
	if err := m.mailer.Send(context.Background(), to, subject, htmlBody); err != nil {
		logger.Warn("email send failed",
			zap.String("to", to),
			zap.String("subject", subject),
			zap.Error(err))
		return err
	}

	logger.Info("Email sent via provider",
		zap.String("to", to),
		zap.String("subject", subject),
		zap.Uint("userId", m.userID))

	// Mail log persistence is best-effort; the ling-base Mailer does not
	// surface the provider message ID, so we record an empty one. The
	// old CloudSteps implementation tracked SendCloud message IDs; that
	// behaviour can be restored by wrapping providers if needed.
	if m.db != nil {
		if m.userID > 0 {
			_ = createMailLog(m.db, m.userID, to, subject, "")
		} else if m.ipAddress != "" {
			_ = createMailLogWithIP(m.db, 0, to, subject, "", m.ipAddress)
		}
	}
	return nil
}

// renderTemplate renders an embedded HTML template with data.
func renderTemplate(templateStr string, data interface{}) (string, error) {
	tmpl, err := template.New("email").Parse(templateStr)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to render template: %w", err)
	}
	return buf.String(), nil
}

// SendWelcomeEmail sends the welcome email using the embedded template.
func (m *MailNotification) SendWelcomeEmail(to, username, verifyURL string) error {
	htmlBody, err := renderTemplate(CloudStepsGo.WelcomeHTML, map[string]string{
		"Username":  username,
		"VerifyURL": verifyURL,
	})
	if err != nil {
		return err
	}
	return m.SendHTML(to, "欢迎加入 CloudStepsGo", htmlBody)
}

// SendVerificationCode sends a verification-code email.
func (m *MailNotification) SendVerificationCode(to, code string) error {
	htmlBody, err := renderTemplate(CloudStepsGo.VerificationHTML, map[string]string{
		"Code": code,
	})
	if err != nil {
		return err
	}
	return m.SendHTML(to, "您的 CloudStepsGo 验证码", htmlBody)
}

// SendVerificationEmail sends an email-verification email.
func (m *MailNotification) SendVerificationEmail(to, username, verifyURL string) error {
	htmlBody, err := renderTemplate(CloudStepsGo.EmailVerificationHTML, map[string]string{
		"Username":  username,
		"VerifyURL": verifyURL,
	})
	if err != nil {
		return err
	}
	return m.SendHTML(to, "请验证您的邮箱地址", htmlBody)
}

// SendPasswordResetEmail sends a password-reset email.
func (m *MailNotification) SendPasswordResetEmail(to, username, resetURL string) error {
	htmlBody, err := renderTemplate(CloudStepsGo.PasswordResetHTML, map[string]string{
		"Username": username,
		"ResetURL": resetURL,
	})
	if err != nil {
		return err
	}
	return m.SendHTML(to, "密码重置请求", htmlBody)
}

// SendDeviceVerificationCode sends a device-verification-code email.
func (m *MailNotification) SendDeviceVerificationCode(to, username, code, deviceID string) error {
	htmlBody, err := renderTemplate(CloudStepsGo.DeviceVerificationHTML, map[string]string{
		"Username": username,
		"Code":     code,
		"DeviceID": deviceID,
	})
	if err != nil {
		return err
	}
	return m.SendHTML(to, "设备验证码", htmlBody)
}

// SendGroupInvitationEmail sends an organization-invitation email.
func (m *MailNotification) SendGroupInvitationEmail(to, inviteeName, inviterName, groupName, groupType, groupDescription, acceptURL string) error {
	htmlBody, err := renderTemplate(CloudStepsGo.GroupInvitationHTML, map[string]string{
		"InviteeName":      inviteeName,
		"InviterName":      inviterName,
		"GroupName":        groupName,
		"GroupType":        groupType,
		"GroupDescription": groupDescription,
		"AcceptURL":        acceptURL,
	})
	if err != nil {
		return err
	}
	return m.SendHTML(to, fmt.Sprintf("您收到了来自 %s 的组织邀请", inviterName), htmlBody)
}

// SendNewDeviceLoginAlert sends a new-device-login alert email.
func (m *MailNotification) SendNewDeviceLoginAlert(to, username, loginTime, ipAddress, location, deviceType, os, browser string, isSuspicious bool, securityURL, changePasswordURL string) error {
	htmlBody, err := renderTemplate(CloudStepsGo.NewDeviceLoginHTML, map[string]interface{}{
		"Username":          username,
		"LoginTime":         loginTime,
		"IPAddress":         ipAddress,
		"Location":          location,
		"DeviceType":        deviceType,
		"OS":                os,
		"Browser":           browser,
		"IsSuspicious":      isSuspicious,
		"SecurityURL":       securityURL,
		"ChangePasswordURL": changePasswordURL,
	})
	if err != nil {
		return err
	}
	subject := "新设备登录提醒"
	if isSuspicious {
		subject = "⚠️ 可疑登录警告"
	}
	return m.SendHTML(to, subject, htmlBody)
}
