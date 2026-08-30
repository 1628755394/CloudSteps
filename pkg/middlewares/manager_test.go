package middlewares

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewMiddlewareManager_AllEnabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := configs.MiddlewareConfig{
		EnableRateLimit:      true,
		EnableTimeout:        true,
		EnableCircuitBreaker: true,
		EnableOperationLog:   true,
		RateLimit: configs.RateLimiterDetailConfig{
			GlobalRPS:    100,
			GlobalBurst:  200,
			GlobalWindow: time.Minute,
			UserRPS:      50,
			UserBurst:    100,
			UserWindow:   time.Minute,
			IPRPS:        20,
			IPBurst:      40,
			IPWindow:     time.Minute,
		},
		Timeout: configs.TimeoutDetailConfig{
			DefaultTimeout: 30 * time.Second,
		},
		CircuitBreaker: configs.CircuitBreakerDetailConfig{
			FailureThreshold:      5,
			SuccessThreshold:      3,
			Timeout:               30 * time.Second,
			OpenTimeout:           60 * time.Second,
			MaxConcurrentRequests: 100,
		},
	}
	mgr := NewMiddlewareManager(cfg)
	assert.NotNil(t, mgr)
	assert.NotNil(t, mgr.rateLimiter)
	// Reset global state to avoid leaking into other tests
	t.Cleanup(func() {
		globalRateLimiter = nil
		globalMiddlewareManager = nil
	})
}

func TestNewMiddlewareManager_AllDisabled(t *testing.T) {
	cfg := configs.MiddlewareConfig{
		EnableRateLimit:      false,
		EnableTimeout:        false,
		EnableCircuitBreaker: false,
		EnableOperationLog:   false,
	}
	mgr := NewMiddlewareManager(cfg)
	assert.NotNil(t, mgr)
	assert.Nil(t, mgr.rateLimiter)
}

func TestNewMiddlewareManager_DefaultsWhenZero(t *testing.T) {
	cfg := configs.MiddlewareConfig{
		EnableTimeout:        true,
		EnableCircuitBreaker: true,
		Timeout:              configs.TimeoutDetailConfig{},
		CircuitBreaker:       configs.CircuitBreakerDetailConfig{},
	}
	mgr := NewMiddlewareManager(cfg)
	assert.NotNil(t, mgr)
}

func TestGetDefaultEndpointLimits(t *testing.T) {
	limits := getDefaultEndpointLimits()
	assert.NotEmpty(t, limits)
	assert.Contains(t, limits, "/api/auth/login/password")
	assert.Contains(t, limits, "/api/auth/register")
	assert.Contains(t, limits, "/api/upload")
	for path, lim := range limits {
		assert.Greater(t, lim.RPS, 0, "path %s should have RPS > 0", path)
		assert.Greater(t, lim.Burst, 0, "path %s should have Burst > 0", path)
		assert.Greater(t, lim.Window, time.Duration(0), "path %s should have Window > 0", path)
	}
}

func TestGetDefaultEndpointTimeouts(t *testing.T) {
	timeouts := getDefaultEndpointTimeouts()
	assert.NotEmpty(t, timeouts)
	assert.Contains(t, timeouts, "/api/auth/login/password")
	assert.Contains(t, timeouts, "/api/upload")
	assert.Contains(t, timeouts, "/api/wordbooks/batch-audio/jobs")
	for path, d := range timeouts {
		assert.Greater(t, d, time.Duration(0), "path %s should have timeout > 0", path)
	}
}

func TestMiddlewareManager_ApplyMiddlewares(t *testing.T) {
	t.Cleanup(func() { globalRateLimiter = nil; globalMiddlewareManager = nil })
	gin.SetMode(gin.TestMode)
	r := gin.New()
	cfg := configs.MiddlewareConfig{
		EnableRateLimit:      true,
		EnableTimeout:        true,
		EnableCircuitBreaker: true,
		EnableOperationLog:   true,
		RateLimit: configs.RateLimiterDetailConfig{
			GlobalRPS:    100,
			GlobalBurst:  200,
			GlobalWindow: time.Minute,
			UserRPS:      50,
			UserBurst:    100,
			UserWindow:   time.Minute,
			IPRPS:        20,
			IPBurst:      40,
			IPWindow:     time.Minute,
		},
		Timeout: configs.TimeoutDetailConfig{
			DefaultTimeout: 30 * time.Second,
		},
		CircuitBreaker: configs.CircuitBreakerDetailConfig{
			FailureThreshold:      5,
			SuccessThreshold:      3,
			Timeout:               30 * time.Second,
			OpenTimeout:           60 * time.Second,
			MaxConcurrentRequests: 100,
		},
	}
	mgr := NewMiddlewareManager(cfg)
	group := r.Group("/api")
	mgr.ApplyMiddlewares(group)
}

