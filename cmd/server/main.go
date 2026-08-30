package main

import (
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/app"
	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/handlers"
	"github.com/LingByte/ling-base/bootstrap"
	lbconstants "github.com/LingByte/ling-base/common/constants"
	"github.com/LingByte/ling-base/common/logger"
	"github.com/LingByte/ling-base/common/response"
	respgin "github.com/LingByte/ling-base/common/response/gin"
	"github.com/LingByte/ling-base/i18n"
	"go.uber.org/zap"
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

	lbApp := bootstrap.New(info.Name,
		bootstrap.WithProfile(cfg.Mode()),
		bootstrap.WithBannerFile("banner.txt"),
		bootstrap.WithShutdownTimeout(30*time.Second),
	)

	if err := lbApp.Register("http-server", &app.HTTPServer{
		Cfg:         cfg,
		Info:        info,
		I18n:        i18nManager,
		InitSQL:     *initSQL,
		AutoMigrate: *initDB,
		SeedNonProd: *seed,
	}); err != nil {
		logger.Error("注册 HTTP 组件失败", zap.Error(err))
		os.Exit(1)
	}

	if err := lbApp.Run(); err != nil {
		logger.Error("应用启动失败", zap.Error(err))
		os.Exit(1)
	}
}
