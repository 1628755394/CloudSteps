package bootstrap

import (
	"errors"
	"io"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/listeners"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/middleware"
	"github.com/LingByte/ling-base/common"
	lbconfig "github.com/LingByte/ling-base/common/config"
	"github.com/LingByte/ling-base/logger"
	"go.uber.org/zap"

	"gorm.io/gorm"
)

// Options controls database initialization behavior
type Options struct {
	// InitSQLPath points to a .sql script file (optional); skip if empty
	InitSQLPath string
	// AutoMigrate whether to execute entity migration (default true)
	AutoMigrate bool
	// SeedNonProd whether to write default configuration in non-production environments (default true)
	SeedNonProd bool
}

// SetupDatabase unified entry: connect database -> run initialization SQL -> migrate entities -> (non-production) write default configuration
func SetupDatabase(logWriter io.Writer, opts *Options) (*gorm.DB, error) {
	if opts == nil {
		opts = &Options{AutoMigrate: true, SeedNonProd: true}
	}

	// 1) Connect to database
	db, err := initDBConn(logWriter)
	if err != nil {
		logger.Error("init database failed", zap.Error(err))
		return nil, err
	}

	// 2) Optional: execute initialization SQL
	if opts.InitSQLPath != "" {
		if err := common.RunInitSQL(db, opts.InitSQLPath); err != nil {
			logger.Error("run init sql failed", zap.String("path", opts.InitSQLPath), zap.Error(err))
			return nil, err
		}
	}

	// 3) Migrate entities
	if opts.AutoMigrate {
		if err := RunMigrations(db); err != nil {
			logger.Error("migration failed", zap.Error(err))
			return nil, err
		}
		logger.Info("migration success",
			zap.String("database", config.GlobalConfig.Database.Driver),
			zap.String("dsn", config.GlobalConfig.Database.DSN),
		)
	}

	// 3.5) Ensure critical columns exist even without --init flag (e.g. users.email)
	if err := ensureUsersEmailColumn(db); err != nil {
		logger.Error("ensure users.email column failed", zap.Error(err))
		return nil, err
	}

	// Notification templates (email + inbox) and default mail channel — always upsert so
	// /notification-templates has baseline rows even without --init / --seed flags.
	mailSeed := SeedService{db: db}
	if err := mailSeed.seedNotificationDefaults(); err != nil {
		logger.Error("notification seed failed", zap.Error(err))
		return nil, err
	}
	listeners.InitAuthMailListeners(db)

	// 4) Non-production: demo users, content, etc.
	if opts.SeedNonProd {
		service := SeedService{
			db: db,
		}
		if err := service.SeedAll(); err != nil {
			logger.Error("seed failed", zap.Error(err))
			return nil, err
		}
	}

	logger.Info("system bootstrap - database is initialization complete")
	return db, nil
}

// initDBConn creates *gorm.DB based on global configuration
func initDBConn(logWriter io.Writer) (*gorm.DB, error) {
	dbDriver := config.GlobalConfig.Database.Driver
	dsn := config.GlobalConfig.Database.DSN
	return common.InitDatabase(logWriter, dbDriver, dsn)
}

