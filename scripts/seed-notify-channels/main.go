package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/cmd/bootstrap"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/internal/notify"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/ling-base/logger"
	"gorm.io/gorm"
)

// Reads a JSON array of notify.MailConfig from stdin, migrates notify tables,
// upserts each as an enabled email NotificationChannel keyed by config name.
func main() {
	if err := config.Load(); err != nil {
		panic("config load failed: " + err.Error())
	}
	if err := logger.Init(&config.GlobalConfig.Log, config.GlobalConfig.Server.Mode); err != nil {
		panic(err)
	}
	raw, err := io.ReadAll(os.Stdin)
	if err != nil {
		panic(err)
	}
	var cfgs []notify.MailConfig
	if err := json.Unmarshal(raw, &cfgs); err != nil {
		panic("stdin must be a JSON array of mail configs: " + err.Error())
	}
	if len(cfgs) == 0 {
		panic("no channels in stdin")
	}

	db, err := bootstrap.SetupDatabase(os.Stdout, &bootstrap.Options{
		AutoMigrate: true,
		SeedNonProd: false,
	})
	if err != nil {
		panic(err)
	}

	for i, cfg := range cfgs {
		if err := upsertEmailChannel(db, cfg, i); err != nil {
			panic(err)
		}
		fmt.Printf("upserted channel %s\n", cfg.Name)
	}

	// Drop the env-imported default so only the provided channels remain.
	res := db.Model(&models.NotificationChannel{}).
		Where("type = ? AND code = ?", models.NotificationChannelTypeEmail, "E-default").
		Updates(map[string]any{"is_deleted": models.SoftDeleteStatusDeleted, "enabled": false})
	if res.Error != nil {
		panic(res.Error)
	}

	var n int64
	_ = db.Model(&models.NotificationChannel{}).
		Where("type = ? AND is_deleted = ?", models.NotificationChannelTypeEmail, models.SoftDeleteStatusActive).
		Count(&n)
	fmt.Printf("active email channels: %d\n", n)
}

func upsertEmailChannel(db *gorm.DB, cfg notify.MailConfig, sort int) error {
	name := strings.TrimSpace(cfg.Name)
	if name == "" {
		return fmt.Errorf("channel %d missing name", sort)
	}
	code := channelCode(cfg)
	raw, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	var row models.NotificationChannel
	err = db.Where("type = ? AND code = ?", models.NotificationChannelTypeEmail, code).First(&row).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	if err == gorm.ErrRecordNotFound {
		row = models.NotificationChannel{
			Type:       models.NotificationChannelTypeEmail,
			Code:       code,
			Name:       name,
			SortOrder:  sort,
			Enabled:    true,
			Remark:     "imported",
			ConfigJSON: string(raw),
		}
		return db.Create(&row).Error
	}
	row.Name = name
	row.SortOrder = sort
	row.Enabled = true
	row.IsDeleted = models.SoftDeleteStatusActive
	row.ConfigJSON = string(raw)
	row.UpdatedAt = time.Now()
	return db.Save(&row).Error
}

func channelCode(cfg notify.MailConfig) string {
	switch strings.ToLower(strings.TrimSpace(cfg.Provider)) {
	case notify.ProviderSendCloud:
		return "E-sendcloud"
	default:
		host := strings.ToLower(strings.TrimSpace(cfg.Host))
		if strings.Contains(host, "qq.com") {
			return "E-qq"
		}
		if strings.Contains(host, "zoho") {
			return "E-zoho"
		}
		return "E-smtp-" + strings.ReplaceAll(host, ".", "-")
	}
}
