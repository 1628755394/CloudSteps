// Command ddjdc-import 将 ddjdc_output 的单词和音频导入 CloudSteps 词库。
//
// 流程：
//  1. 读取 word_audio_map.json，将本地音频文件上传到七牛对象存储（并发）。
//  2. 读取 all_books_words.json，为每本书创建 WordBook，为每个单词创建 Word 记录。
//  3. Word.AudioURL 存储分号分隔的 UK;US 音频 URL（前端自动轮播）。
//  4. Word.Translation 存储为 JSON 数组字符串（如 ["n.铅笔"]）。
//
// 用法：
//
//	# 全量导入（音频 + 词库）
//	go run ./cmd/ddjdc-import -data-dir ~/Desktop/ddjdc_output
//
//	# 仅导入词库（跳过音频上传，使用已有的 URL）
//	go run ./cmd/ddjdc-import -data-dir ~/Desktop/ddjdc_output -skip-audio
//
//	# 仅上传音频（跳过词库导入）
//	go run ./cmd/ddjdc-import -data-dir ~/Desktop/ddjdc_output -skip-words
//
//	# 限制导入前 N 本书（测试用）
//	go run ./cmd/ddjdc-import -data-dir ~/Desktop/ddjdc_output -limit-books 5
//
//	# 指定并发上传数和七牛 key 前缀
//	go run ./cmd/ddjdc-import -data-dir ~/Desktop/ddjdc_output -workers 16 -key-prefix audio/words
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/audio"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	"github.com/LingByte/ling-base/common"
	"gorm.io/gorm"
)

const operator = "script:ddjdc-import"

// ----- JSON structures -----

type audioMapEntry struct {
	Hash     string `json:"hash"`
	UKFile   string `json:"uk_file"`
	USFile   string `json:"us_file"`
	UKURL    string `json:"uk_url"`
	USURL    string `json:"us_url"`
	UKExists bool   `json:"uk_exists"`
	USExists bool   `json:"us_exists"`
	UKSize   int64  `json:"uk_size"`
	USSize   int64  `json:"us_size"`
}

type audioMap struct {
	Source      string                  `json:"source"`
	TotalWords  int                     `json:"total_words"`
	Words       map[string]audioMapEntry `json:"words"`
}

type bookWord struct {
	Unit    string `json:"unit"`
	English string `json:"english"`
	Chinese string `json:"chinese"`
	Symbols string `json:"symbols"`
}

type bookEntry struct {
	BookID         json.RawMessage `json:"book_id"`
	BookName       string          `json:"book_name"`
	TotalWordsCount int            `json:"total_words_count"`
	WordCount      int             `json:"word_count"`
	Words          []bookWord      `json:"words"`
}

// bookIDString 将混合类型（数字/字符串）的 book_id 转为字符串
func bookIDString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	// 去除 JSON 字符串的引号
	if raw[0] == '"' {
		var s string
		if json.Unmarshal(raw, &s) == nil {
			return s
		}
	}
	// 数字或其他：直接转为字符串
	return strings.Trim(string(raw), `"`)
}

type allBooks struct {
	Source     string      `json:"source"`
	CrawledAt  string      `json:"crawled_at"`
	TotalBooks int         `json:"total_books"`
	TotalWords int         `json:"total_words"`
	Books      []bookEntry `json:"books"`
}

func main() {
	var (
		dataDir    = flag.String("data-dir", "~/Desktop/ddjdc_output", "ddjdc_output 数据目录")
		skipAudio  = flag.Bool("skip-audio", false, "跳过音频上传")
		skipWords  = flag.Bool("skip-words", false, "跳过词库导入")
		limitBooks = flag.Int("limit-books", 0, "仅导入前 N 本书（0=全部）")
		workers    = flag.Int("workers", 8, "音频上传并发数")
		keyPrefix  = flag.String("key-prefix", "audio/words", "七牛对象存储 key 前缀")
		batchSize  = flag.Int("batch-size", 200, "数据库批量写入大小")
		dryRun     = flag.Bool("dry-run", false, "仅预览不实际写入")
		skipExists = flag.Bool("skip-exists-check", true, "跳过逐个 Exists 检查（首次导入推荐，七牛重复上传会覆盖）")
	)
	flag.Parse()

	// 展开 ~ 路径
	if strings.HasPrefix(*dataDir, "~") {
		home, _ := os.UserHomeDir()
		*dataDir = filepath.Join(home, (*dataDir)[1:])
	}

	// 加载配置（读取 .env）
	if err := config.Load(); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	// 连接数据库
	db, err := common.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, config.GlobalConfig.Database.DSN)
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	// 为长时间运行的导入任务调整连接池参数（更积极地回收空闲连接）
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetMaxOpenConns(20)
		sqlDB.SetConnMaxLifetime(3 * time.Minute)
		sqlDB.SetConnMaxIdleTime(1 * time.Minute)
	}

	// 初始化对象存储
	store := stores.Default()
	log.Printf("对象存储后端: %T", store)

	// 读取音频映射
	audioMapData, err := loadAudioMap(*dataDir)
	if err != nil {
		log.Fatalf("读取 word_audio_map.json 失败: %v", err)
	}
	log.Printf("音频映射: %d 个单词", len(audioMapData.Words))

	// 构建音频 URL 映射表
	audioURLs := buildAudioURLMap(audioMapData, *keyPrefix)
	log.Printf("音频 URL 映射: %d 个单词有音频", len(audioURLs))

	// 阶段 1: 上传音频
	if !*skipAudio {
		if err := uploadAudio(store, *dataDir, audioMapData, *keyPrefix, *workers, *dryRun, *skipExists); err != nil {
			log.Fatalf("音频上传失败: %v", err)
		}
	} else {
		log.Println("跳过音频上传 (-skip-audio)")
	}

	// 阶段 2: 导入词库
	if !*skipWords {
		if err := importWords(db, *dataDir, audioURLs, *limitBooks, *batchSize, *dryRun); err != nil {
			log.Fatalf("词库导入失败: %v", err)
		}
	} else {
		log.Println("跳过词库导入 (-skip-words)")
	}

	log.Println("导入完成")
}

