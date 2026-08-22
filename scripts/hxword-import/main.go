// Package main: 从 hxword_export 导入语法文章和阅读理解到 CloudSteps 数据库。
//
// 用法（在项目根目录）:
//
//	cd CloudStepsGo && go run ./scripts/hxword-import --dry-run
//	cd CloudStepsGo && go run ./scripts/hxword-import --execute
//
// 导入内容:
//   - 245 篇 hxword 语法文章 → grammar_lessons（解析语法模块）
//   - 1 篇完整阅读理解     → reading_passages + reading_questions（阅读理解/阅读训练模块）
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/ling-base/common"
	"gorm.io/gorm"
)

const operator = "script:hxword-import"

// ── hxword 数据结构 ──────────────────────────────────

type hxwordGrammarArticle struct {
	ID            int    `json:"id"`
	Title         string `json:"title"`
	Content       string `json:"content"`
	ContentLength int    `json:"content_length"`
	Path          string `json:"_path"`
	SortNum       int    `json:"sortNum"`
}

type hxwordReadingDetail struct {
	ID             int               `json:"id"`
	Title          string            `json:"title"`
	ArticleSource  string            `json:"articleSource"`
	Paragraphs     []hxwordParagraph `json:"paragraphs"`
	Questions      []hxwordQuestion  `json:"questions"`
	ReadingInfo    hxwordReadingInfo `json:"readingInfo"`
}

type hxwordReadingInfo struct {
	Difficulty  int    `json:"difficulty"`
	ReadingType string `json:"readingType"`
}

type hxwordParagraph struct {
	SortNum   int             `json:"sortNum"`
	Sentences []hxwordSentence `json:"sentences"`
}

type hxwordSentence struct {
	Text        string `json:"text"`
	Translation string `json:"translation"`
}

type hxwordQuestion struct {
	ID              int           `json:"id"`
	Type            string        `json:"type"`
	SortNum         int           `json:"sortNum"`
	Stem            string        `json:"stem"`
	StemTranslation string        `json:"stemTranslation"`
	Answer          string        `json:"answer"`
	AnswerExplain   string        `json:"answerExplain"`
	Options         []hxwordOption `json:"options"`
}

type hxwordOption struct {
	Key         string `json:"key"`
	Text        string `json:"text"`
	Translation string `json:"translation"`
}

// ── 主逻辑 ──────────────────────────────────────────

func main() {
	dryRun := flag.Bool("dry-run", true, "仅预览，不写入数据库（默认 true）")
	execute := flag.Bool("execute", false, "执行导入")
	exportDir := flag.String("export-dir", "hxword_export", "hxword_export 目录路径")
	flag.Parse()

	if *execute {
		*dryRun = false
	}
	if !*dryRun && !*execute {
		log.Fatal("请显式指定 --execute 才会写入数据库；预览请加 --dry-run（默认）")
	}

	if err := config.Load(); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	db, err := common.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, config.GlobalConfig.Database.DSN)
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	// 0. 修复表字符集并设置连接字符集
	if !*dryRun {
		fmt.Println("=== 修复表字符集 ===")
		// 确保连接使用 utf8mb4
		db.Exec("SET NAMES utf8mb4")
		fixCharset(db)
		// 再次设置，确保 ALTER 后连接仍然使用 utf8mb4
		db.Exec("SET NAMES utf8mb4")
	}

	// 1. 导入语法文章
	fmt.Println("\n=== 导入语法文章 ===")
	grammarCount, err := importGrammarLessons(db, *exportDir, *dryRun)
	if err != nil {
		log.Fatalf("导入语法文章失败: %v", err)
	}
	fmt.Printf("语法文章: %d 篇导入\n", grammarCount)

	// 2. 导入阅读理解
	fmt.Println("\n=== 导入阅读理解 ===")
	readingCount, readingQCount, err := importReadingPassages(db, *exportDir, *dryRun)
	if err != nil {
		log.Fatalf("导入阅读理解失败: %v", err)
	}
	fmt.Printf("阅读理解: %d 篇, %d 题导入\n", readingCount, readingQCount)

	if *dryRun {
		fmt.Println("\n（dry-run 模式，未写入数据库。加 --execute 执行导入）")
	} else {
		fmt.Println("\n导入完成！")
	}
}

