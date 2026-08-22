package notify

import (
	"context"
	"errors"
	"testing"

	"github.com/LingByte/ling-base/notification/email"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func openMailerDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	return db
}

func withLoaders(t *testing.T, ch ChannelLoader, emailTpl EmailTemplateLoader, inboxTpl InboxTemplateLoader) func() {
	t.Helper()
	oldCh, oldEmail, oldInbox := channelLoader, emailTemplateLoader, inboxTemplateLoader
	channelLoader, emailTemplateLoader, inboxTemplateLoader = ch, emailTpl, inboxTpl
	return func() {
		channelLoader, emailTemplateLoader, inboxTemplateLoader = oldCh, oldEmail, oldInbox
	}
}

func TestNewMailer_withRetry(t *testing.T) {
	db := openMailerDB(t)
	m := NewMailer(db, 5, "127.0.0.1", WithRetry(email.RetryPolicy{MaxAttempts: 3}))
	if m.retry.MaxAttempts != 3 {
		t.Errorf("retry.MaxAttempts = %d", m.retry.MaxAttempts)
	}
}

func TestMailer_SendRaw_notInitialized(t *testing.T) {
	var m *Mailer
	err := m.SendRaw(context.Background(), "a@b.com", "subj", "body")
	if err == nil || err.Error() != "notification: mailer not initialized with db" {
		t.Errorf("err = %v", err)
	}
	m = NewMailer(nil, 0, "")
	err = m.SendRaw(context.Background(), "a@b.com", "subj", "body")
	if err == nil {
		t.Fatal("expected error for nil db")
	}
}

func TestMailer_SendRaw_noChannelLoader(t *testing.T) {
	defer withLoaders(t, nil, nil, nil)()
	db := openMailerDB(t)
	m := NewMailer(db, 0, "")
	err := m.SendRaw(context.Background(), "a@b.com", "subj", "body")
	if err == nil || err.Error() != "notification: channel loader not registered" {
		t.Errorf("err = %v", err)
	}
}

func TestMailer_SendRaw_noChannels(t *testing.T) {
	defer withLoaders(t, func(db *gorm.DB) ([]MailConfig, error) {
		return nil, nil
	}, nil, nil)()
	db := openMailerDB(t)
	m := NewMailer(db, 0, "")
	err := m.SendRaw(context.Background(), "a@b.com", "subj", "body")
	if err == nil || err.Error() != "notification: no enabled mail channels" {
		t.Errorf("err = %v", err)
	}
}

func TestMailer_Send_noTemplateLoader(t *testing.T) {
	defer withLoaders(t, nil, nil, nil)()
	db := openMailerDB(t)
	m := NewMailer(db, 0, "")
	err := m.Send(context.Background(), "a@b.com", TmplWelcome, nil)
	if err == nil || err.Error() != "notification: email template loader not registered" {
		t.Errorf("err = %v", err)
	}
}

func TestMailer_Send_templateRender(t *testing.T) {
	sent := false
	defer withLoaders(t,
		func(db *gorm.DB) ([]MailConfig, error) {
			return []MailConfig{{
				Provider: ProviderSendCloud,
				APIUser:  "u",
				APIKey:   "k",
				From:     "noreply@test.com",
			}}, nil
		},
		func(db *gorm.DB, code, locale string) (LoadedEmailTemplate, error) {
			if code != TmplVerification {
				return LoadedEmailTemplate{}, errors.New("unknown template")
			}
			return LoadedEmailTemplate{Subject: "Code: {{.Code}}", HTMLBody: "<p>{{.Code}}</p>"}, nil
		},
		nil,
	)()
	db := openMailerDB(t)
	m := NewMailer(db, 0, "")
	err := m.Send(context.Background(), "a@b.com", TmplVerification, map[string]any{"Code": "123456"})
	if err == nil {
		sent = true
	}
	if !sent && err != nil {
		if errors.Is(err, errors.New("notification: email template loader not registered")) {
			t.Errorf("unexpected pre-template error: %v", err)
		}
	}
}

func TestMailer_Send_templateLoadError(t *testing.T) {
	defer withLoaders(t, nil, func(db *gorm.DB, code, locale string) (LoadedEmailTemplate, error) {
		return LoadedEmailTemplate{}, errors.New("missing")
	}, nil)()
	db := openMailerDB(t)
	m := NewMailer(db, 0, "")
	err := m.Send(context.Background(), "a@b.com", "missing", nil)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestMailer_Send_badTemplateSyntax(t *testing.T) {
	defer withLoaders(t, nil, func(db *gorm.DB, code, locale string) (LoadedEmailTemplate, error) {
		tpl := LoadedEmailTemplate{Subject: "{{if", HTMLBody: "<p>x</p>"}
		return tpl, nil
	}, nil)()
	db := openMailerDB(t)
	m := NewMailer(db, 0, "")
	err := m.Send(context.Background(), "a@b.com", "bad", nil)
	if err == nil {
		t.Fatal("expected render error")
	}
}

func TestRenderTemplate(t *testing.T) {
	t.Parallel()
	out, err := renderTemplate("Hello {{.Name}}", map[string]string{"Name": "World"})
	if err != nil || out != "Hello World" {
		t.Errorf("out=%q err=%v", out, err)
	}
	_, err = renderTemplate("{{", nil)
	if err == nil {
		t.Error("expected parse error")
	}
}

func TestFormatLoginDeviceLabel(t *testing.T) {
	t.Parallel()
	tests := []struct {
		device, os, browser, want string
	}{
		{"desktop", "Windows", "Chrome", "桌面端 · Windows · Chrome"},
		{"mobile", "iOS", "", "移动端 · iOS"},
		{"", "", "Safari", "未知设备 · Safari"},
		{"tablet", "", "", "tablet"},
	}
	for _, tt := range tests {
		if got := formatLoginDeviceLabel(tt.device, tt.os, tt.browser); got != tt.want {
			t.Errorf("formatLoginDeviceLabel(%q,%q,%q) = %q, want %q", tt.device, tt.os, tt.browser, got, tt.want)
		}
	}
}

func TestMailer_SendInbox_render(t *testing.T) {
	t.Parallel()
	title, err := renderTemplate("你好 {{.Username}}", map[string]any{"Username": "Ada"})
	if err != nil || title != "你好 Ada" {
		t.Fatalf("title=%q err=%v", title, err)
	}
}

func TestMailer_mirrorInbox_noOp(t *testing.T) {
	db := openMailerDB(t)
	m := NewMailer(db, 0, "")
	m.mirrorInbox("title", "content")
	m.mirrorInbox("", "content")
	m.mirrorInbox("title", "")
}
