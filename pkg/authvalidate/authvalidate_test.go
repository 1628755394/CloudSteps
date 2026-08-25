package authvalidate

import (
	"testing"

	"github.com/LingByte/CloudStepsGo/internal/models"
	lbvalidate "github.com/LingByte/ling-base/common/validate"
)

func TestPrepareEmailRegister_acceptsEmailAccount(t *testing.T) {
	form := &models.UserOperatorForm{
		Username: "user@example.com",
		Password: "password1",
		Code:     "123456",
	}
	if err := PrepareEmailRegister(form); err != nil {
		t.Fatalf("PrepareEmailRegister() error = %v", err)
	}
	if form.Username != "user@example.com" {
		t.Fatalf("username = %q", form.Username)
	}
}

func TestPrepareEmailRegister_rejectsInvalidUsernameChars(t *testing.T) {
	form := &models.UserOperatorForm{
		Username: "bad username",
		Password: "password1",
		Code:     "123456",
	}
	err := PrepareEmailRegister(form)
	if err == nil {
		t.Fatal("expected email validation error")
	}
}

func TestPreparePasswordLogin_acceptsUsernameOrEmail(t *testing.T) {
	userForm := &models.LoginForm{Username: "teacher01", Password: "password1"}
	if err := PreparePasswordLogin(userForm); err != nil {
		t.Fatalf("username login: %v", err)
	}
	if userForm.Username != "teacher01" {
		t.Fatalf("username = %q", userForm.Username)
	}

	emailForm := &models.LoginForm{Email: "User@Example.com", Password: "password1"}
	if err := PreparePasswordLogin(emailForm); err != nil {
		t.Fatalf("email login: %v", err)
	}
	if emailForm.Username != "user@example.com" {
		t.Fatalf("normalized email = %q", emailForm.Username)
	}
}

func TestPreparePasswordRegister_acceptsPlainUsername(t *testing.T) {
	form := &models.RegisterUserForm{
		Username: "teacher01",
		Password: "password1",
	}
	if err := PreparePasswordRegister(form); err != nil {
		t.Fatalf("PreparePasswordRegister() error = %v", err)
	}
}

func TestMessage_mapsRequired(t *testing.T) {
	msg := Message(lbvalidate.FieldError{Field: "Password", Rule: "required", Message: "is required"})
	if msg != "请输入密码" {
		t.Fatalf("msg = %q", msg)
	}
}
