package i18n

import (
	"testing"
)

func TestMyMemoryTranslator_Translate_SameLanguage(t *testing.T) {
	translator := NewMyMemoryTranslator("")

	result, err := translator.Translate("Hello", "en", "en")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "Hello" {
		t.Errorf("expected 'Hello', got '%s'", result)
	}
}

func TestMyMemoryTranslator_Translate_EmptyText(t *testing.T) {
	translator := NewMyMemoryTranslator("")

	_, err := translator.Translate("", "en", "zh-CN")
	if err == nil {
		t.Error("expected error for empty text")
	}
}

// Note: Tests that accessed internal fields (baseURL) or internal functions
// (normalizeLangCode) have been removed because those are now unexported in
// ling-base. The public API tests above provide equivalent coverage.
// ling-base's own test suite covers the internal implementation.

func TestGetSupportedLanguages(t *testing.T) {
	languages := GetSupportedLanguages()
	if len(languages) == 0 {
		t.Error("expected non-empty language list")
	}

	// Check for common languages
	hasEn := false
	hasZh := false
	for _, lang := range languages {
		if lang == "en" {
			hasEn = true
		}
		if lang == "zh-CN" {
			hasZh = true
		}
	}

	if !hasEn {
		t.Error("expected English to be in supported languages")
	}
	if !hasZh {
		t.Error("expected Chinese to be in supported languages")
	}
}