// fixCharset 修复 grammar_lessons 和 reading_passages 表的字符集为 utf8mb4
func fixCharset(db *gorm.DB) {
	// 先修改表默认字符集
	tables := []string{
		"grammar_lessons",
		"grammar_questions",
		"reading_passages",
		"reading_questions",
		"cloze_passages",
		"cloze_blanks",
	}
	for _, table := range tables {
		sql := fmt.Sprintf("ALTER TABLE %s CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", table)
		if err := db.Exec(sql).Error; nil != err {
			log.Printf("  ⚠ 修复 %s 字符集失败: %v", table, err)
		} else {
			fmt.Printf("  ✓ %s 表字符集已修复\n", table)
		}
	}

	// 逐列修改字符集（CONVERT TO 有时不会改变已有列）
	type colDef struct {
		Table  string
		Column string
		Type   string // e.g. "varchar(256)", "text", "longtext"
	}
	columns := []colDef{
		// grammar_lessons
		{"grammar_lessons", "title", "varchar(256)"},
		{"grammar_lessons", "topic", "varchar(128)"},
		{"grammar_lessons", "level", "varchar(32)"},
		{"grammar_lessons", "explanation", "mediumtext"},
		{"grammar_lessons", "examples", "text"},
		{"grammar_lessons", "summary", "varchar(512)"},
		{"grammar_lessons", "status", "varchar(32)"},
		// grammar_questions
		{"grammar_questions", "stem", "text"},
		{"grammar_questions", "options", "text"},
		{"grammar_questions", "answer", "varchar(8)"},
		{"grammar_questions", "explanation", "text"},
		// reading_passages
		{"reading_passages", "title", "varchar(256)"},
		{"reading_passages", "level", "varchar(32)"},
		{"reading_passages", "content", "mediumtext"},
		{"reading_passages", "summary", "varchar(512)"},
		{"reading_passages", "status", "varchar(32)"},
		// reading_questions
		{"reading_questions", "stem", "text"},
		{"reading_questions", "options", "text"},
		{"reading_questions", "answer", "varchar(8)"},
		{"reading_questions", "explanation", "text"},
		// cloze_passages
		{"cloze_passages", "title", "varchar(256)"},
		{"cloze_passages", "level", "varchar(32)"},
		{"cloze_passages", "content", "mediumtext"},
		{"cloze_passages", "summary", "varchar(512)"},
		{"cloze_passages", "status", "varchar(32)"},
		// cloze_blanks
		{"cloze_blanks", "options", "text"},
		{"cloze_blanks", "answer", "varchar(8)"},
		{"cloze_blanks", "explanation", "text"},
	}
	for _, c := range columns {
		sql := fmt.Sprintf("ALTER TABLE %s MODIFY COLUMN %s %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
			c.Table, c.Column, c.Type)
		if err := db.Exec(sql).Error; err != nil {
			log.Printf("  ⚠ 修复 %s.%s 字符集失败: %v", c.Table, c.Column, err)
		} else {
			fmt.Printf("  ✓ %s.%s 列字符集已修复\n", c.Table, c.Column)
		}
	}
}

// ── 语法文章导入 ──────────────────────────────────────

