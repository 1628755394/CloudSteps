// 清除 vocab_test_questions 表中全部音频：先调用对象存储 Delete，再清空 audio_url。
//
// 用法（项目根目录）:
//
//	go run ./cmd/purge-vocab-audio --dry-run
//	go run ./cmd/purge-vocab-audio --execute
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	"github.com/LingByte/ling-base/common"
)

func main() {
	dryRun := flag.Bool("dry-run", true, "仅预览，不删除对象、不写库（默认 true）")
	execute := flag.Bool("execute", false, "执行：对象存储 Delete + 清空 audio_url")
	dsnOverride := flag.String("dsn", "", "可选：覆盖 .env 中的 DSN（DNS 不可用时可用 IP）")
	flag.Parse()

	if *execute {
		*dryRun = false
	}
	if !*dryRun && !*execute {
		log.Fatal("请显式指定 --execute 才会删除；预览请加 --dry-run（默认）")
	}

	if err := config.Load(); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}
	if strings.TrimSpace(*dsnOverride) != "" {
		config.GlobalConfig.Database.DSN = strings.TrimSpace(*dsnOverride)
	}

	db, err := common.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, config.GlobalConfig.Database.DSN)
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	var questions []models.VocabTestQuestion
	if err := db.Select("id, word, audio_url").
		Where("audio_url IS NOT NULL AND audio_url <> ''").
		Find(&questions).Error; err != nil {
		log.Fatalf("查询失败: %v", err)
	}

	fmt.Printf("STORAGE_KIND=%s\n", stores.DefaultStoreKind)
	fmt.Printf("找到 %d 条带音频的题目\n", len(questions))
	if len(questions) == 0 {
		return
	}

	if *dryRun {
		fmt.Println("【预览模式】将删除以下对象（确认后请使用 --execute）：")
		show := 20
		if len(questions) < show {
			show = len(questions)
		}
		for i := 0; i < show; i++ {
			q := questions[i]
			keys := previewKeys(q.AudioURL)
			fmt.Printf("  id=%d word=%q keys=%v\n", q.ID, q.Word, keys)
		}
		if len(questions) > show {
			fmt.Printf("  ... 其余 %d 条省略\n", len(questions)-show)
		}
		return
	}

	cleared := 0
	objectsAttempted := 0
	objectsFailed := 0
	for _, q := range questions {
		a, f := stores.DeleteObjectURLs(q.AudioURL)
		objectsAttempted += a
		objectsFailed += f
		if err := db.Model(&models.VocabTestQuestion{}).
			Where("id = ?", q.ID).
			Update("audio_url", "").Error; err != nil {
			log.Printf("清空 id=%d 失败: %v", q.ID, err)
			continue
		}
		cleared++
	}

	fmt.Printf("完成：清空题目 %d/%d；对象删除尝试 %d，失败 %d\n",
		cleared, len(questions), objectsAttempted, objectsFailed)
}

func previewKeys(raw string) []string {
	out := make([]string, 0, 2)
	for _, part := range strings.Split(raw, ";") {
		u := strings.TrimSpace(part)
		if u == "" {
			continue
		}
		if key := stores.RecordingObjectKeyFromURL(u); key != "" {
			out = append(out, key)
		} else {
			out = append(out, "(unmapped:"+u+")")
		}
	}
	return out
}
