package main

import (
	"context"
	"flag"
	"net/http"
	"os"
	"time"

	"github.com/LingByte/CloudStepsGo/cmd/bootstrap"
	"github.com/LingByte/CloudStepsGo/internal/handlers"
	"github.com/LingByte/CloudStepsGo/internal/listeners"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/internal/sysmetrics"
	"github.com/LingByte/CloudStepsGo/internal/task"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/CloudStepsGo/pkg/middleware"
	"github.com/LingByte/CloudStepsGo/pkg/utils"
	lbbootstrap "github.com/LingByte/ling-base/bootstrap"
	"github.com/LingByte/ling-base/cache/lru"
	"github.com/LingByte/ling-base/captcha"
	"github.com/LingByte/ling-base/common"
	lbconfig "github.com/LingByte/ling-base/common/config"
	"github.com/LingByte/ling-base/common/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type CloudStepsGoApp struct {
	db       *gorm.DB
	handlers *handlers.Handlers
}

func NewCloudStepsGoApp(db *gorm.DB, cache *lru.Cache[string, any], configStore *lbconfig.Store, metrics *sysmetrics.Service) *CloudStepsGoApp {
	return &CloudStepsGoApp{
		db:       db,
		handlers: handlers.NewHandlers(db, cache, configStore, metrics),
	}
}

func (app *CloudStepsGoApp) RegisterRoutes(r *gin.Engine) {
	// Register system routes (with /api prefix)
	app.handlers.Register(r)
}

