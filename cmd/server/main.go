package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/app"
	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/database"
	"github.com/LingByte/CloudStepsGo/internal/handlers"
	"github.com/LingByte/CloudStepsGo/internal/seeds"
	"github.com/LingByte/ling-base/bootstrap"
	"github.com/LingByte/ling-base/common"
	lbconstants "github.com/LingByte/ling-base/common/constants"
	"github.com/LingByte/ling-base/common/logger"
	"github.com/LingByte/ling-base/common/response"
	respgin "github.com/LingByte/ling-base/common/response/gin"
	"github.com/LingByte/ling-base/i18n"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Version / BuildTime / GitCommit 可由 ldflags 注入。
var (
	Version   = "dev"
	BuildTime = "unknown"
	GitCommit = "none"
)

func main() {
	initDB := flag.Bool("init", false, "initialize database (auto-migrate)")
	seed := flag.Bool("seed", false, "seed database")
	mode := flag.String("mode", "", "running environment (development, test, production / dev, test, prod)")
	initSQL := flag.String("init-sql", "", "path to database init .sql script (optional)")
	configPath := flag.String("config", "configs/config.yaml", "path to YAML config")
	flag.Parse()

	if *mode != "" {
		_ = os.Setenv("APP_ENV", *mode)
	}

	cfg, err := configs.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}

	info := handlers.AppInfo{
		Name:      cfg.App.Name,
		Version:   Version,
		BuildTime: BuildTime,
		GitCommit: GitCommit,
	}
	if info.Name == "" {
		info.Name = "CloudSteps"
	}
	handlers.EnrichAppInfo(&info)

	logger.InitTimezone(lbconstants.TimezoneShanghai)
	if err := logger.Init(cfg.LogConfig(), cfg.Mode()); err != nil {
		fmt.Fprintf(os.Stderr, "初始化日志失败: %v\n", err)
		os.Exit(1)
	}

	var i18nManager *i18n.Manager
	if cfg.I18n.Enabled {
		supportedLocales := make([]i18n.Locale, len(cfg.I18n.SupportedLocales))
		for i, loc := range cfg.I18n.SupportedLocales {
			supportedLocales[i] = i18n.Locale(loc)
		}
		i18nManager = i18n.NewManager(&i18n.Config{
			DefaultLocale:    i18n.Locale(cfg.I18n.DefaultLocale),
			SupportedLocales: supportedLocales,
			FallbackLocale:   i18n.Locale(cfg.I18n.FallbackLocale),
			TranslationsPath: cfg.I18n.TranslationsPath,
		})
		respgin.Resolver = response.ResolverFunc(func(key string, args ...any) string {
			return i18nManager.T(i18nManager.GetDefaultLocale(), key, args...)
		})
	}

	logger.Info("checked config",
		zap.String("addr", cfg.ListenAddr()),
		zap.String("db-driver", cfg.Database.Driver),
		zap.String("env", cfg.App.Environment),
	)

	// 连接数据库（在创建 Application 之前，因为 WithAutoMigrate 需要已连接的 *gorm.DB）
	db, err := database.Connect(os.Stdout)
	if err != nil {
		logger.Error("init database failed", zap.Error(err))
		os.Exit(1)
	}

	// 可选：执行初始化 SQL
	if *initSQL != "" {
		if err := runInitSQL(db, *initSQL); err != nil {
			logger.Error("run init sql failed", zap.String("path", *initSQL), zap.Error(err))
			os.Exit(1)
		}
	}

	lbApp := bootstrap.New(info.Name,
		bootstrap.WithProfile(cfg.Mode()),
		bootstrap.WithBannerFile("banner.txt"),
		bootstrap.WithShutdownTimeout(30*time.Second),
	)

	// 迁移：使用 ling-base bootstrap 的 WithAutoMigrate
	if *initDB {
		lbApp.AddInitHook("auto-migrate", func(ctx context.Context) error {
			models := database.Models()
			logger.Info("running auto-migrate", zap.Int("models", len(models)))
			if err := db.AutoMigrate(models...); err != nil {
				return fmt.Errorf("auto-migrate failed: %w", err)
			}
			if err := database.PostMigrate(db); err != nil {
				return fmt.Errorf("post-migrate failed: %w", err)
			}
			logger.Info("migration success",
				zap.String("database", cfg.Database.Driver),
				zap.String("dsn", cfg.Database.DSN),
			)
			return nil
		})
	} else {
		// 即使不执行 AutoMigrate，也做后置修复（ensureUsersEmailColumn 等）
		lbApp.AddInitHook("post-migrate", func(ctx context.Context) error {
			return database.PostMigrate(db)
		})
	}

	// 通知模板种子（始终执行，确保基线行存在）
	lbApp.AddInitHook("seed-notification-defaults", func(ctx context.Context) error {
		seedSvc := &seeds.SeedService{DB: db}
		return seedSvc.SeedNotificationDefaults()
	})

	// 非生产环境种子数据
	if *seed {
		lbApp.AddInitHook("seed-all", func(ctx context.Context) error {
			seedSvc := &seeds.SeedService{DB: db}
			return seedSvc.SeedAll()
		})
	}

	if err := lbApp.Register("http-server", &app.HTTPServer{
		Cfg:  cfg,
		DB:   db,
		Info: info,
		I18n: i18nManager,
	}); err != nil {
		logger.Error("注册 HTTP 组件失败", zap.Error(err))
		os.Exit(1)
	}

	if err := lbApp.Run(); err != nil {
		logger.Error("应用启动失败", zap.Error(err))
		os.Exit(1)
	}
}

// runInitSQL 执行初始化 SQL 脚本（按分号分段）。
func runInitSQL(db *gorm.DB, path string) error {
	return common.RunInitSQL(db, path)
}
