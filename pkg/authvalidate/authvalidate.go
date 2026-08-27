package authvalidate

import (
	"errors"
	"fmt"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/models"
	lbvalidate "github.com/LingByte/ling-base/common/validate"
)

// Message returns the first user-facing validation message.
func Message(err error) string {
	if err == nil {
		return ""
	}
	var fieldErr lbvalidate.FieldError
	if errors.As(err, &fieldErr) {
		return friendlyField(fieldErr)
	}
	var errs lbvalidate.Errors
	if errors.As(err, &errs) && len(errs) > 0 {
		return friendlyField(errs[0])
	}
	msg := err.Error()
	if strings.HasPrefix(msg, "validate: field ") {
		if i := strings.LastIndex(msg, ": "); i >= 0 {
			return friendlyRule(msg[i+2:])
		}
	}
	return msg
}

func friendlyField(fe lbvalidate.FieldError) string {
	switch fe.Field {
	case "Email":
		switch fe.Rule {
		case "required":
			return "请输入邮箱"
		case "email":
			return "邮箱格式不正确"
		case "min":
			return "账号至少 2 个字符"
		case "max":
			return "账号过长"
		}
	case "Username":
		switch fe.Rule {
		case "required":
			return "请输入账号"
		case "email":
			return "邮箱格式不正确"
		case "min":
			return "账号至少 2 个字符"
		case "max":
			return "账号过长"
		}
	case "Password":
		switch fe.Rule {
		case "required":
			return "请输入密码"
		case "min":
			return "密码至少 6 位"
		case "max":
			return "密码过长"
		}
	case "Code":
		switch fe.Rule {
		case "required":
			return "请输入验证码"
		case "min":
			return "验证码长度不正确"
		}
	case "DisplayName":
		if fe.Rule == "max" {
			return "显示名过长"
		}
	}
	if fe.Message != "" {
		return friendlyRule(fe.Message)
	}
	return "参数校验失败"
}

func friendlyRule(msg string) string {
	switch msg {
	case "is required":
		return "必填项不能为空"
	case "must be a valid email address":
		return "邮箱格式不正确"
	case "password must be at least 8 characters long", "password must be at least 6 characters long":
		return "密码至少 6 位"
	default:
		if strings.Contains(msg, "min:") && strings.Contains(msg, "length") {
			return "长度不符合要求"
		}
		return msg
	}
}

func check(err error) error {
	if err == nil {
		return nil
	}
	var fe lbvalidate.FieldError
	if errors.As(err, &fe) {
		return fe
	}
	return err
}

func normalizeEmail(s string) string {
	return strings.ToLower(strings.ReplaceAll(strings.TrimSpace(s), " ", ""))
}

func normalizeText(s string) string {
	return strings.TrimSpace(s)
}

func validateAccount(account string) error {
	account = normalizeText(account)
	if account == "" {
		return lbvalidate.FieldError{Field: "Username", Rule: "required", Message: "is required"}
	}
	if strings.Contains(account, "@") {
		return check(lbvalidate.ValidateWithTag(normalizeEmail(account), "email"))
	}
	if err := check(lbvalidate.ValidateWithTag(account, "required,min=2,max=30")); err != nil {
		return err
	}
	return nil
}

func validatePassword(password string) error {
	password = normalizeText(password)
	if strings.Contains(password, ":") && len(strings.Split(password, ":")) == 4 {
		return nil
	}
	return check(lbvalidate.ValidateWithTag(password, "required,min=6,max=128"))
}

func validateCode(code string) error {
	code = normalizeText(code)
	return check(lbvalidate.ValidateWithTag(code, "required,min=4,max=12"))
}

// PreparePasswordLogin normalizes and validates password login payload.
func PreparePasswordLogin(form *models.LoginForm) error {
	if form == nil {
		return errors.New("invalid request")
	}
	if form.AuthToken != "" {
		return nil
	}
	account := normalizeText(form.Username)
	if account == "" {
		account = normalizeText(form.Email)
	}
	if err := validateAccount(account); err != nil {
		return err
	}
	if strings.Contains(account, "@") {
		form.Username = normalizeEmail(account)
	} else {
		form.Username = account
	}
	form.Email = form.Username

	if form.AuthToken == "" {
		if err := validatePassword(form.Password); err != nil {
			return err
		}
		form.Password = normalizeText(form.Password)
	}
	return nil
}

// PrepareEmailCodeLogin normalizes and validates email-code login payload.
func PrepareEmailCodeLogin(form *models.UserOperatorForm) error {
	if form == nil {
		return errors.New("invalid request")
	}
	account := normalizeText(form.Username)
	if account == "" {
		account = normalizeText(form.Email)
	}
	if err := check(lbvalidate.ValidateWithTag(normalizeEmail(account), "required,email")); err != nil {
		return err
	}
	form.Username = normalizeEmail(account)
	form.Email = form.Username
	if err := validateCode(form.Code); err != nil {
		return err
	}
	form.Code = normalizeText(form.Code)
	return nil
}

var ErrPasswordRegisterDisabled = errors.New("请使用邮箱验证码注册")

// PreparePasswordRegister rejects public password signup. Learners register
// with an email verification code via PrepareEmailRegister.
func PreparePasswordRegister(form *models.RegisterUserForm) error {
	if form == nil {
		return errors.New("invalid request")
	}
	return ErrPasswordRegisterDisabled
}

// PrepareEmailRegister normalizes and validates email-code registration.
func PrepareEmailRegister(form *models.UserOperatorForm) error {
	if form == nil {
		return errors.New("invalid request")
	}
	if err := check(lbvalidate.ValidateWithTag(normalizeEmail(form.Username), "required,email")); err != nil {
		return err
	}
	form.Username = normalizeEmail(form.Username)
	form.Email = form.Username
	if err := validatePassword(form.Password); err != nil {
		return err
	}
	form.Password = normalizeText(form.Password)
	if err := validateCode(form.Code); err != nil {
		return err
	}
	form.Code = normalizeText(form.Code)
	form.DisplayName = normalizeText(form.DisplayName)
	if form.DisplayName == "" {
		form.DisplayName = strings.Split(form.Username, "@")[0]
	} else if err := check(lbvalidate.ValidateWithTag(form.DisplayName, "max=50")); err != nil {
		return err
	}
	return nil
}

// PrepareSendEmailCode validates outbound email verification requests.
func PrepareSendEmailCode(req *models.SendEmailVerifyEmail) error {
	if req == nil {
		return errors.New("invalid request")
	}
	email := normalizeEmail(req.Email)
	if err := check(lbvalidate.ValidateWithTag(email, "required,email")); err != nil {
		return err
	}
	req.Email = email
	return nil
}

// AbortMessage wraps validation errors for handlers.
func AbortMessage(err error) string {
	if err == nil {
		return ""
	}
	if msg := Message(err); msg != "" {
		return msg
	}
	return fmt.Sprintf("%v", err)
}
