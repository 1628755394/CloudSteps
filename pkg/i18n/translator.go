// Package i18n - MyMemory translator re-exported from ling-base/i18n/mymemory.
package i18n

import "github.com/LingByte/ling-base/i18n/mymemory"

// MyMemoryTranslator is an alias for ling-base's mymemory.Translator.
type MyMemoryTranslator = mymemory.Translator

// MyMemoryResponse is kept for backward compatibility.
// ling-base uses an unexported apiResponse struct internally.
type MyMemoryResponse struct {
	ResponseData struct {
		TranslatedText string  `json:"translatedText"`
		Match          float64 `json:"match"`
	} `json:"responseData"`
	QuotaFinished   bool   `json:"quotaFinished"`
	MTLangSupported bool   `json:"mtLangSupported"`
	ResponseDetails string `json:"responseDetails"`
	ResponseStatus  int    `json:"responseStatus"`
}

// NewMyMemoryTranslator creates a new MyMemory translator (delegated to ling-base).
func NewMyMemoryTranslator(email string) *MyMemoryTranslator {
	return mymemory.New(email)
}

// GetSupportedLanguages returns list of supported language codes (delegated to ling-base).
func GetSupportedLanguages() []string {
	return mymemory.SupportedLanguages()
}
