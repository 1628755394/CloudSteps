package main

import (
	"fmt"
	"os"

	"github.com/LingByte/CloudStepsGo/internal/app"
	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/models"
)

// 导入阅读理解 seed 数据（按标题去重，已存在则跳过）。
//
// 用法:
//
//	go run ./cmd/seed-reading
func main() {
	if _, err := configs.Load("configs/config.yaml"); err != nil {
		fmt.Fprintf(os.Stderr, "config load failed: %v\n", err)
		os.Exit(1)
	}

	db, err := app.Connect(os.Stdout)
	if err != nil {
		fmt.Fprintf(os.Stderr, "database connect failed: %v\n", err)
		os.Exit(1)
	}

	var before int64
	if err := db.Model(&models.ReadingPassage{}).Count(&before).Error; err != nil {
		fmt.Fprintf(os.Stderr, "count failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("导入前阅读理解篇数: %d\n", before)

	svc := &app.SeedService{DB: db}
	if err := svc.SeedReadingPassages(); err != nil {
		fmt.Fprintf(os.Stderr, "seed failed: %v\n", err)
		os.Exit(1)
	}

	var after int64
	if err := db.Model(&models.ReadingPassage{}).Count(&after).Error; err != nil {
		fmt.Fprintf(os.Stderr, "count failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("导入后阅读理解篇数: %d（新增 %d 篇）\n", after, after-before)
}