func main() {
	// 1. Parse Command Line Parameters
	init := flag.Bool("init", false, "initialize database")
	seed := flag.Bool("seed", false, "seed database")
	mode := flag.String("mode", "", "running environment (development, test, production)")
	initSQL := flag.String("init-sql", "", "path to database init .sql script (optional)")
	flag.Parse()

	// 2. Set Environment Variables
	if *mode != "" {
		os.Setenv("APP_ENV", *mode)
	}

	// 3. Load Global Configuration
	if err := config.Load(); err != nil {
		panic("config load failed: " + err.Error())
	}

	// 4. Load Log Configuration
	if err := logger.Init(&config.GlobalConfig.Log, config.GlobalConfig.Server.Mode); err != nil {
		panic(err)
	}

	// 5. Create ling-base Application (banner + profile + lifecycle + shutdown)
	app := lbbootstrap.New(config.GlobalConfig.Server.Name,
		lbbootstrap.WithProfile(config.GlobalConfig.Server.Mode),
		lbbootstrap.WithBannerFile("banner.txt"),
		lbbootstrap.WithShutdownTimeout(30*time.Second),
	)

	// 7. Load Data Source
	db, err := bootstrap.SetupDatabase(os.Stdout, &bootstrap.Options{
		InitSQLPath: *initSQL, // Can be specified via --init-sql
		AutoMigrate: *init,    // Whether to migrate entities
		SeedNonProd: *seed,    // Non-production default configuration
	})
	if err != nil {
		logger.Error("database setup failed", zap.Error(err))
		return
	}

	// 7.5. Initialize global config store (DB-backed)
	configStore, err := lbconfig.NewStoreWithDB(db)
	if err != nil {
		logger.Error("config store init failed", zap.Error(err))
		return
	}

	// 8. Load Base Configs
	addr := config.GlobalConfig.Server.Addr
	if addr == "" {
		addr = ":7072"
	}

	DBDriver := config.GlobalConfig.Database.Driver
	if DBDriver == "" {
		DBDriver = "sqlite"
	}

	DSN := config.GlobalConfig.Database.DSN
	if DSN == "" {
		DSN = "file::memory:?cache=shared"
	}

	logger.Info("checked config -- addr: ", zap.String("addr", addr))
	logger.Info("checked config -- db-driver: ", zap.String("db-driver", DBDriver), zap.String("dsn", DSN))
	logger.Info("checked config -- mode: ", zap.String("mode", config.GlobalConfig.Server.Mode))

	// Initialize global LRU cache
	globalCache, err := lru.New[string, any](1024, lru.WithDefaultTTL(5*time.Minute))
	if err != nil {
		logger.Error("cache init failed", zap.Error(err))
		return
	}

	// Initialize global registration guard
	utils.InitGlobalRegistrationGuard(logger.Lg, globalCache)

	// Initialize global captcha manager
	captcha.InitGlobalManager(captcha.DefaultConfig()) // Use memory storage, can be replaced with Redis storage

	metrics := sysmetrics.New(db)
	app.AddShutdownHook("sys-metrics", func(ctx context.Context) error {
		logger.Info("flushing sys metrics...")
		return metrics.Close()
	})

	// 11. New App
	cloudApp := NewCloudStepsGoApp(db, globalCache, configStore, metrics)

	// 12. Initialize Global Middleware Manager
	middleware.InitGlobalMiddlewareManager(config.GlobalConfig.Middleware)
	logger.Info("Global middleware manager initialized with config",
		zap.Bool("rateLimit", config.GlobalConfig.Middleware.EnableRateLimit),
		zap.Bool("timeout", config.GlobalConfig.Middleware.EnableTimeout),
		zap.Bool("circuitBreaker", config.GlobalConfig.Middleware.EnableCircuitBreaker),
		zap.Bool("operationLog", config.GlobalConfig.Middleware.EnableOperationLog))

	// 15. Start Timed task
	task.StartEmailCleaner(db)
	task.StartCoachingAutoEnd(db)

	// 15.5 Wordbook batch-audio queue（并发 = QCloud 账号数 × 9）
	if err := handlers.StartWordBookBatchAudioQueue(db); err != nil {
		logger.Error("wordbook batch-audio queue start failed", zap.Error(err))
		return
	}
	app.AddShutdownHook("wordbook-batch-audio-queue", func(ctx context.Context) error {
		logger.Info("stopping wordbook batch-audio queue...")
		return handlers.StopWordBookBatchAudioQueue()
	})

	// 15.6 Wordbook purge-audio queue（默认 16 并发，与 TTS 独立）
	if err := handlers.StartWordBookPurgeAudioQueue(db); err != nil {
		logger.Error("wordbook purge-audio queue start failed", zap.Error(err))
		return
	}
	app.AddShutdownHook("wordbook-purge-audio-queue", func(ctx context.Context) error {
		logger.Info("stopping wordbook purge-audio queue...")
		return handlers.StopWordBookPurgeAudioQueue()
	})

	// 15. Initialize Gin Routing
	gin.SetMode(gin.ReleaseMode)
	r := gin.New() // Use gin.New() instead of gin.Default() to avoid automatic redirects
	r.Use(middleware.RequestIDMiddleware())
	r.Use(middleware.PanicRecovery())
	r.Use(middleware.SecurityHeadersMiddleware())
	r.LoadHTMLGlob("templates/**/**")

	// Disable automatic redirects to avoid CORS issues caused by 307 redirects
	r.RedirectTrailingSlash = false
	r.RedirectFixedPath = false

	// Set maximum memory limit for multipart forms (32MB)
	r.MaxMultipartMemory = 32 << 20 // 32 MB

	// 16. use middleware
	// Cookie Register
	secret := common.GetEnv(constants.ENV_SESSION_SECRET)
	if secret != "" {
		expireDays := common.GetIntEnv(constants.ENV_SESSION_EXPIRE_DAYS)
		if expireDays <= 0 {
			expireDays = 7
		}
		r.Use(middleware.WithCookieSession(secret, int(expireDays)*24*3600))
	} else {
		r.Use(middleware.WithMemSession(utils.RandText(32)))
	}

	// Cors Handle Middleware
	r.Use(middleware.CorsMiddleware())

	// Logger Handle Middleware (after RequestID so X-Reqid is available)
	r.Use(middleware.LoggerMiddleware(zap.L()))

	// Static service for uploaded files
	uploadDir := common.GetEnv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	// 注册 /uploads（主路径）并保留 /media 兼容历史
	r.Static("/uploads", uploadDir)
	r.Static("/media", uploadDir)

	// 18. Register Routes
	cloudApp.RegisterRoutes(r)

	// 19. Initialize System Listener
	listeners.InitSystemListeners()
	listeners.InitAuthMailListeners(db)

	// 20. Start Search Indexer (if enabled)
	searchEnabled := configStore.GetBoolValue(constants.KEY_SEARCH_ENABLED)
	if !searchEnabled && config.GlobalConfig != nil {
		searchEnabled = config.GlobalConfig.Features.SearchEnabled
	}
	// 21. Emit system initialization signal
	common.Sig().Emit(models.SigInitSystemConfig, nil)

	// 22. Start HTTP/HTTPS Server
	httpServer := &http.Server{
		Addr:           addr,
		Handler:        r,
		ReadTimeout:    300 * time.Second,
		WriteTimeout:   30 * time.Second,
		IdleTimeout:    120 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1MB
	}

	// Register graceful shutdown hook for HTTP server
	app.AddShutdownHook("http-server", func(ctx context.Context) error {
		logger.Info("shutting down HTTP server...")
		if err := httpServer.Shutdown(ctx); err != nil {
			logger.Error("HTTP server shutdown error", zap.Error(err))
			return err
		}
		logger.Info("HTTP server stopped gracefully")
		return nil
	})

	// Start HTTP server in background
	go func() {
		if config.GlobalConfig.Server.SSLEnabled && listeners.IsSSLEnabled() {
			tlsConfig, err := listeners.GetTLSConfig()
			if err != nil {
				logger.Error("failed to get TLS config", zap.Error(err))
				return
			}
			if tlsConfig != nil {
				httpServer.TLSConfig = tlsConfig
				logger.Info("Starting HTTPS server", zap.String("addr", addr))
				if err := httpServer.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
					logger.Error("HTTPS server run failed", zap.Error(err))
				}
			} else {
				logger.Warn("SSL enabled but TLS config is nil, falling back to HTTP")
				if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
					logger.Error("HTTP server run failed", zap.Error(err))
				}
			}
		} else {
			logger.Info("Starting HTTP server", zap.String("addr", addr))
			if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				logger.Error("HTTP server run failed", zap.Error(err))
			}
		}
	}()

	// 23. Run application (blocks until shutdown signal)
	if err := app.Run(); err != nil {
		logger.Error("application run failed", zap.Error(err))
	}
}