func importGrammarLessons(db *gorm.DB, exportDir string, dryRun bool) (int, error) {
	grammarPath := filepath.Join(exportDir, "grammar", "all_articles_full.json")
	data, err := os.ReadFile(grammarPath)
	if err != nil {
		return 0, fmt.Errorf("读取语法文章文件失败: %w", err)
	}

	var articles []hxwordGrammarArticle
	if err := json.Unmarshal(data, &articles); err != nil {
		return 0, fmt.Errorf("解析语法文章 JSON 失败: %w", err)
	}

	fmt.Printf("  读取到 %d 篇语法文章\n", len(articles))

	sortCounter := make(map[string]int)

	for i := 0; i < 3 && i < len(articles); i++ {
		a := articles[i]
		fmt.Printf("  [%d] %s/%s (%d chars)\n", i+1, a.Path, a.Title, a.ContentLength)
	}
	fmt.Printf("  ... 共 %d 篇\n", len(articles))

	if dryRun {
		return len(articles), nil
	}

	imported := 0
	// 确保 SET NAMES 在每次插入前生效
	db.Exec("SET NAMES utf8mb4")
	for _, a := range articles {
		var count int64
		db.Model(&models.GrammarLesson{}).
			Where("title = ? AND is_deleted = ?", a.Title, models.SoftDeleteStatusActive).
			Count(&count)
		if count > 0 {
			continue
		}

		level, topic := parseGrammarPath(a.Path)

		sortCounter[level]++
		sortOrder := sortCounter[level]

		summary := extractPlainText(a.Content)
		if len(summary) > 200 {
			summary = summary[:200] + "..."
		}

		// 先尝试插入，如果 summary 列字符集失败则用空字符串重试
		result := db.Exec(`INSERT INTO grammar_lessons
			(title, topic, level, explanation, examples, summary, status, estimated_minutes, sort_order, is_deleted, created_at, updated_at, create_by, update_by)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)`,
			a.Title, topic, level, a.Content, "[]", summary,
			models.GrammarStatusPublished, 5, sortOrder,
			models.SoftDeleteStatusActive, operator, operator)
		if result.Error != nil {
			// 重试：summary 用空字符串
			result = db.Exec(`INSERT INTO grammar_lessons
				(title, topic, level, explanation, examples, summary, status, estimated_minutes, sort_order, is_deleted, created_at, updated_at, create_by, update_by)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)`,
				a.Title, topic, level, a.Content, "[]", "",
				models.GrammarStatusPublished, 5, sortOrder,
				models.SoftDeleteStatusActive, operator, operator)
		}
		if result.Error != nil {
			log.Printf("  ⚠ 导入失败: %s (%v)", a.Title, result.Error)
			continue
		}
		imported++
	}

	return imported, nil
}

func parseGrammarPath(path string) (level, topic string) {
	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		return "初阶", path
	}

	category := parts[0]
	topic = parts[1]

	switch category {
	case "基本语法":
		level = "初阶"
	case "进阶语法":
		level = "中阶"
	case "重点难点":
		level = "高阶"
	default:
		level = "初阶"
	}

	return level, topic
}

var htmlTagRegex = regexp.MustCompile(`<[^>]+>`)
var htmlEntityReplacer = strings.NewReplacer(
	"&nbsp;", " ",
	"&lt;", "<",
	"&gt;", ">",
	"&amp;", "&",
	"&quot;", `"`,
	"&#39;", "'",
)

func extractPlainText(html string) string {
	text := htmlTagRegex.ReplaceAllString(html, "")
	text = htmlEntityReplacer.Replace(text)
	text = strings.TrimSpace(text)
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	return text
}

// ── 阅读理解导入 ──────────────────────────────────────

