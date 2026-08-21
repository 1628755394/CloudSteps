package notify

import (
	"context"
	"errors"
	"fmt"
	"html"
	"strings"
)

const (
	TestModeTemplate = "template"
	TestModeText     = "text"
)

// TestMail is an admin test send: a template code or plain text to one address.
type TestMail struct {
	To      string
	Mode    string // template | text
	Code    string
	Vars    map[string]any
	Subject string
	Body    string
}

func (t TestMail) Normalize() TestMail {
	t.To = strings.TrimSpace(t.To)
	t.Mode = strings.ToLower(strings.TrimSpace(t.Mode))
	t.Code = strings.TrimSpace(t.Code)
	t.Subject = strings.TrimSpace(t.Subject)
	if t.Mode == "" {
		if t.Code != "" {
			t.Mode = TestModeTemplate
		} else {
			t.Mode = TestModeText
		}
	}
	return t
}

func (t TestMail) Validate() error {
	t = t.Normalize()
	if t.To == "" || !strings.Contains(t.To, "@") {
		return errors.New("notification: test mail needs a valid to address")
	}
	switch t.Mode {
	case TestModeTemplate:
		if t.Code == "" {
			return errors.New("notification: test mail template mode needs code")
		}
	case TestModeText:
		if t.Subject == "" {
			return errors.New("notification: test mail text mode needs subject")
		}
		if strings.TrimSpace(t.Body) == "" {
			return errors.New("notification: test mail text mode needs body")
		}
	default:
		return fmt.Errorf("notification: unknown test mail mode %q", t.Mode)
	}
	return nil
}

// PlainTextHTML wraps escaped plain text as a simple HTML body.
func PlainTextHTML(body string) string {
	escaped := html.EscapeString(body)
	escaped = strings.ReplaceAll(escaped, "\n", "<br>\n")
	return `<div style="font-family:sans-serif;white-space:pre-wrap;line-height:1.5">` + escaped + `</div>`
}

func (t TestMail) Send(ctx context.Context, m *Mailer) error {
	t = t.Normalize()
	if err := t.Validate(); err != nil {
		return err
	}
	if m == nil {
		return errors.New("notification: mailer not initialized with db")
	}
	if t.Mode == TestModeTemplate {
		return m.Send(ctx, t.To, t.Code, t.Vars)
	}
	return m.SendRaw(ctx, t.To, t.Subject, PlainTextHTML(t.Body))
}