// ----- 音频上传 -----

type audioTask struct {
	word     string
	entry    audioMapEntry
	accent   string // "uk" or "us"
	localPath string
	key      string
}

func uploadAudio(store stores.Store, dataDir string, am *audioMap, keyPrefix string, workers int, dryRun bool, skipExists bool) error {
	audioDir := filepath.Join(dataDir, "audio")

	// 收集所有需要上传的任务
	var tasks []audioTask
	for word, entry := range am.Words {
		if entry.UKExists {
			tasks = append(tasks, audioTask{
				word:      word,
				entry:     entry,
				accent:    "uk",
				localPath: filepath.Join(audioDir, entry.UKFile),
				key:       fmt.Sprintf("%s/%s", strings.TrimSuffix(keyPrefix, "/"), filepath.Base(entry.UKFile)),
			})
		}
		if entry.USExists {
			tasks = append(tasks, audioTask{
				word:      word,
				entry:     entry,
				accent:    "us",
				localPath: filepath.Join(audioDir, entry.USFile),
				key:       fmt.Sprintf("%s/%s", strings.TrimSuffix(keyPrefix, "/"), filepath.Base(entry.USFile)),
			})
		}
	}

	log.Printf("待上传音频文件: %d 个（并发: %d）", len(tasks), workers)
	if dryRun {
		for _, t := range tasks[:min(5, len(tasks))] {
			log.Printf("  [DRY-RUN] %s -> %s", t.localPath, t.key)
		}
		log.Printf("  ... 共 %d 个", len(tasks))
		return nil
	}

	// 并发上传
	taskCh := make(chan audioTask, workers*2)
	var wg sync.WaitGroup
	var ok, skip, fail, totalBytes int64

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for t := range taskCh {
				// 检查是否已存在（可跳过以加速首次导入）
				if !skipExists {
					exists, err := store.Exists(t.key)
					if err == nil && exists {
						atomic.AddInt64(&skip, 1)
						continue
					}
				}

				f, err := os.Open(t.localPath)
				if err != nil {
					log.Printf("[FAIL] 打开文件 %s: %v", t.localPath, err)
					atomic.AddInt64(&fail, 1)
					continue
				}

				if err := store.Write(t.key, f); err != nil {
					f.Close()
					log.Printf("[FAIL] 上传 %s -> %s: %v", t.word, t.key, err)
					atomic.AddInt64(&fail, 1)
					continue
				}
				f.Close()

				fi, _ := os.Stat(t.localPath)
				if fi != nil {
					atomic.AddInt64(&totalBytes, fi.Size())
				}
				atomic.AddInt64(&ok, 1)

				if n := atomic.LoadInt64(&ok) + atomic.LoadInt64(&skip); n%500 == 0 {
					log.Printf("  进度: ok=%d skip=%d fail=%d / %d (%.1f%%)", ok, skip, fail, len(tasks), float64(n)/float64(len(tasks))*100)
				}
			}
		}()
	}

	for _, t := range tasks {
		taskCh <- t
	}
	close(taskCh)
	wg.Wait()

	log.Printf("音频上传完成: ok=%d skip=%d fail=%d 总计=%.1f MB", ok, skip, fail, float64(totalBytes)/1024/1024)
	return nil
}

// ----- 词库导入 -----

type audioURLPair struct {
	uk string
	us string
}