func importReadingPassages(db *gorm.DB, exportDir string, dryRun bool) (int, int, error) {
	readingDir := filepath.Join(exportDir, "content_full", "reading")
	files, err := filepath.Glob(filepath.Join(readingDir, "*.json"))
	if err != nil {
		return 0, 0, fmt.Errorf("查找阅读理解文件失败: %w", err)
	}

	fmt.Printf("  找到 %d 个阅读理解文件\n", len(files))

	importedPassages := 0
	importedQuestions := 0

	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			log.Printf("  ⚠ 读取文件失败: %s (%v)", file, err)
			continue
		}

		var resp struct {
			Data hxwordReadingDetail `json:"data"`
		}
		if err := json.Unmarshal(data, &resp); err != nil {
			log.Printf("  ⚠ 解析 JSON 失败: %s (%v)", file, err)
			continue
		}

		rd := resp.Data
		fmt.Printf("  [%s] %s (%d段, %d题)\n",
			filepath.Base(file), rd.Title, len(rd.Paragraphs), len(rd.Questions))

		content := reconstructPassage(rd.Paragraphs)
		wordCount := len(strings.Fields(content))
		level := mapDifficulty(rd.ReadingInfo.Difficulty)

		fmt.Printf("    正文: %d 词, 难度: %s\n", wordCount, level)
		for i, q := range rd.Questions {
			answer := q.Answer
			if answer == "" {
				answer = "(无答案)"
			}
			fmt.Printf("    Q%d [%s]: %s → %s\n", i+1, q.Type, truncate(q.Stem, 50), answer)
		}

		if dryRun {
			importedPassages++
			for _, q := range rd.Questions {
				if q.Answer != "" && q.Type == "choice" {
					importedQuestions++
				}
			}
			continue
		}

		db.Exec("SET NAMES utf8mb4")

		var count int64
		db.Model(&models.ReadingPassage{}).
			Where("title = ? AND is_deleted = ?", rd.Title, models.SoftDeleteStatusActive).
			Count(&count)
		if count > 0 {
			log.Printf("  ⚠ 已存在，跳过: %s", rd.Title)
			continue
		}

		result := db.Exec(`INSERT INTO reading_passages
			(title, level, content, summary, status, word_count, estimated_minutes, sort_order, is_deleted, created_at, updated_at, create_by, update_by)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)`,
			rd.Title, level, content, rd.ArticleSource,
			models.ReadingStatusPublished, wordCount, 5, 1,
			models.SoftDeleteStatusActive, operator, operator)
		if result.Error != nil {
			log.Printf("  ⚠ 创建文章失败: %s (%v)", rd.Title, result.Error)
			continue
		}

		var passageID uint
		db.Raw("SELECT LAST_INSERT_ID()").Scan(&passageID)
		importedPassages++

		qSort := 0
		for _, q := range rd.Questions {
			if q.Type != "choice" || q.Answer == "" {
				log.Printf("    ⚠ 跳过无答案/非选择题: Q%d (type=%s)", q.SortNum, q.Type)
				continue
			}

			opts := make([]map[string]string, 0, len(q.Options))
			for _, opt := range q.Options {
				opts = append(opts, map[string]string{
					"key":  opt.Key,
					"text": opt.Text,
				})
			}
			optsJSON, _ := json.Marshal(opts)

			qSort++
			qResult := db.Exec(`INSERT INTO reading_questions
				(passage_id, stem, options, answer, explanation, sort_order, is_deleted, created_at, updated_at, create_by, update_by)
				VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)`,
				passageID, q.Stem, string(optsJSON), q.Answer, q.AnswerExplain, qSort,
				models.SoftDeleteStatusActive, operator, operator)
			if qResult.Error != nil {
				log.Printf("    ⚠ 创建题目失败: Q%d (%v)", q.SortNum, qResult.Error)
				continue
			}
			importedQuestions++
		}
	}

	return importedPassages, importedQuestions, nil
}

func reconstructPassage(paragraphs []hxwordParagraph) string {
	var parts []string
	for _, para := range paragraphs {
		var sentences []string
		for _, s := range para.Sentences {
			sentences = append(sentences, s.Text)
		}
		parts = append(parts, strings.Join(sentences, " "))
	}
	return strings.Join(parts, "\n\n")
}

func mapDifficulty(difficulty int) string {
	switch {
	case difficulty <= 3:
		return "初阶"
	case difficulty <= 6:
		return "中阶"
	default:
		return "高阶"
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
