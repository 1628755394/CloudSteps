package notify

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html/template"
	"strconv"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/ling-base/logger"
	"github.com/LingByte/ling-base/notification/email"
	"github.com/LingByte/ling-base/notification/inbox"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	TmplWelcome            = "welcome"
	TmplVerification       = "verification"
	TmplEmailVerification  = "email_verification"
	TmplPasswordReset      = "password_reset"
	TmplDeviceVerification = "device_verification"
	TmplGroupInvitation    = "group_invitation"
	TmplNewDeviceLogin     = "new_device_login"
	TmplLogin              = "login"
	TmplLogout             = "logout"
	TmplChangeEmail        = "change_email"
	TmplChangeEmailDone    = "change_email_done"
	TmplFeedbackReply      = "feedback_reply"
)

// ChannelLoader loads enabled system email channels.
type ChannelLoader func(db *gorm.DB) ([]MailConfig, error)

// LoadedEmailTemplate is rendered email content.
type LoadedEmailTemplate struct {
	Subject  string
	HTMLBody string
}

// LoadedInboxTemplate is rendered in-app copy.
type LoadedInboxTemplate struct {
	Title string
	Body  string
}

// EmailTemplateLoader loads an email notification template by code.
type EmailTemplateLoader func(db *gorm.DB, code, locale string) (LoadedEmailTemplate, error)

// InboxTemplateLoader loads an inbox notification template by code.
type InboxTemplateLoader func(db *gorm.DB, code, locale string) (LoadedInboxTemplate, error)

var (
	channelLoader       ChannelLoader
	emailTemplateLoader EmailTemplateLoader
	inboxTemplateLoader InboxTemplateLoader
)

// RegisterChannelLoader is injected from internal/listeners.
func RegisterChannelLoader(fn ChannelLoader) { channelLoader = fn }

// RegisterEmailTemplateLoader is injected from internal/listeners.
func RegisterEmailTemplateLoader(fn EmailTemplateLoader) { emailTemplateLoader = fn }

// RegisterInboxTemplateLoader is injected from internal/listeners.
func RegisterInboxTemplateLoader(fn InboxTemplateLoader) { inboxTemplateLoader = fn }

// MailerOption configures optional Mailer behaviour.
type MailerOption func(*Mailer)

// WithRetry sets per-send retry policy for ling-base email failover.
func WithRetry(p email.RetryPolicy) MailerOption {
	return func(m *Mailer) {
		if p.MaxAttempts < 1 {
			p.MaxAttempts = 1
		}
		m.retry = p
	}
}

// Mailer is the business-facing send facade (LingEchoX pkg/notification.Mailer).
type Mailer struct {
	db     *gorm.DB
	userID uint
	ip     string
	retry  email.RetryPolicy
}

// NewMailer constructs a Mailer. db is required; userID/ip are for mail log attribution.
func NewMailer(db *gorm.DB, userID uint, ip string, opts ...MailerOption) *Mailer {
	m := &Mailer{
		db:     db,
		userID: userID,
		ip:     ip,
		retry:  email.DefaultRetryPolicy(),
	}
	for _, fn := range opts {
		fn(m)
	}
	return m
}

// SendRaw sends already-rendered subject/html (no template lookup).
func (m *Mailer) SendRaw(ctx context.Context, to, subject, htmlBody string) error {
	if m == nil || m.db == nil {
		return errors.New("notification: mailer not initialized with db")
	}
	if channelLoader == nil {
		err := errors.New("notification: channel loader not registered")
		m.recordPreflightFailure(to, subject, htmlBody, "no_channel", err.Error())
		return err
	}
	cfgs, err := channelLoader(m.db)
	if err != nil {
		werr := fmt.Errorf("notification: load channels: %w", err)
		m.recordPreflightFailure(to, subject, htmlBody, "load_channel", werr.Error())
		return werr
	}
	if len(cfgs) == 0 {
		err := errors.New("notification: no enabled mail channels")
		m.recordPreflightFailure(to, subject, htmlBody, "no_channel", err.Error())
		return err
	}
	providers := ProvidersFromConfigs(cfgs)
	if len(providers) == 0 {
		err := errors.New("notification: no valid mail channels after filtering invalid configs")
		m.recordPreflightFailure(to, subject, htmlBody, "no_channel", err.Error())
		return err
	}
	mailer := email.NewMailer(providers, email.WithRetryPolicy(m.retry))
	if err := mailer.Send(ctx, to, subject, htmlBody); err != nil {
		logger.Error("notification: send failed",
			zap.String("to", to), zap.String("subject", subject),
			zap.Uint("userId", m.userID), zap.Error(err))
		_, _ = models.CreateFailedMailLog(m.db, m.userID, "multi", channelSummary(cfgs), to, subject, htmlBody, err.Error(), 0, m.ip)
		return err
	}
	kind := providers[0].Kind()
	status := initialMailStatus(kind)
	_, dbErr := models.CreateMailLog(m.db, m.userID, kind, channelLabel(cfgs[0]), to, subject, htmlBody, "", status, m.ip)
	if dbErr != nil {
		logger.Error("notification: mail log create failed",
			zap.String("to", to), zap.Error(dbErr))
	}
	logger.Info("notification: send ok",
		zap.String("to", to), zap.String("subject", subject), zap.Uint("userId", m.userID))
	return nil
}