func buildAudioURLMap(am *audioMap, keyPrefix string) map[string]audioURLPair {
	result := make(map[string]audioURLPair, len(am.Words))
	prefix := strings.TrimSuffix(keyPrefix, "/")
	for word, entry := range am.Words {
		var pair audioURLPair
		if entry.UKExists {
			pair.uk = fmt.Sprintf("%s/%s", prefix, filepath.Base(entry.UKFile))
		}
		if entry.USExists {
			pair.us = fmt.Sprintf("%s/%s", prefix, filepath.Base(entry.USFile))
		}
		result[word] = pair
	}
	return result
}

func importWords(db *gorm.DB, dataDir string, audioURLs map[string]audioURLPair, limitBooks, batchSize int, dryRun bool) error {
	// 读取 all_books_words.json
	booksPath := filepath.Join(dataDir, "all_books_words.json")
	f, err := os.Open(booksPath)
	if err != nil {
		return fmt.Errorf("打开 all_books_words.json: %w", err)
	}
	defer f.Close()

	var ab allBooks
	dec := json.NewDecoder(f)
	if err := dec.Decode(&ab); err != nil {
		return fmt.Errorf("解析 all_books_words.json: %w", err)
	}

	books := ab.Books
	if limitBooks > 0 && limitBooks < len(books) {
		books = books[:limitBooks]
	}

	log.Printf("待导入词库: %d 本 / 总单词数: %d", len(books), ab.TotalWords)
	if dryRun {
		for _, b := range books[:min(5, len(books))] {
			log.Printf("  [DRY-RUN] 词库: %s (%d 词)", b.BookName, b.WordCount)
		}
		log.Printf("  ... 共 %d 本", len(books))
		return nil
	}

	// 获取七牛 PublicURL 基础
	store := stores.Default()

	totalBooks := 0
	totalWords := 0
	skippedBooks := 0

	for bi, book := range books {
		// 每 10 本书 ping 一次数据库，保持连接活跃
		if bi%10 == 0 {
			dbRetry(3, func() error { return db.Exec("SELECT 1").Error })
		}

		// 检查词库是否已存在（按名称去重）—— 带重试
		var existing models.WordBook
		err := dbRetry(3, func() error {
			return db.Where("name = ? AND is_deleted = ?", book.BookName, models.SoftDeleteStatusActive).First(&existing).Error
		})
		if err == nil {
			log.Printf("[%d/%d] 跳过已存在: %s (ID=%d)", bi+1, len(books), book.BookName, existing.ID)
			skippedBooks++
			continue
		}

		// 创建 WordBook
		wb := models.WordBook{
			Name:        book.BookName,
			Description: fmt.Sprintf("来源: ddjdc.com (book_id=%s)", bookIDString(book.BookID)),
			WordCount:   book.WordCount,
			IsActive:    true,
			Category:    models.CategoryVocabulary,
			Language:    "en",
			TargetLanguage: "zh",
			Difficulty:  1,
			SourceName:  "ddjdc.com",
			SourceURL:   "https://ddjdc.com/",
			LicenseNote: "数据来源: ddjdc.com 爬取",
			Tags:        "[]",
		}
		wb.SetCreateInfo(operator)

		if err := dbRetry(3, func() error {
			return models.CreateWordBook(db, &wb)
		}); err != nil {
			log.Printf("[%d/%d] 创建词库失败: %s: %v", bi+1, len(books), book.BookName, err)
			continue
		}

		// 构建单词列表
		words := make([]models.Word, 0, len(book.Words))
		for wi, w := range book.Words {
			word := buildWord(wb.ID, w, wi, audioURLs, store)
			word.SetCreateInfo(operator)
			words = append(words, word)
		}

		// 批量创建 —— 带重试
		if err := dbRetry(3, func() error {
			return models.BatchCreateWords(db, words)
		}); err != nil {
			log.Printf("[%d/%d] 批量创建单词失败: %s: %v", bi+1, len(books), book.BookName, err)
			continue
		}

		totalBooks++
		totalWords += len(words)

		if (bi+1)%50 == 0 || bi == len(books)-1 {
			log.Printf("[%d/%d] 已导入: %s (%d 词) — 累计 %d 本 / %d 词", bi+1, len(books), book.BookName, len(words), totalBooks, totalWords)
		}
	}

	log.Printf("词库导入完成: 新增 %d 本 / %d 词, 跳过 %d 本已存在", totalBooks, totalWords, skippedBooks)
	return nil
}

