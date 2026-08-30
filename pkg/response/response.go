// Package response provides locale-aware response helpers that wrap
// ling-base's response/gin helpers, resolving i18n messages using the
// locale detected by the i18n middleware (stored on c.Request.Context()).
package response

import (
	"net/http"
	"strings"

	"github.com/LingByte/ling-base/common/response"
	respgin "github.com/LingByte/ling-base/common/response/gin"
	i18ngin "github.com/LingByte/ling-base/i18n/gin"
	"github.com/gin-gonic/gin"
)

// codeForI18nKey maps common i18n keys to their default Code.
// Mirrors the unexported function in ling-base/common/response/gin.
func codeForI18nKey(key string) response.Code {
	switch key {
	case response.KeyInvalidParams, response.KeyInvalidBody:
		return response.CodeBadRequest
	case response.KeyUnauthorized, response.KeyAuthInvalidCredentials,
		response.KeyAuthMissingToken, response.KeyAuthInvalidToken:
		return response.CodeUnauthorized
	case response.KeyForbidden, response.KeyPermInsufficient:
		return response.CodeForbidden
	case response.KeyNotFound, response.KeyTenantNotFound,
		response.KeyAuthEmailNotRegistered:
		return response.CodeNotFound
	case response.KeyConflict, response.KeyDuplicate,
		response.KeyTenantEmailExists:
		return response.CodeConflict
	case response.KeyRateLimited:
		return response.CodeRateLimited
	case response.KeyQuotaExceeded:
		return response.CodeQuotaExceeded
	case response.KeyUpstreamTimeout:
		return response.CodeUpstreamTimeout
	case response.KeyServiceUnavailable:
		return response.CodeServiceUnavail
	case response.KeyTenantMismatch:
		return response.CodeTenantMismatch
	case response.KeyTenantRegisterDisabled, response.KeyTenantSuspended,
		response.KeyTenantUserUnavailable:
		return response.CodeForbidden
	default:
		return response.CodeInternal
	}
}

// localizedMsg resolves an i18n key to a localized string using the
// locale from the request context (set by i18n middleware).
func localizedMsg(c *gin.Context, key string, args ...any) string {
	locale := i18ngin.GetLocale(c)
	mgr := i18ngin.GetManager(c)
	if mgr != nil {
		return mgr.T(locale, key, args...)
	}
	if len(args) > 0 {
		// Fallback: return key with args formatted
		return strings.NewReplacer("%s", "%v", "%d", "%v").Replace(key)
	}
	return key
}

// SuccessI18n writes a 200 success envelope with a localized message,
// using the locale from the request context (set by i18n middleware).
func SuccessI18n(c *gin.Context, key string, data any, args ...any) {
	msg := localizedMsg(c, key, args...)
	c.JSON(http.StatusOK, response.Response{
		Code:    response.CodeSuccess,
		Message: msg,
		Data:    data,
	})
}

// FailI18n writes an error envelope with a localized message derived
// from the i18n key, using the locale from the request context.
func FailI18n(c *gin.Context, key string, data any, args ...any) {
	msg := localizedMsg(c, key, args...)
	code := codeForI18nKey(key)
	ae := response.NewI18n(code, key, args...)
	ae.Message = msg
	c.JSON(http.StatusOK, gin.H{
		"code":    ae.NumCode(),
		"msg":     msg,
		"error":   string(ae.Code),
		"data":    data,
		"details": ae.Details,
	})
}

// AbortWithStatusJSON aborts with a localized error envelope.
// The httpStatus is used to derive the business code (matching
// ling-base's behavior), and the message is localized if the error
// has an i18n key.
func AbortWithStatusJSON(c *gin.Context, httpStatus int, err error) {
	ae := response.AsAppError(err)
	// If the error is a generic internal error, derive the business code
	// from the HTTP status (matching ling-base's AbortWithStatusJSON).
	if ae.Code == response.CodeInternal && httpStatus != http.StatusInternalServerError {
		ae.Code = response.CodeForHTTPStatus(httpStatus)
	}
	ae.HTTPStatus = httpStatus
	if ae.MsgKey != "" {
		ae.Message = localizedMsg(c, ae.MsgKey, ae.MsgArgs...)
	}
	c.AbortWithStatusJSON(http.StatusOK, gin.H{
		"code":    ae.NumCode(),
		"msg":     ae.Message,
		"error":   string(ae.Code),
		"data":    nil,
		"details": ae.Details,
	})
}

// ── Non-i18n passthrough helpers (for compatibility) ──

// Success writes a 200 success envelope.
func Success(c *gin.Context, data any) { respgin.Success(c, data) }

// SuccessMsg writes a 200 success envelope with a custom message.
func SuccessMsg(c *gin.Context, msg string, data any) { respgin.SuccessMsg(c, msg, data) }

// Fail writes an error envelope with a direct message.
func Fail(c *gin.Context, msg string, data any) { respgin.Fail(c, msg, data) }

// FailWithCode writes an error envelope with a custom numeric code.
func FailWithCode(c *gin.Context, code response.Code, msg string, data any) {
	respgin.FailWithCode(c, code, msg, data)
}

// NoContent writes a 204 with no body.
func NoContent(c *gin.Context) { respgin.NoContent(c) }