func (m *Mailer) mirrorInbox(title, content string) {
	if m == nil || m.db == nil || m.userID == 0 || title == "" || content == "" {
		return
	}
	store := inbox.NewGormStore(m.db)
	if err := store.Create(inbox.Message{
		UserID:  strconv.FormatUint(uint64(m.userID), 10),
		Title:   title,
		Content: content,
	}); err != nil {
		logger.Warn("notification: inbox mirror failed",
			zap.Uint("userId", m.userID), zap.String("title", title), zap.Error(err))
	}
}

func (m *Mailer) recordPreflightFailure(to, subject, htmlBody, channelLabel, errMsg string) {
	if m == nil || m.db == nil {
		return
	}
	if _, dbErr := models.CreateFailedMailLog(m.db, m.userID, "none", channelLabel, to, subject, htmlBody, errMsg, 0, m.ip); dbErr != nil {
		logger.Error("notification: preflight failed mail_log create failed",
			zap.String("to", to), zap.String("subject", subject), zap.Error(dbErr))
	}
}

// Send renders an email template and sends via configured channels.
func (m *Mailer) Send(ctx context.Context, to, code string, data map[string]any) error {
	return m.SendEmail(ctx, to, code, data)
}

// SendEmail renders an email-type notification template and sends.
func (m *Mailer) SendEmail(ctx context.Context, to, code string, data map[string]any) error {
	if m == nil || m.db == nil {
		return errors.New("notification: mailer not initialized with db")
	}
	if emailTemplateLoader == nil {
		err := errors.New("notification: email template loader not registered")
		m.recordPreflightFailure(to, "[template:"+code+"]", "", "no_template", err.Error())
		return err
	}
	tpl, err := emailTemplateLoader(m.db, code, "")
	if err != nil {
		werr := fmt.Errorf("notification: load email template %q: %w", code, err)
		m.recordPreflightFailure(to, "[template:"+code+"]", "", "load_template", werr.Error())
		return werr
	}
	subjOut, err := renderTemplate(tpl.Subject, data)
	if err != nil {
		werr := fmt.Errorf("notification: render subject %q: %w", code, err)
		m.recordPreflightFailure(to, tpl.Subject, tpl.HTMLBody, "render_subject", werr.Error())
		return werr
	}
	htmlOut, err := renderTemplate(tpl.HTMLBody, data)
	if err != nil {
		werr := fmt.Errorf("notification: render html %q: %w", code, err)
		m.recordPreflightFailure(to, subjOut, tpl.HTMLBody, "render_html", werr.Error())
		return werr
	}
	return m.SendRaw(ctx, to, subjOut, htmlOut)
}

// SendInbox renders an inbox-type notification template and writes to the user inbox.
func (m *Mailer) SendInbox(code string, data map[string]any) error {
	if m == nil || m.db == nil {
		return errors.New("notification: mailer not initialized with db")
	}
	if inboxTemplateLoader == nil {
		return errors.New("notification: inbox template loader not registered")
	}
	tpl, err := inboxTemplateLoader(m.db, code, "")
	if err != nil {
		return fmt.Errorf("notification: load inbox template %q: %w", code, err)
	}
	title, err := renderTemplate(tpl.Title, data)
	if err != nil {
		return fmt.Errorf("notification: render inbox title %q: %w", code, err)
	}
	body, err := renderTemplate(tpl.Body, data)
	if err != nil {
		return fmt.Errorf("notification: render inbox body %q: %w", code, err)
	}
	m.mirrorInbox(title, body)
	return nil
}

