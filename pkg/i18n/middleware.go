// Package i18n - gin middleware re-exported from ling-base/i18n/gin.
package i18n

import (
	basegin "github.com/LingByte/ling-base/i18n/gin"
	"github.com/gin-gonic/gin"
)

// Middleware creates a Gin middleware for i18n (delegated to ling-base).
func Middleware(manager *Manager) gin.HandlerFunc {
	return basegin.Middleware(manager)
}

// GetLocaleFromGin gets locale from Gin context.
// CloudSteps-specific alias for ling-base's gin.GetLocale.
func GetLocaleFromGin(c *gin.Context) Locale {
	return basegin.GetLocale(c)
}

// T translates a key in Gin context (delegated to ling-base).
func T(c *gin.Context, key string, args ...interface{}) string {
	return basegin.T(c, key, args...)
}

// ResponseJSON sends a localized JSON response (delegated to ling-base).
func ResponseJSON(c *gin.Context, code int, key string, data interface{}) {
	basegin.ResponseJSON(c, code, key, data)
}

// ErrorJSON sends a localized error JSON response (delegated to ling-base).
func ErrorJSON(c *gin.Context, code int, key string, err error) {
	basegin.ErrorJSON(c, code, key, err)
}