func TestMiddlewareManager_ApplyMiddlewares_Disabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	cfg := configs.MiddlewareConfig{
		EnableRateLimit:      false,
		EnableTimeout:        false,
		EnableCircuitBreaker: false,
		EnableOperationLog:   false,
	}
	mgr := NewMiddlewareManager(cfg)
	group := r.Group("/api")
	mgr.ApplyMiddlewares(group)
}

func TestMiddlewareManager_GetStats(t *testing.T) {
	t.Run("with rate limiter", func(t *testing.T) {
		cfg := configs.MiddlewareConfig{
			EnableRateLimit: true,
			RateLimit: configs.RateLimiterDetailConfig{
				GlobalRPS:    100,
				GlobalBurst:  200,
				GlobalWindow: time.Minute,
				UserRPS:      50,
				UserBurst:    100,
				UserWindow:   time.Minute,
				IPRPS:        20,
				IPBurst:      40,
				IPWindow:     time.Minute,
			},
		}
		mgr := NewMiddlewareManager(cfg)
		stats := mgr.GetStats()
		assert.NotEmpty(t, stats)
		assert.Contains(t, stats, "rate_limiter")
	})

	t.Run("without rate limiter", func(t *testing.T) {
		cfg := configs.MiddlewareConfig{
			EnableRateLimit: false,
		}
		mgr := NewMiddlewareManager(cfg)
		stats := mgr.GetStats()
		assert.Empty(t, stats["rate_limiter"])
	})

	t.Run("with timeout", func(t *testing.T) {
		cfg := configs.MiddlewareConfig{
			EnableTimeout: true,
			Timeout: configs.TimeoutDetailConfig{
				DefaultTimeout: 30 * time.Second,
			},
		}
		mgr := NewMiddlewareManager(cfg)
		stats := mgr.GetStats()
		assert.Contains(t, stats, "circuit_breakers")
	})
}

func TestMiddlewareManager_UpdateRateLimitConfig(t *testing.T) {
	t.Cleanup(func() { globalRateLimiter = nil; globalMiddlewareManager = nil })
	cfg := configs.MiddlewareConfig{
		EnableRateLimit: true,
		RateLimit: configs.RateLimiterDetailConfig{
			GlobalRPS:    100,
			GlobalBurst:  200,
			GlobalWindow: time.Minute,
			UserRPS:      50,
			UserBurst:    100,
			UserWindow:   time.Minute,
			IPRPS:        20,
			IPBurst:      40,
			IPWindow:     time.Minute,
		},
	}
	mgr := NewMiddlewareManager(cfg)
	require.NotNil(t, mgr.rateLimiter)

	newCfg := configs.RateLimiterDetailConfig{
		GlobalRPS:    200,
		GlobalBurst:  400,
		GlobalWindow: time.Minute,
		UserRPS:      100,
		UserBurst:    200,
		UserWindow:   time.Minute,
		IPRPS:        40,
		IPBurst:      80,
		IPWindow:     time.Minute,
	}
	mgr.UpdateRateLimitConfig(newCfg)
	assert.NotNil(t, mgr.rateLimiter)
	assert.Equal(t, 200, mgr.config.RateLimit.GlobalRPS)
}

func TestMiddlewareManager_UpdateRateLimitConfig_NilLimiter(t *testing.T) {
	cfg := configs.MiddlewareConfig{
		EnableRateLimit: false,
	}
	mgr := NewMiddlewareManager(cfg)
	mgr.UpdateRateLimitConfig(configs.RateLimiterDetailConfig{})
	assert.Nil(t, mgr.rateLimiter)
}

func TestMiddlewareManager_UpdateTimeoutConfig(t *testing.T) {
	cfg := configs.MiddlewareConfig{
		EnableTimeout: true,
		Timeout: configs.TimeoutDetailConfig{
			DefaultTimeout: 30 * time.Second,
		},
	}
	mgr := NewMiddlewareManager(cfg)
	mgr.UpdateTimeoutConfig(configs.TimeoutDetailConfig{
		DefaultTimeout: 60 * time.Second,
	})
	assert.Equal(t, 60*time.Second, mgr.config.Timeout.DefaultTimeout)
}

