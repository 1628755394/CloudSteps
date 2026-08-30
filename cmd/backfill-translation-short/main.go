package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/LingByte/CloudStepsGo/internal/app"
	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/models"
)

// 为 words 表回填 translation_short（用与前端一致的简译算法）。
//
// 用法:
//
//	go run ./cmd/backfill-translation-short
//	go run ./cmd/backfill-translation-short --dry-run
//	go run ./cmd/backfill-translation-short --batch 1000
func main() {
	dryRun := flag.Bool("dry-run", false, "只统计不写入")
	batch := flag.Int("batch", 500, "每批处理条数")
	flag.Parse()

	if _, err := configs.Load("configs/config.yaml"); err != nil {
		fmt.Fprintf(os.Stderr, "config load failed: %v\n", err)
		os.Exit(1)
	}

	db, err := app.Connect(os.Stdout)
	if err != nil {
		fmt.Fprintf(os.Stderr, "database connect failed: %v\n", err)
		os.Exit(1)
	}

	var total int64
	if err := db.Model(&models.Word{}).
		Where("translation <> ''").
		Where("translation_short = '' OR translation_short IS NULL").
		Count(&total).Error; err != nil {
		fmt.Fprintf(os.Stderr, "count failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("待回填词条: %d\n", total)
	if total == 0 {
		return
	}
	if *dryRun {
		fmt.Println("dry-run 模式，未写入")
		return
	}

	updated := 0
	for {
		var words []models.Word
		err := db.
			Where("translation <> ''").
			Where("translation_short = '' OR translation_short IS NULL").
			Limit(*batch).
			Find(&words).Error
		if err != nil {
			fmt.Fprintf(os.Stderr, "query failed: %v\n", err)
			os.Exit(1)
		}
		if len(words) == 0 {
			break
		}
		for _, w := range words {
			short := models.FormatTranslationShort(w.Translation)
			if err := db.Model(&models.Word{}).Where("id = ?", w.ID).
				Update("translation_short", short).Error; err != nil {
				fmt.Fprintf(os.Stderr, "update id=%d failed: %v\n", w.ID, err)
				os.Exit(1)
			}
			updated++
		}
		fmt.Printf("已回填 %d / %d\n", updated, total)
	}
	fmt.Printf("完成，共更新 %d 条\n", updated)
}
