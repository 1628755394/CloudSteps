package middlewares

import (
	"github.com/LingByte/CloudStepsGo/internal/constants"
	"github.com/LingByte/ling-base/common"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-contrib/sessions/memstore"
	"github.com/gin-gonic/gin"
)

func WithMemSession(secret string) gin.HandlerFunc {
	store := memstore.NewStore([]byte(secret))
	store.Options(sessions.Options{Path: "/", MaxAge: 0})
	return sessions.Sessions(SessionField(), store)
}

func WithCookieSession(secret string, maxAge int) gin.HandlerFunc {
	store := cookie.NewStore([]byte(secret))
	store.Options(sessions.Options{Path: "/", MaxAge: maxAge})
	return sessions.Sessions(SessionField(), store)
}

func SessionField() string {
	v := common.GetEnv(constants.ENV_SESSION_FIELD)
	if v == "" {
		return "CloudStepsGo"
	}
	return v
}

// CorsMiddleware 兼容旧名，等同 APICors。
func CorsMiddleware() gin.HandlerFunc { return APICors() }

// SecurityHeadersMiddleware 兼容旧名。
func SecurityHeadersMiddleware() gin.HandlerFunc { return SecurityHeaders() }
