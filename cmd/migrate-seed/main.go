package main

import (
	"fmt"
	"os"

	"github.com/LingByte/CloudStepsGo/internal/bootstrap"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/ling-base/logger"
)

// One-shot: migrate entities + seed (including reading passages), then exit.
func main() {
	if err := config.Load(); err != nil {
		panic("config load failed: " + err.Error())
	}
	if err := logger.Init(&config.GlobalConfig.Log, config.GlobalConfig.Server.Mode); err != nil {
		panic(err)
	}

	db, err := bootstrap.SetupDatabase(os.Stdout, &bootstrap.Options{
		AutoMigrate: true,
		SeedNonProd: true,
	})
	if err != nil {
		panic(err)
	}
	_ = db
	fmt.Println("migrate + seed completed")
}