func renderTemplate(src string, data any) (string, error) {
	tmpl, err := template.New("email").Parse(src)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func (m *Mailer) SendWelcomeEmail(to, username, verifyURL string) error {
	return m.Send(context.Background(), to, TmplWelcome, map[string]any{
		"Username": username, "VerifyURL": verifyURL,
	})
}

func (m *Mailer) SendVerificationCode(to, code string) error {
	return m.Send(context.Background(), to, TmplVerification, map[string]any{"Code": code})
}

func (m *Mailer) SendVerificationEmail(to, username, verifyURL string) error {
	return m.Send(context.Background(), to, TmplEmailVerification, map[string]any{
		"Username": username, "VerifyURL": verifyURL,
	})
}

func (m *Mailer) SendPasswordResetEmail(to, username, resetURL string) error {
	return m.Send(context.Background(), to, TmplPasswordReset, map[string]any{
		"Username": username, "ResetURL": resetURL,
	})
}

func (m *Mailer) SendDeviceVerificationCode(to, username, code, deviceID string) error {
	return m.Send(context.Background(), to, TmplDeviceVerification, map[string]any{
		"Username": username, "Code": code, "DeviceID": deviceID,
	})
}

func (m *Mailer) SendGroupInvitationEmail(to, inviteeName, inviterName, groupName, groupType, groupDescription, acceptURL string) error {
	return m.Send(context.Background(), to, TmplGroupInvitation, map[string]any{
		"InviteeName":      inviteeName,
		"InviterName":      inviterName,
		"GroupName":        groupName,
		"GroupType":        groupType,
		"GroupDescription": groupDescription,
		"AcceptURL":        acceptURL,
	})
}

func (m *Mailer) SendNewDeviceLoginAlert(to, username, loginTime, ipAddress, location, deviceType, os, browser string, isSuspicious bool, securityURL, changePasswordURL string) error {
	return m.Send(context.Background(), to, TmplNewDeviceLogin, map[string]any{
		"Username":          username,
		"LoginTime":         loginTime,
		"IPAddress":         ipAddress,
		"Location":          location,
		"DeviceType":        deviceType,
		"OS":                os,
		"Browser":           browser,
		"DeviceLabel":       formatLoginDeviceLabel(deviceType, os, browser),
		"IsSuspicious":      isSuspicious,
		"SecurityURL":       securityURL,
		"ChangePasswordURL": changePasswordURL,
	})
}

func (m *Mailer) SendLoginNotice(to, username, loginTime, ipAddress string) error {
	return m.Send(context.Background(), to, TmplLogin, map[string]any{
		"Username": username, "LoginTime": loginTime, "IPAddress": ipAddress,
	})
}

func (m *Mailer) SendLogoutNotice(to, username, logoutTime, ipAddress string) error {
	return m.Send(context.Background(), to, TmplLogout, map[string]any{
		"Username": username, "LogoutTime": logoutTime, "IPAddress": ipAddress,
	})
}

func (m *Mailer) SendChangeEmailVerification(to, username, newEmail, verifyURL string) error {
	return m.Send(context.Background(), to, TmplChangeEmail, map[string]any{
		"Username": username, "NewEmail": newEmail, "VerifyURL": verifyURL,
	})
}

func (m *Mailer) SendChangeEmailDoneNotice(to, username, oldEmail, newEmail string) error {
	return m.Send(context.Background(), to, TmplChangeEmailDone, map[string]any{
		"Username": username, "OldEmail": oldEmail, "NewEmail": newEmail,
	})
}

func formatLoginDeviceLabel(deviceType, os, browser string) string {
	label := strings.TrimSpace(deviceType)
	switch strings.ToLower(label) {
	case "desktop":
		label = "桌面端"
	case "mobile":
		label = "移动端"
	case "":
		label = "未知设备"
	}
	if os = strings.TrimSpace(os); os != "" {
		label += " · " + os
	}
	if browser = strings.TrimSpace(browser); browser != "" {
		label += " · " + browser
	}
	return label
}

func channelSummary(cfgs []MailConfig) string {
	names := make([]string, 0, len(cfgs))
	for _, cfg := range cfgs {
		names = append(names, channelLabel(cfg))
	}
	if len(names) == 0 {
		return "multi"
	}
	return strings.Join(names, " → ")
}