func TestMiddlewareManager_UpdateCircuitBreakerConfig(t *testing.T) {
	cfg := configs.MiddlewareConfig{
		EnableCircuitBreaker: true,
		CircuitBreaker: configs.CircuitBreakerDetailConfig{
			FailureThreshold: 5,
		},
	}
	mgr := NewMiddlewareManager(cfg)
	mgr.UpdateCircuitBreakerConfig(configs.CircuitBreakerDetailConfig{
		FailureThreshold: 10,
	})
	assert.Equal(t, 10, mgr.config.CircuitBreaker.FailureThreshold)
}

func TestInitGlobalMiddlewareManager(t *testing.T) {
	globalMiddlewareManager = nil
	cfg := configs.MiddlewareConfig{
		EnableRateLimit: true,
		RateLimit: configs.RateLimiterDetailConfig{
			GlobalRPS:    100,
			GlobalBurst:  200,
			GlobalWindow: time.Minute,
			UserRPS:      50,
			UserBurst:    100,
			UserWindow:   time.Minute,
			IPRPS:        20,
			IPBurst:      40,
			IPWindow:     time.Minute,
		},
	}
	InitGlobalMiddlewareManager(cfg)
	mgr := GetGlobalMiddlewareManager()
	assert.NotNil(t, mgr)
	t.Cleanup(func() { globalMiddlewareManager = nil })
}

func TestGetGlobalMiddlewareManager_WithGlobalConfig(t *testing.T) {
	globalMiddlewareManager = nil
	withGlobalConfig(t, &configs.Config{
		Middleware: configs.MiddlewareConfig{
			EnableRateLimit: true,
			RateLimit: configs.RateLimiterDetailConfig{
				GlobalRPS:    100,
				GlobalBurst:  200,
				GlobalWindow: time.Minute,
				UserRPS:      50,
				UserBurst:    100,
				UserWindow:   time.Minute,
				IPRPS:        20,
				IPBurst:      40,
				IPWindow:     time.Minute,
			},
		},
	})
	mgr := GetGlobalMiddlewareManager()
	assert.NotNil(t, mgr)
	t.Cleanup(func() { globalMiddlewareManager = nil })
}

func TestGetGlobalMiddlewareManager_DefaultConfig(t *testing.T) {
	globalMiddlewareManager = nil
	old := configs.Global
	configs.Global = nil
	t.Cleanup(func() { configs.Global = old; globalMiddlewareManager = nil })

	mgr := GetGlobalMiddlewareManager()
	assert.NotNil(t, mgr)
}

func TestApplyGlobalMiddlewares(t *testing.T) {
	gin.SetMode(gin.TestMode)
	globalMiddlewareManager = nil
	withGlobalConfig(t, &configs.Config{
		Middleware: configs.MiddlewareConfig{
			EnableRateLimit: true,
			RateLimit: configs.RateLimiterDetailConfig{
				GlobalRPS:    100,
				GlobalBurst:  200,
				GlobalWindow: time.Minute,
				UserRPS:      50,
				UserBurst:    100,
				UserWindow:   time.Minute,
				IPRPS:        20,
				IPBurst:      40,
				IPWindow:     time.Minute,
			},
		},
	})
	r := gin.New()
	group := r.Group("/api")
	ApplyGlobalMiddlewares(group)
	t.Cleanup(func() { globalMiddlewareManager = nil })
}

func TestGetGlobalMiddlewareStats(t *testing.T) {
	globalMiddlewareManager = nil
	withGlobalConfig(t, &configs.Config{
		Middleware: configs.MiddlewareConfig{
			EnableRateLimit: true,
			RateLimit: configs.RateLimiterDetailConfig{
				GlobalRPS:    100,
				GlobalBurst:  200,
				GlobalWindow: time.Minute,
				UserRPS:      50,
				UserBurst:    100,
				UserWindow:   time.Minute,
				IPRPS:        20,
				IPBurst:      40,
				IPWindow:     time.Minute,
			},
		},
	})
	stats := GetGlobalMiddlewareStats()
	assert.NotNil(t, stats)
	t.Cleanup(func() { globalMiddlewareManager = nil })
}
