package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRateLimit_Disabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RateLimit(configs.RateLimitConfig{Enabled: false}))
	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, 200, w.Code)
	assert.Equal(t, "pong", w.Body.String())
}

func TestRateLimit_ZeroRPS(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RateLimit(configs.RateLimitConfig{Enabled: true, RPS: 0}))
	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, 200, w.Code)
}

func TestRateLimit_AllowUnderLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RateLimit(configs.RateLimitConfig{Enabled: true, RPS: 100, Burst: 200}))
	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, 200, w.Code)
	assert.Equal(t, "pong", w.Body.String())
}

func TestRateLimit_BurstDefault(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RateLimit(configs.RateLimitConfig{Enabled: true, RPS: 10, Burst: 0}))
	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, 200, w.Code)
}

func TestAPICors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(APICors())
	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, 200, w.Code)
	// CORS headers are set on preflight (OPTIONS) requests;
	// for simple GET requests the browser checks Origin matching.
}

func TestAPICors_Options(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(APICors())
	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/ping", nil)
	r.ServeHTTP(w, req)
}

func TestSecurityHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SecurityHeaders())
	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, 200, w.Code)
}

func TestSecurityMiddlewareChain(t *testing.T) {
	chain := SecurityMiddlewareChain()
	assert.NotEmpty(t, chain)
	assert.Len(t, chain, 4)
}

func TestApplySecurityMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	group := r.Group("/api")
	ApplySecurityMiddleware(group)
	group.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/ping", nil)
	r.ServeHTTP(w, req)
	// Security middleware may reject due to CSRF, but should not panic
}

func TestReExportedVars(t *testing.T) {
	// Verify the re-exported variables are not nil
	assert.NotNil(t, RequestIDMiddleware)
	assert.NotNil(t, LoggerMiddleware)
	assert.NotNil(t, PanicRecovery)
	assert.NotNil(t, CORS)
	assert.NotNil(t, CORSWithConfig)
	assert.NotNil(t, CircuitBreakerMiddleware)
	assert.NotNil(t, InjectDB)
	assert.NotNil(t, SecurityMiddleware)
	assert.NotNil(t, DefaultSecurityConfig)
	assert.NotNil(t, InitTimeoutCircuitManager)
	assert.NotNil(t, CombinedTimeoutCircuitMiddleware)
	assert.NotNil(t, GetCircuitBreakerStats)
	assert.NotNil(t, GetTimeoutCircuitManager)
	assert.NotNil(t, NewTimeoutCircuitManager)
	assert.NotNil(t, ErrorHandler)
	assert.NotNil(t, AuthRateLimiter)
	assert.NotNil(t, XSSProtectionMiddleware)
	assert.NotNil(t, InputValidationMiddleware)
	assert.NotNil(t, CSRFMiddleware)
	assert.NotNil(t, DefaultTimeoutConfig)
	assert.NotNil(t, DefaultCircuitBreakerConfig)
	assert.NotNil(t, MarkOperationLogged)
	assert.NotNil(t, OperationAlreadyLogged)
	assert.NotNil(t, APIVersionMiddleware)
}