// buildWord 从 ddjdc 数据构建 Word 模型
func buildWord(bookID uint, w bookWord, sortOrder int, audioURLs map[string]audioURLPair, store stores.Store) models.Word {
	// 音标：清理 ddjdc 的音标格式 [hə‧ˈləʊ] -> /həˈləʊ/
	phonetic := cleanPhonetic(w.Symbols)

	// 词性：从中文释义前缀提取 (n./v./adj./adv./int./num. 等)
	pos, translation := parsePosAndTranslation(w.Chinese)

	// Translation 存为 JSON 数组
	translationJSON := "[]"
	if translation != "" {
		b, _ := json.Marshal([]string{translation})
		translationJSON = string(b)
	}

	// 音频 URL: UK;US 分号分隔
	audioURL := buildAudioURL(w.English, audioURLs, store)

	return models.Word{
		WordBookID:    bookID,
		Word:          strings.TrimSpace(w.English),
		Phonetic:      phonetic,
		PhoneticUK:    phonetic,
		PhoneticUS:    phonetic,
		Translation:   translationJSON,
		PartOfSpeech:  pos,
		Difficulty:    1,
		SortOrder:     sortOrder,
		AudioURL:      audioURL,
		Tags:          "[]",
	}
}

// cleanPhonetic 清理 ddjdc 音标格式
// [hə‧ˈləʊ] -> /həˈləʊ/
func cleanPhonetic(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "[")
	s = strings.TrimSuffix(s, "]")
	// 去除 ddjdc 的音节分隔符 ‧
	s = strings.ReplaceAll(s, "‧", "")
	if s == "" {
		return ""
	}
	return "/" + s + "/"
}

// parsePosAndTranslation 从中文释义中提取词性和翻译
// "n.铅笔" -> ("noun", "铅笔")
// "int.你好" -> ("interjection", "你好")
// "v.（注意地）听" -> ("verb", "（注意地）听")
func parsePosAndTranslation(chinese string) (pos, translation string) {
	chinese = strings.TrimSpace(chinese)
	if chinese == "" {
		return "", ""
	}

	// 常见词性前缀映射
	prefixMap := map[string]string{
		"n.":    models.PartOfSpeechNoun,
		"v.":    models.PartOfSpeechVerb,
		"adj.":  models.PartOfSpeechAdjective,
		"adv.":  models.PartOfSpeechAdverb,
		"pron.": models.PartOfSpeechPronoun,
		"prep.": models.PartOfSpeechPreposition,
		"conj.": models.PartOfSpeechConjunction,
		"int.":  models.PartOfSpeechInterjection,
		"num.":  "numeral",
		"art.":  "article",
	}

	lower := strings.ToLower(chinese)
	for prefix, posVal := range prefixMap {
		if strings.HasPrefix(lower, prefix) {
			return posVal, strings.TrimSpace(chinese[len(prefix):])
		}
	}

	// 没有词性前缀，整个作为翻译
	return "", chinese
}

// buildAudioURL 构建音频 URL（分号分隔 UK;US）
func buildAudioURL(word string, audioURLs map[string]audioURLPair, store stores.Store) string {
	// 先精确匹配
	if pair, ok := audioURLs[word]; ok {
		return joinAudioURLs(pair, store)
	}
	// 尝试小写匹配
	if pair, ok := audioURLs[strings.ToLower(word)]; ok {
		return joinAudioURLs(pair, store)
	}
	return ""
}

func joinAudioURLs(pair audioURLPair, store stores.Store) string {
	var urls []string
	if pair.uk != "" {
		urls = append(urls, store.PublicURL(pair.uk))
	}
	if pair.us != "" {
		usURL := store.PublicURL(pair.us)
		if len(urls) == 0 {
			urls = append(urls, usURL)
		} else if audio.DedupKey(urls[0]) != audio.DedupKey(usURL) {
			urls = append(urls, usURL)
		}
	}
	return strings.Join(urls, ";")
}

// ----- 工具函数 -----

func loadAudioMap(dataDir string) (*audioMap, error) {
	path := filepath.Join(dataDir, "word_audio_map.json")
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("打开 word_audio_map.json: %w", err)
	}
	defer f.Close()

	var am audioMap
	dec := json.NewDecoder(f)
	if err := dec.Decode(&am); err != nil {
		return nil, fmt.Errorf("解析 word_audio_map.json: %w", err)
	}
	return &am, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// dbRetry 对数据库操作进行重试（应对连接超时等问题）
// 注意：gorm.ErrRecordNotFound 不重试（它是正常的"未找到"结果）
func dbRetry(maxAttempts int, fn func() error) error {
	var lastErr error
	for i := 0; i < maxAttempts; i++ {
		if err := fn(); err == nil {
			return nil
		} else {
			lastErr = err
			// gorm.ErrRecordNotFound 是正常结果，不重试
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			log.Printf("  [DB RETRY %d/%d] %v", i+1, maxAttempts, err)
			time.Sleep(time.Duration(i+1) * 2 * time.Second)
		}
	}
	return lastErr
}

// 确保 time 包被引用
var _ = time.Second
