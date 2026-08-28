package middleware

import (
	lbmw "github.com/LingByte/ling-base/middleware"
)

// Re-export ling-base middleware used by CloudSteps wiring and tests.
var (
	InjectDB                         = lbmw.InjectDB
	CORS                             = lbmw.CORS
	CORSWithConfig                   = lbmw.CORSWithConfig
	DefaultCORSConfig                = lbmw.DefaultCORSConfig
	CombinedTimeoutCircuitMiddleware = lbmw.CombinedTimeoutCircuitMiddleware
	GetCircuitBreakerStats           = lbmw.GetCircuitBreakerStats
	GetTimeoutCircuitManager         = lbmw.GetTimeoutCircuitManager
	InitTimeoutCircuitManager        = lbmw.InitTimeoutCircuitManager
	NewTimeoutCircuitManager         = lbmw.NewTimeoutCircuitManager
	LoggerMiddleware                 = lbmw.LoggerMiddleware
	RequestIDMiddleware              = lbmw.RequestIDMiddleware
	PanicRecovery                    = lbmw.PanicRecovery
	ErrorHandler                     = lbmw.ErrorHandler
	AuthRateLimiter                  = lbmw.AuthRateLimiter
	SecurityMiddleware               = lbmw.SecurityMiddleware
	XSSProtectionMiddleware          = lbmw.XSSProtectionMiddleware
	InputValidationMiddleware        = lbmw.InputValidationMiddleware
	CSRFMiddleware                   = lbmw.CSRFMiddleware
	DefaultSecurityConfig            = lbmw.DefaultSecurityConfig
	DefaultTimeoutConfig             = lbmw.DefaultTimeoutConfig
	DefaultCircuitBreakerConfig      = lbmw.DefaultCircuitBreakerConfig
	MarkOperationLogged              = lbmw.MarkOperationLogged
	OperationAlreadyLogged           = lbmw.OperationAlreadyLogged
	APIVersionMiddleware             = lbmw.APIVersionMiddleware
)

type (
	TimeoutConfig         = lbmw.TimeoutConfig
	CircuitBreakerConfig  = lbmw.CircuitBreakerConfig
	TimeoutCircuitManager = lbmw.TimeoutCircuitManager
	SecurityConfig        = lbmw.SecurityConfig
	CORSConfig            = lbmw.CORSConfig
)
