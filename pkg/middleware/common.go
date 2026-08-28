package middleware

import (
	"net/http"

	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/ling-base/common"
	lbmw "github.com/LingByte/ling-base/middleware"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-contrib/sessions/memstore"
	"github.com/gin-gonic/gin"
)

// CorsMiddleware handles cross-origin resource sharing via ling-base.
func CorsMiddleware() gin.HandlerFunc {
	return lbmw.CORSWithConfig(lbmw.CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch, http.MethodOptions, http.MethodHead},
		AllowHeaders:     []string{"Content-Type", "Authorization", "Origin", "X-API-KEY", "X-API-SECRET", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
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

// SecurityMiddlewareChain returns security middleware chain
func SecurityMiddlewareChain() []gin.HandlerFunc {
	config := DefaultSecurityConfig()

	return []gin.HandlerFunc{
		// 1. Basic security headers
		SecurityMiddleware(config),

		// 2. XSS protection
		XSSProtectionMiddleware(),

		// 3. Input validation
		InputValidationMiddleware(),

		// 4. CSRF protection (only for state-changing operations)
		CSRFMiddleware(config),
	}
}

// ApplySecurityMiddleware applies security middleware to router group
func ApplySecurityMiddleware(r *gin.RouterGroup) {
	middlewares := SecurityMiddlewareChain()
	for _, middleware := range middlewares {
		r.Use(middleware)
	}
}
