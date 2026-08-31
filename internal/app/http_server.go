package app

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/constants"
	"github.com/LingByte/CloudStepsGo/internal/handlers"
	"github.com/LingByte/CloudStepsGo/internal/listeners"
	"github.com/LingByte/CloudStepsGo/internal/task"
	localmw "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"github.com/LingByte/CloudStepsGo/pkg/sysmetrics"
	"github.com/LingByte/CloudStepsGo/pkg/utils"
	"github.com/LingByte/ling-base/apidocs"
	"github.com/LingByte/ling-base/apidocs/humax"
	"github.com/LingByte/ling-base/cache/lru"
	"github.com/LingByte/ling-base/captcha"
	"github.com/LingByte/ling-base/common"
	lbconfig "github.com/LingByte/ling-base/common/config"
	"github.com/LingByte/ling-base/common/jwtutil"
	jwtingin "github.com/LingByte/ling-base/common/jwtutil/gin"
	"github.com/LingByte/ling-base/common/logger"
	"github.com/LingByte/ling-base/i18n"
	i18ngin "github.com/LingByte/ling-base/i18n/gin"
	"github.com/LingByte/ling-base/middleware"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// HTTPServer 是 bootstrap.Register 的 HTTP 组件。
type HTTPServer struct {
	Cfg  *configs.Config
	DB   *gorm.DB
	Info handlers.AppInfo
	I18n *i18n.Manager

	db      *gorm.DB
	server  *http.Server
	metrics *sysmetrics.Service
}

