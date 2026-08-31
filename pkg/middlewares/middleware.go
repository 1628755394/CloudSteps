// Package middlewares 项目侧中间件（仅保留对 ling-base 的薄封装，对齐 demo）。
package middlewares

import (
	"net/http"
	"sync"

	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/ling-base/common/limiter/tokenbucket"
	lbmw "github.com/LingByte/ling-base/middleware"
	"github.com/gin-gonic/gin"
)

// RateLimit 全局令牌桶限流（ling-base/common/limiter/tokenbucket），与 demo 一致。
func RateLimit(cfg configs.RateLimitConfig) gin.HandlerFunc {
	if !cfg.Enabled || cfg.RPS <= 0 {
		return func(c *gin.Context) { c.Next() }
	}
	burst := cfg.Burst
	if burst <= 0 {
		burst = cfg.RPS * 2
	}
	limiter := tokenbucket.New(cfg.RPS, burst)
	var mu sync.Mutex
	return func(c *gin.Context) {
		mu.Lock()
		err := limiter.Acquire(c.Request.Context(), nil)
		mu.Unlock()
		if err != nil {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"code":  429,
				"msg":   "请求过于频繁，请稍后再试",
				"error": "rate_limited",
			})
			return
		}
		defer func() {
			mu.Lock()
			limiter.Release(nil)
			mu.Unlock()
		}()
		c.Next()
	}
}

// 以下为 ling-base/middleware 再导出，业务与 app 层统一从 pkg/middlewares 引用。
var (
	RequestIDMiddleware              = lbmw.RequestIDMiddleware
	LoggerMiddleware                 = lbmw.LoggerMiddleware
	PanicRecovery                    = lbmw.PanicRecovery
	CORS                             = lbmw.CORS
	CORSWithConfig                   = lbmw.CORSWithConfig
	InjectDB                         = lbmw.InjectDB
	SecurityMiddleware               = lbmw.SecurityMiddleware
	DefaultSecurityConfig            = lbmw.DefaultSecurityConfig
	InitTimeoutCircuitManager        = lbmw.InitTimeoutCircuitManager
	GetCircuitBreakerStats           = lbmw.GetCircuitBreakerStats
	GetTimeoutCircuitManager         = lbmw.GetTimeoutCircuitManager
	NewTimeoutCircuitManager         = lbmw.NewTimeoutCircuitManager
	ErrorHandler                     = lbmw.ErrorHandler
	AuthRateLimiter                  = lbmw.AuthRateLimiter
	XSSProtectionMiddleware          = lbmw.XSSProtectionMiddleware
	InputValidationMiddleware        = lbmw.InputValidationMiddleware
	CSRFMiddleware                   = lbmw.CSRFMiddleware
	DefaultTimeoutConfig             = lbmw.DefaultTimeoutConfig
	DefaultCircuitBreakerConfig      = lbmw.DefaultCircuitBreakerConfig
	MarkOperationLogged              = lbmw.MarkOperationLogged
	OperationAlreadyLogged           = lbmw.OperationAlreadyLogged
	APIVersionMiddleware             = lbmw.APIVersionMiddleware
)

type (
	TimeoutConfig        = lbmw.TimeoutConfig
	CircuitBreakerConfig = lbmw.CircuitBreakerConfig
	CORSConfig           = lbmw.CORSConfig
	SecurityConfig       = lbmw.SecurityConfig
)

// APICors CloudSteps API 默认 CORS（凭据 + 常用头）。
func APICors() gin.HandlerFunc {
	return CORSWithConfig(CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch, http.MethodOptions, http.MethodHead},
		AllowHeaders:     []string{"Content-Type", "Authorization", "Origin", "X-API-KEY", "X-API-SECRET", "X-Requested-With", "X-Reqid"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type", "X-Reqid"},
		AllowCredentials: true,
		MaxAge:           86400,
	})
}

// SecurityHeaders 仅响应头与体积限制，不含 CSRF（JSON API）。
func SecurityHeaders() gin.HandlerFunc {
	cfg := DefaultSecurityConfig()
	cfg.MaxRequestSize = 32 << 20
	return SecurityMiddleware(cfg)
}

// SecurityMiddlewareChain 完整安全链（含 CSRF）；JSON API 优先用 SecurityHeaders。
func SecurityMiddlewareChain() []gin.HandlerFunc {
	config := DefaultSecurityConfig()
	return []gin.HandlerFunc{
		SecurityMiddleware(config),
		XSSProtectionMiddleware(),
		InputValidationMiddleware(),
		CSRFMiddleware(config),
	}
}

// ApplySecurityMiddleware 将 SecurityMiddlewareChain 挂到路由组。
func ApplySecurityMiddleware(r *gin.RouterGroup) {
	for _, mw := range SecurityMiddlewareChain() {
		r.Use(mw)
	}
}
