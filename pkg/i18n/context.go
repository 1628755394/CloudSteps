// Package i18n - context helpers re-exported from ling-base/i18n.
package i18n

import (
	"context"

	basei18n "github.com/LingByte/ling-base/i18n"
)

// WithLocale adds locale to context (delegated to ling-base).
func WithLocale(ctx context.Context, locale Locale) context.Context {
	return basei18n.WithLocale(ctx, locale)
}

// GetLocaleFromContext gets locale from context (delegated to ling-base).
func GetLocaleFromContext(ctx context.Context) Locale {
	return basei18n.GetLocaleFromContext(ctx)
}

// SetLocale sets locale in context (delegated to ling-base).
func SetLocale(ctx context.Context, locale Locale) context.Context {
	return basei18n.SetLocale(ctx, locale)
}
