package utils

import (
	"errors"
	"strings"
	"unicode"
)

// ValidateUserName validates a username.
func ValidateUserName(username string) error {
	if username == "" {
		return errors.New("username is required")
	}

	// Length check (using rune count for proper Unicode support)
	runeCount := len([]rune(username))
	if runeCount < 2 {
		return errors.New("username must be at least 2 characters long")
	}

	if runeCount > 30 {
		return errors.New("username too long")
	}

	// Allow letters (including Unicode letters like Chinese), numbers, underscores and hyphens
	for _, r := range username {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' && r != '-' {
			return errors.New("username can only contain letters, numbers, underscores and hyphens")
		}
	}

	return nil
}

// ValidatePasswordFormat 校验密码格式（支持加密密码和明文密码）。
// 加密密码格式: hash:salt:iv:timestamp（4 段以冒号分隔）
// 明文密码: 长度 6-128
func ValidatePasswordFormat(password string) error {
	if password == "" {
		return errors.New("password is required")
	}

	// 加密密码格式检测
	if strings.Contains(password, ":") {
		parts := strings.Split(password, ":")
		if len(parts) == 4 {
			// 加密密码格式，基本校验各段非空
			for _, p := range parts {
				if strings.TrimSpace(p) == "" {
					return errors.New("invalid encrypted password format")
				}
			}
			return nil
		}
	}

	// 明文密码校验
	if len(password) < 6 {
		return errors.New("password must be at least 6 characters long")
	}
	if len(password) > 128 {
		return errors.New("password too long")
	}
	return nil
}

// SanitizeAndValidate 清理并校验输入值（按字段类型做基本清理）。
// 对于 password 类型，不做任何清理（避免破坏加密密码中的特殊字符）。
func SanitizeAndValidate(input string, fieldType string) (string, error) {
	switch fieldType {
	case "password":
		// 密码不做清理，直接校验格式
		if err := ValidatePasswordFormat(input); err != nil {
			return input, err
		}
		return input, nil
	default:
		// 其他类型：trim + 去控制字符
		sanitized := strings.TrimSpace(input)
		sanitized = strings.Map(func(r rune) rune {
			if unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t' {
				return -1
			}
			return r
		}, sanitized)
		return sanitized, nil
	}
}