func (s *HTTPServer) Start(ctx context.Context) error {
	db := s.DB
	if db == nil {
		return fmt.Errorf("database not connected")
	}
	s.db = db

	configStore, err := lbconfig.NewStoreWithDB(db)
	if err != nil {
		return fmt.Errorf("config store: %w", err)
	}

	globalCache, err := lru.New[string, any](1024, lru.WithDefaultTTL(5*time.Minute))
	if err != nil {
		return fmt.Errorf("cache: %w", err)
	}
	utils.InitGlobalRegistrationGuard(logger.Lg, globalCache)
	captcha.InitGlobalManager(captcha.DefaultConfig())

	s.metrics = sysmetrics.New(db)

	recoveryTimeout, _ := time.ParseDuration(s.Cfg.CircuitBreaker.RecoveryTimeout)
	if recoveryTimeout <= 0 {
		recoveryTimeout = 30 * time.Second
	}
	// enableCircuitBreaker=false：熔断由 engine 层 CircuitBreakerMiddleware 负责，
	// Combined（API 组）只做超时，避免双重熔断。
	middleware.InitTimeoutCircuitManager(
		middleware.TimeoutConfig{
			DefaultTimeout: 30 * time.Second,
			FallbackResponse: map[string]interface{}{
				"error": "service_unavailable", "message": "服务暂时不可用", "code": 503,
			},
		},
		middleware.CircuitBreakerConfig{
			FailureThreshold:      s.Cfg.CircuitBreaker.FailureThreshold,
			SuccessThreshold:      3,
			OpenTimeout:           recoveryTimeout,
			MaxConcurrentRequests: s.Cfg.CircuitBreaker.MinRequests,
		},
		true,
		false,
	)

	if configs.Global == nil {
		configs.Global = s.Cfg
	}
	mwCfg := configs.Global.Middleware
	mwCfg.EnableCircuitBreaker = false // 已在 engine 挂载
	localmw.InitGlobalMiddlewareManager(mwCfg)

	task.StartEmailCleaner(db)
	task.StartCoachingAutoEnd(db)
	if err := handlers.StartWordBookBatchAudioQueue(db); err != nil {
		return err
	}
	if err := handlers.StartWordBookPurgeAudioQueue(db); err != nil {
		return err
	}
	handlers.StartCustomWordEnrichCache(db)

	if !s.Cfg.IsDev() {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	r := gin.New()
	r.RedirectTrailingSlash = false
	r.RedirectFixedPath = false
	r.MaxMultipartMemory = 32 << 20

	// demo 顺序：RequestID → Logger → Panic → CORS → i18n → RateLimit → CircuitBreaker
	r.Use(localmw.RequestIDMiddleware())
	r.Use(localmw.LoggerMiddleware(logger.Lg))
	r.Use(localmw.PanicRecovery())
	r.Use(localmw.APICors())
	r.Use(localmw.SecurityHeaders())
	if s.I18n != nil && s.Cfg.I18n.Enabled {
		r.Use(i18ngin.Middleware(s.I18n))
	}
	r.Use(localmw.RateLimit(s.Cfg.RateLimit))
	if s.Cfg.CircuitBreaker.Enabled {
		r.Use(localmw.CircuitBreakerMiddleware())
	}

	if s.Cfg.JWT.Enabled {
		accessTTL, _ := time.ParseDuration(s.Cfg.JWT.AccessTTL)
		refreshTTL, _ := time.ParseDuration(s.Cfg.JWT.RefreshTTL)
		jwtAuth, err := jwtutil.New(jwtutil.Config{
			Secret:     []byte(s.Cfg.JWT.Secret),
			Issuer:     s.Cfg.JWT.Issuer,
			AccessTTL:  accessTTL,
			RefreshTTL: refreshTTL,
		})
		if err != nil {
			return fmt.Errorf("jwt: %w", err)
		}
		r.Use(jwtingin.Middleware(jwtAuth, jwtingin.WithPublicPaths(
			"/health", "/live", "/ready", "/api/version",
			"/docs", "/openapi",
			"/api/auth/login", "/api/auth/register", "/api/auth/captcha", "/api/auth/salt",
			"/api/auth/send", "/api/auth/reset-password", "/api/auth/verify-email",
			"/api/auth/wechat/mp/message",
		)))
	}

	secret := s.Cfg.Auth.SessionSecret
	if secret == "" {
		secret = common.GetEnv(constants.ENV_SESSION_SECRET)
	}
	if secret != "" {
		expireDays := s.Cfg.Auth.SessionExpireDays
		if expireDays <= 0 {
			expireDays = 7
		}
		r.Use(localmw.WithCookieSession(secret, expireDays*24*3600))
	} else {
		r.Use(localmw.WithMemSession(utils.RandText(32)))
	}

	uploadDir := common.GetEnv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	r.Static("/uploads", uploadDir)
	r.Static("/media", uploadDir)

	docsEnabled := s.Cfg.Docs.Enabled
	api := apidocs.Mount(r, apidocs.Options{
		Title:       s.Info.Name + " API",
		Version:     s.Info.Version,
		Description: "CloudSteps 陪练与单词训练 API（OpenAPI）",
		DocsPath:    s.Cfg.Docs.Path,
		DarkMode:    s.Cfg.Docs.DarkMode,
		APIPrefix:   s.Cfg.Server.APIPrefix,
		EnabledFunc: func() bool { return docsEnabled },
	})

	h := handlers.NewHandlers(db, globalCache, configStore, s.metrics)
	root := humax.NewGroup(api, r, "")
	h.RegisterSystem(root, s.Info)
	h.Register(r, api)
	handlers.EnrichOpenAPI(api)

	listeners.InitSystemListeners()
	listeners.InitAuthMailListeners(db)
	listeners.InitFeedbackListeners(db)
	common.Sig().Emit(constants.SigInitSystemConfig, nil)

	s.server = &http.Server{
		Addr:           s.Cfg.ListenAddr(),
		Handler:        r,
		ReadTimeout:    s.Cfg.Server.ReadTimeout,
		WriteTimeout:   s.Cfg.Server.WriteTimeout,
		IdleTimeout:    s.Cfg.Server.IdleTimeout,
		MaxHeaderBytes: 1 << 20,
	}

	go func() {
		logger.Info("HTTP 服务已启动",
			zap.String("addr", s.server.Addr),
			zap.String("version", s.Info.Version),
			zap.String("env", s.Cfg.App.Environment),
		)
		var serveErr error
		if s.Cfg.Server.SSLEnabled && listeners.IsSSLEnabled() {
			tlsConfig, err := listeners.GetTLSConfig()
			if err != nil {
				logger.Error("TLS config", zap.Error(err))
				return
			}
			if tlsConfig != nil {
				s.server.TLSConfig = tlsConfig
				serveErr = s.server.ListenAndServeTLS("", "")
			} else {
				logger.Warn("SSL enabled but TLS config is nil, falling back to HTTP")
				serveErr = s.server.ListenAndServe()
			}
		} else {
			serveErr = s.server.ListenAndServe()
		}
		if serveErr != nil && serveErr != http.ErrServerClosed {
			logger.Error("HTTP 服务异常", zap.Error(serveErr))
		}
	}()

	_ = ctx
	return nil
}

func (s *HTTPServer) Stop(ctx context.Context) error {
	logger.Info("正在关闭 HTTP 服务...")
	_ = handlers.StopWordBookBatchAudioQueue()
	_ = handlers.StopWordBookPurgeAudioQueue()
	if s.metrics != nil {
		_ = s.metrics.Close()
	}
	if s.server == nil {
		return nil
	}
	return s.server.Shutdown(ctx)
}

func (s *HTTPServer) IsRunning() bool {
	return s.server != nil
}
