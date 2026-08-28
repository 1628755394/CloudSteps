package middleware

import (
	lbmw "github.com/LingByte/ling-base/middleware"
)

// Re-export ling-base middleware building blocks used by CloudSteps wiring.
var (
	CombinedTimeoutCircuitMiddleware = lbmw.CombinedTimeoutCircuitMiddleware
	GetCircuitBreakerStats           = lbmw.GetCircuitBreakerStats
	GetTimeoutCircuitManager         = lbmw.GetTimeoutCircuitManager
	InitTimeoutCircuitManager        = lbmw.InitTimeoutCircuitManager
	NewTimeoutCircuitManager         = lbmw.NewTimeoutCircuitManager
	LoggerMiddleware                 = lbmw.LoggerMiddleware
	SecurityMiddleware               = lbmw.SecurityMiddleware
	XSSProtectionMiddleware          = lbmw.XSSProtectionMiddleware
	InputValidationMiddleware        = lbmw.InputValidationMiddleware
	CSRFMiddleware                   = lbmw.CSRFMiddleware
	DefaultSecurityConfig            = lbmw.DefaultSecurityConfig
	DefaultTimeoutConfig             = lbmw.DefaultTimeoutConfig
	DefaultCircuitBreakerConfig      = lbmw.DefaultCircuitBreakerConfig
)

type (
	TimeoutConfig          = lbmw.TimeoutConfig
	CircuitBreakerConfig   = lbmw.CircuitBreakerConfig
	TimeoutCircuitManager  = lbmw.TimeoutCircuitManager
	SecurityConfig         = lbmw.SecurityConfig
)
