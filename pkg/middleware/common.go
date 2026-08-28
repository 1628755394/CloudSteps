package middleware

import (
	"net/http"

	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/ling-base/common"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-contrib/sessions/memstore"
	"github.com/gin-gonic/gin"
)

// CorsMiddleware handles cross-origin resource sharing via ling-base.
func CorsMiddleware() gin.HandlerFunc {
	return CORSWithConfig(CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch, http.MethodOptions, http.MethodHead},
		AllowHeaders:     []string{"Content-Type", "Authorization", "Origin", "X-API-KEY", "X-API-SECRET", "X-Requested-With", "X-Reqid"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type", "X-Reqid"},
		AllowCredentials: true,
		MaxAge:           86400,
	})
}

func WithMemSession(secret string) gin.HandlerFunc {
	store := memstore.NewStore([]byte(secret))
	store.Options(sessions.Options{Path: "/", MaxAge: 0})
	return sessions.Sessions(GetCarrotSessionField(), store)
}

func WithCookieSession(secret string, maxAge int) gin.HandlerFunc {
	store := cookie.NewStore([]byte(secret))
	store.Options(sessions.Options{Path: "/", MaxAge: maxAge})
	return sessions.Sessions(GetCarrotSessionField(), store)
}

func GetCarrotSessionField() string {
	v := common.GetEnv(constants.ENV_SESSION_FIELD)
	if v == "" {
		return "CloudStepsGo"
	}
	return v
}

// SecurityHeadersMiddleware applies ling-base security response headers
// without CSRF / XSS mutation / input-validation (those break JSON API clients).
func SecurityHeadersMiddleware() gin.HandlerFunc {
	cfg := DefaultSecurityConfig()
	// Align with server MaxMultipartMemory (32MB) so cover/audio uploads are not rejected.
	cfg.MaxRequestSize = 32 << 20
	return SecurityMiddleware(cfg)
}

// SecurityMiddlewareChain returns the full ling-base security chain
// (headers + XSS + input validation + CSRF). Prefer SecurityHeadersMiddleware
// for JSON APIs; use this only when cookie-form CSRF is required.
func SecurityMiddlewareChain() []gin.HandlerFunc {
	config := DefaultSecurityConfig()

	return []gin.HandlerFunc{
		SecurityMiddleware(config),
		XSSProtectionMiddleware(),
		InputValidationMiddleware(),
		CSRFMiddleware(config),
	}
}

// ApplySecurityMiddleware applies SecurityMiddlewareChain to a router group.
func ApplySecurityMiddleware(r *gin.RouterGroup) {
	for _, mw := range SecurityMiddlewareChain() {
		r.Use(mw)
	}
}
