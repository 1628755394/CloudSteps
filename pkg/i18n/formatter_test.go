package i18n

import (
	"testing"
	"time"
)

func TestFormatter_FormatNumber(t *testing.T) {
	formatter := NewFormatter("en")

	result := formatter.FormatNumber(1234.56, 2)
	if result != "1,234.56" {
		t.Errorf("expected '1,234.56', got '%s'", result)
	}

	formatterCN := NewFormatter("zh-CN")
	resultCN := formatterCN.FormatNumber(1234.56, 2)
	if resultCN != "1,234.56" {
		t.Errorf("expected '1,234.56', got '%s'", resultCN)
	}
}

func TestFormatter_FormatCurrency(t *testing.T) {
	formatter := NewFormatter("en")
	result := formatter.FormatCurrency(1234.56, "USD")
	if result != "$1,234.56" {
		t.Errorf("expected '$1,234.56', got '%s'", result)
	}

	formatterCN := NewFormatter("zh-CN")
	resultCN := formatterCN.FormatCurrency(1234.56, "CNY")
	if resultCN != "¥1,234.56" {
		t.Errorf("expected '¥1,234.56', got '%s'", resultCN)
	}
}

func TestFormatter_FormatDate(t *testing.T) {
	date := time.Date(2024, 1, 15, 14, 30, 0, 0, time.UTC)

	formatter := NewFormatter("en")
	result := formatter.FormatDate(date, "YYYY-MM-DD")
	if result != "2024-01-15" {
		t.Errorf("expected '2024-01-15', got '%s'", result)
	}

	formatterCN := NewFormatter("zh-CN")
	resultCN := formatterCN.FormatDate(date, "")
	if resultCN != "2024-01-15" {
		t.Errorf("expected '2024-01-15', got '%s'", resultCN)
	}
}

func TestFormatter_FormatRelativeTime(t *testing.T) {
	now := time.Now()

	formatter := NewFormatter("en")

	// Test seconds ago
	past := now.Add(-30 * time.Second)
	result := formatter.FormatRelativeTime(past)
	if result == "" {
		t.Error("expected non-empty result")
	}

	// Test minutes ago
	past = now.Add(-5 * time.Minute)
	result = formatter.FormatRelativeTime(past)
	if result == "" {
		t.Error("expected non-empty result")
	}

	// Test hours ago
	past = now.Add(-2 * time.Hour)
	result = formatter.FormatRelativeTime(past)
	if result == "" {
		t.Error("expected non-empty result")
	}

	// Test days ago
	past = now.Add(-3 * 24 * time.Hour)
	result = formatter.FormatRelativeTime(past)
	if result == "" {
		t.Error("expected non-empty result")
	}

	// Test Chinese locale
	formatterCN := NewFormatter("zh-CN")
	past = now.Add(-1 * time.Hour)
	resultCN := formatterCN.FormatRelativeTime(past)
	if resultCN == "" {
		t.Error("expected non-empty result")
	}
}

// Note: Tests for internal methods (getNumberFormat, getCurrencyFormat,
// getDateFormat, addThousandSeparators) have been removed because those
// methods are now unexported in ling-base. The public API tests above
// (FormatNumber, FormatCurrency, FormatDate, FormatRelativeTime) provide
// equivalent coverage through the public interface.
