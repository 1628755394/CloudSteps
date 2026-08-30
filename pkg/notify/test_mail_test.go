package notify

import (
	"strings"
	"testing"
)

func TestTestMail_Validate(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		mail TestMail
		ok   bool
	}{
		{name: "missing to", mail: TestMail{Mode: TestModeText, Subject: "s", Body: "b"}},
		{name: "bad to", mail: TestMail{To: "not-an-email", Mode: TestModeText, Subject: "s", Body: "b"}},
		{name: "template missing code", mail: TestMail{To: "a@b.com", Mode: TestModeTemplate}},
		{name: "text missing subject", mail: TestMail{To: "a@b.com", Mode: TestModeText, Body: "hello"}},
		{name: "text missing body", mail: TestMail{To: "a@b.com", Mode: TestModeText, Subject: "hi"}},
		{name: "unknown mode", mail: TestMail{To: "a@b.com", Mode: "push", Subject: "s", Body: "b"}},
		{name: "template ok", mail: TestMail{To: " a@b.com ", Mode: "TEMPLATE", Code: " welcome "}, ok: true},
		{name: "text ok", mail: TestMail{To: "a@b.com", Mode: TestModeText, Subject: "hi", Body: "hello"}, ok: true},
		{name: "defaults to template when code set", mail: TestMail{To: "a@b.com", Code: "welcome"}, ok: true},
		{name: "defaults to text when body set", mail: TestMail{To: "a@b.com", Subject: "hi", Body: "hello"}, ok: true},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.mail.Normalize().Validate()
			if tt.ok && err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if !tt.ok && err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestPlainTextHTML_escapes(t *testing.T) {
	t.Parallel()
	got := PlainTextHTML("<script>alert(1)</script>\nnext")
	if strings.Contains(got, "<script>") {
		t.Fatalf("script leaked: %q", got)
	}
	if !strings.Contains(got, "&lt;script&gt;") || !strings.Contains(got, "<br>") {
		t.Fatalf("got %q", got)
	}
}

func TestTestMail_Send_rejectsInvalid(t *testing.T) {
	err := (TestMail{}).Send(nil, nil)
	if err == nil {
		t.Fatal("expected validate error")
	}
}
