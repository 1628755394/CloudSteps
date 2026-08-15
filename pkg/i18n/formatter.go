// Package i18n - formatter re-exported from ling-base/i18n.
package i18n

import (
	"time"

	basei18n "github.com/LingByte/ling-base/i18n"
)

// Type aliases for formatter types.
type (
	Formatter      = basei18n.Formatter
	NumberFormat   = basei18n.NumberFormat
	CurrencyFormat = basei18n.CurrencyFormat
	TimeUnits      = basei18n.TimeUnits
)

// NewFormatter creates a new formatter for a locale (delegated to ling-base).
func NewFormatter(locale Locale) *Formatter {
	return basei18n.NewFormatter(locale)
}

// FormatNumber formats a number according to locale (delegated to ling-base).
func FormatNumber(f *Formatter, number float64, decimals int) string {
	return f.FormatNumber(number, decimals)
}

// FormatCurrency formats currency according to locale (delegated to ling-base).
func FormatCurrency(f *Formatter, amount float64, currency string) string {
	return f.FormatCurrency(amount, currency)
}

// FormatDate formats date according to locale (delegated to ling-base).
func FormatDate(f *Formatter, date time.Time, format string) string {
	return f.FormatDate(date, format)
}

// FormatRelativeTime formats relative time (delegated to ling-base).
func FormatRelativeTime(f *Formatter, t time.Time) string {
	return f.FormatRelativeTime(t)
}