// RunMigrations executes entity migration
func RunMigrations(db *gorm.DB) error {
	if db == nil {
		return errors.New("db is nil")
	}
	if err := common.MakeMigrates(db, []any{
		&lbconfig.ConfigItem{},
		&models.AccountLock{},
		&models.UserDevice{},
		&models.LoginHistory{},
		&middleware.OperationLog{},
		&models.User{},
		&models.UserWordBook{},
		&models.UserWordState{},
		&models.UserWord{},
		&models.ReviewQueue{},
		&models.StudySession{},
		&models.SessionWord{},
		&models.WordBook{},
		&models.Word{},
		&models.VocabTestQuestion{},
		&models.VocabTestRecord{},
		&models.ReadingPassage{},
		&models.ReadingQuestion{},
		&models.ReadingRecord{},
		&models.ClozePassage{},
		&models.ClozeBlank{},
		&models.ClozeRecord{},
		&models.GrammarLesson{},
		&models.GrammarQuestion{},
		&models.GrammarRecord{},
		&models.InternalNotification{},
		&models.NotificationChannel{},
		&models.MailTemplate{},
		&models.MailLog{},
		&models.StudentTeacherCoachingQuota{},
		&models.TeacherCoachingUsagePeriod{},
		&models.CoachingAppointment{},
		&models.CoachingSessionRecord{},
		&models.CoachingAuditLog{},
		&models.ScenarioDialogueScenario{},
		&models.ScenarioDialogueSession{},
		&models.ScenarioDialogueTurn{},
		&models.SysMetric{},
	}); err != nil {
		return err
	}
	if err := fixScenarioDialogueCharset(db); err != nil {
		return err
	}
	return nil
}

// ensureUsersEmailColumn 确保 users 表有 email 列（GORM AutoMigrate 对已有表加带索引的列时可能不生效，这里做兜底）。
func ensureUsersEmailColumn(db *gorm.DB) error {
	if config.GlobalConfig.Database.Driver != "mysql" && config.GlobalConfig.Database.Driver != "sqlite" {
		return nil
	}
	// 检查 email 列是否已存在
	if config.GlobalConfig.Database.Driver == "mysql" {
		var colCount int64
		row := db.Raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email'").Row()
		if err := row.Scan(&colCount); err != nil {
			logger.Warn("check users.email column existence failed, will try ALTER TABLE", zap.Error(err))
		}
		if colCount > 0 {
			return nil
		}
		// 列不存在，显式添加
		if err := db.Exec("ALTER TABLE users ADD COLUMN email VARCHAR(128) DEFAULT ''").Error; err != nil {
			if !strings.Contains(err.Error(), "Duplicate column") {
				return err
			}
		}
		if err := db.Exec("CREATE INDEX idx_users_email ON users(email)").Error; err != nil {
			if !strings.Contains(err.Error(), "Duplicate") && !strings.Contains(err.Error(), "already exists") {
				logger.Warn("create idx_users_email failed (non-fatal)", zap.Error(err))
			}
		}
		logger.Info("users.email column ensured via explicit ALTER TABLE")
		return nil
	}
	// SQLite: 检查列是否存在
	var cols []struct {
		Name string `gorm:"column:name"`
	}
	db.Raw("PRAGMA table_info(users)").Scan(&cols)
	for _, c := range cols {
		if c.Name == "email" {
			return nil
		}
	}
	if err := db.Exec("ALTER TABLE users ADD COLUMN email TEXT").Error; err != nil {
		if !strings.Contains(err.Error(), "duplicate column") {
			return err
		}
	}
	logger.Info("users.email column ensured via explicit ALTER TABLE")
	return nil
}

// fixScenarioDialogueCharset ensures emoji/special chars work on MySQL (CynosDB defaults to utf8mb3).
func fixScenarioDialogueCharset(db *gorm.DB) error {
	if config.GlobalConfig.Database.Driver != "mysql" {
		return nil
	}
	tables := []string{
		"scenario_dialogue_scenarios",
		"scenario_dialogue_sessions",
		"scenario_dialogue_turns",
	}
	for _, table := range tables {
		stmt := "ALTER TABLE `" + table + "` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
		if table == "scenario_dialogue_sessions" {
			if err := db.Exec("ALTER TABLE `" + table + "` MODIFY COLUMN `review_summary` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci").Error; err != nil {
				if !strings.Contains(err.Error(), "Unknown column") {
					return err
				}
			}
			if err := db.Exec("ALTER TABLE `" + table + "` MODIFY COLUMN `review_detail` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci").Error; err != nil {
				if !strings.Contains(err.Error(), "Unknown column") {
					return err
				}
			}
		}
	}
	return nil
}
