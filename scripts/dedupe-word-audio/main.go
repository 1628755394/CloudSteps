// 同一拼写的单词发音槽（audio_url 第 1、2 段）合并为同一对象，再删除不再被引用的存储 key。
// 第 3 段及之后通常带中文释义，按行保留。
//
//	go run ./cmd/dedupe-word-audio --dry-run
//	go run ./cmd/dedupe-word-audio --execute --delete-limit=20000
package main

import (
	"bufio"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
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

type wordAudio struct {
	ID       uint   `gorm:"column:id"`
	Word     string `gorm:"column:word"`
	AudioURL string `gorm:"column:audio_url"`
}

func (wordAudio) TableName() string { return "words" }

type canonSlots struct {
	slot0, slot1 string
}

type patch struct {
	id  uint
	url string
}

func main() {
	dryRun := flag.Bool("dry-run", true, "仅统计，不写库、不删对象")
	execute := flag.Bool("execute", false, "改写 audio_url 并删除未引用对象")
	skipDelete := flag.Bool("skip-delete", false, "只改库、不删对象存储")
	skipRewrite := flag.Bool("skip-rewrite", false, "跳过改库，只删本批孤儿对象")
	batchSize := flag.Int("batch", 5000, "扫描批次大小")
	rewriteBatch := flag.Int("rewrite-batch", 2000, "每条 UPDATE … CASE 语句最多改多少行")
	rewriteWorkers := flag.Int("rewrite-workers", 4, "并发改库 worker 数")
	deleteWorkers := flag.Int("delete-workers", 16, "并发删对象 worker 数")
	deleteLimit := flag.Int("delete-limit", 20000, "本轮最多删除的对象数")
	stateDir := flag.String("state-dir", ".dedupe-word-audio", "断点状态目录")
	dsnOverride := flag.String("dsn", "", "可选：覆盖 .env 中的 DSN")
	flag.Parse()
	if *execute {
		*dryRun = false
	}
	if !*dryRun && !*execute {
		log.Fatal("请显式指定 --execute 才会写入；预览请用 --dry-run")
	}
	if *deleteLimit < 1 {
		*deleteLimit = 20000
	}
	if *rewriteBatch < 100 {
		*rewriteBatch = 100
	}
	if *rewriteWorkers < 1 {
		*rewriteWorkers = 1
	}
	if *deleteWorkers < 1 {
		*deleteWorkers = 1
	}

	if err := config.Load(); err != nil {
		log.Fatal(err)
	}
	dsn := config.GlobalConfig.Database.DSN
	if strings.TrimSpace(*dsnOverride) != "" {
		dsn = strings.TrimSpace(*dsnOverride)
	}
	dsn = ensureMySQLTimeouts(dsn, 30*time.Minute)
	db, err := common.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, dsn)
	if err != nil {
		log.Fatal(err)
	}
	tunePool(db, *rewriteWorkers, *deleteWorkers)

	if err := os.MkdirAll(*stateDir, 0o755); err != nil {
		log.Fatal(err)
	}
	orphanPath := filepath.Join(*stateDir, "orphans.txt")
	donePath := filepath.Join(*stateDir, "deleted.txt")

	var orphans []string
	var patches []patch
	rowsScanned := 0

	if *skipRewrite {
		var err error
		orphans, err = loadLines(orphanPath)
		if err != nil {
			log.Fatalf("load orphans: %v", err)
		}
		fmt.Printf("skip-rewrite: loaded %s (%d keys)\n", orphanPath, len(orphans))
	} else {
		canon := map[string]*canonSlots{}
		beforeKeys := map[string]struct{}{}
		if err := scanWordAudio(db, *batchSize, func(row wordAudio) {
			rowsScanned++
			if rowsScanned%100000 == 0 {
				fmt.Printf("scan1 rows=%d\n", rowsScanned)
			}
			audio.EachSlot(row.AudioURL, func(u string) {
				if k := stores.RecordingObjectKeyFromURL(u); k != "" {
					beforeKeys[k] = struct{}{}
				}
			})
			key := strings.ToLower(strings.TrimSpace(row.Word))
			if key == "" {
				return
			}
			parts := audio.SplitSlots(row.AudioURL)
			c := canon[key]
			if c == nil {
				c = &canonSlots{}
				canon[key] = c
			}
			if c.slot0 == "" && len(parts) > 0 {
				c.slot0 = strings.TrimSpace(parts[0])
			}
			if c.slot1 == "" && len(parts) > 1 {
				c.slot1 = strings.TrimSpace(parts[1])
			}
		}); err != nil {
			log.Fatal(err)
		}

		afterKeys := map[string]struct{}{}
		rowsScanned = 0
		if err := scanWordAudio(db, *batchSize, func(row wordAudio) {
			rowsScanned++
			if rowsScanned%100000 == 0 {
				fmt.Printf("scan2 rows=%d patches=%d\n", rowsScanned, len(patches))
			}
			key := strings.ToLower(strings.TrimSpace(row.Word))
			c := canon[key]
			newURL := row.AudioURL
			if c != nil {
				newURL = audio.RewritePronunciationSlots(row.AudioURL, c.slot0, c.slot1)
			}
			if newURL != row.AudioURL {
				patches = append(patches, patch{id: row.ID, url: newURL})
			}
			audio.EachSlot(newURL, func(u string) {
				if k := stores.RecordingObjectKeyFromURL(u); k != "" {
					afterKeys[k] = struct{}{}
				}
			})
		}); err != nil {
			log.Fatal(err)
		}

		orphans = make([]string, 0)
		for k := range beforeKeys {
			if _, ok := afterKeys[k]; !ok {
				orphans = append(orphans, k)
			}
		}
		sort.Strings(orphans)

		fmt.Printf("scanned_rows=%d spellings=%d rows_to_rewrite=%d keys_before=%d keys_after=%d orphan_keys=%d delete_limit=%d\n",
			rowsScanned, len(canon), len(patches), len(beforeKeys), len(afterKeys), len(orphans), *deleteLimit)
		show := 8
		if len(patches) < show {
			show = len(patches)
		}
		for i := 0; i < show; i++ {
			fmt.Printf("  rewrite id=%d\n", patches[i].id)
		}
		if len(orphans) > 0 {
			n := 8
			if len(orphans) < n {
				n = len(orphans)
			}
			fmt.Println("orphan key samples:")
			for i := 0; i < n; i++ {
				fmt.Printf("  %s\n", orphans[i])
			}
		}

		if err := writeLines(orphanPath, orphans); err != nil {
			log.Fatalf("write orphans: %v", err)
		}
		fmt.Printf("wrote %s (%d keys)\n", orphanPath, len(orphans))
	}

	if *dryRun {
		fmt.Printf("【预览】确认后: go run ./cmd/dedupe-word-audio --execute --delete-limit=%d\n", *deleteLimit)
		return
	}

	if !*skipRewrite && len(patches) > 0 {
		fmt.Printf("rewrite bulk_batch=%d workers=%d\n", *rewriteBatch, *rewriteWorkers)
		updated, err := applyPatchesParallel(db, patches, *rewriteBatch, *rewriteWorkers)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("updated_rows=%d\n", updated)
	} else if *skipRewrite {
		fmt.Println("skip-rewrite: 未改 audio_url")
	}

	if *skipDelete {
		fmt.Println("skip-delete: 未调用对象存储 Delete")
		return
	}

	already, err := loadSet(donePath)
	if err != nil {
		log.Fatalf("load deleted state: %v", err)
	}
	pending := make([]string, 0, len(orphans))
	for _, key := range orphans {
		if _, ok := already[key]; !ok {
			pending = append(pending, key)
		}
	}
	fmt.Printf("object_delete remaining=%d already_deleted=%d this_batch=%d\n",
		len(pending), len(already), min(len(pending), *deleteLimit))

	batch := pending
	if len(batch) > *deleteLimit {
		batch = batch[:*deleteLimit]
	}

	doneFile, err := os.OpenFile(donePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		log.Fatal(err)
	}
	defer doneFile.Close()

	fmt.Printf("object_delete workers=%d\n", *deleteWorkers)
	attempted, failed := deleteObjectsParallel(batch, *deleteWorkers, doneFile)
	remaining := len(pending) - (attempted - failed)
	if remaining < 0 {
		remaining = 0
	}
	fmt.Printf("object_delete attempted=%d failed=%d remaining_after=%d\n", attempted, failed, remaining)
	if remaining > 0 {
		fmt.Printf("下一批: go run ./cmd/dedupe-word-audio --execute --skip-rewrite --delete-limit=%d\n", *deleteLimit)
	} else {
		fmt.Println("对象存储孤儿文件已删完")
	}
}

func applyPatchesParallel(db *gorm.DB, patches []patch, batchSize, workers int) (int, error) {
	total := len(patches)
	if total == 0 {
		return 0, nil
	}
	type job struct {
		start, end int
	}
	jobs := make(chan job, (total+batchSize-1)/batchSize)
	var wg sync.WaitGroup
	var updated atomic.Int64
	var logMu sync.Mutex
	var lastLogged int64
	errCh := make(chan error, workers)

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobs {
				if err := bulkUpdatePatches(db, patches[j.start:j.end]); err != nil {
					errCh <- fmt.Errorf("update batch %d-%d: %w", j.start, j.end, err)
					return
				}
				n := updated.Add(int64(j.end - j.start))
				logMu.Lock()
				if n-int64(total) == 0 || n-lastLogged >= 50000 {
					fmt.Printf("updated %d/%d\n", n, total)
					lastLogged = n
				}
				logMu.Unlock()
			}
		}()
	}
	for i := 0; i < total; i += batchSize {
		end := i + batchSize
		if end > total {
			end = total
		}
		jobs <- job{start: i, end: end}
	}
	close(jobs)
	wg.Wait()
	close(errCh)
	for err := range errCh {
		if err != nil {
			return int(updated.Load()), err
		}
	}
	return int(updated.Load()), nil
}

func bulkUpdatePatches(db *gorm.DB, batch []patch) error {
	if len(batch) == 0 {
		return nil
	}
	query, args := buildBulkAudioURLUpdate(batch)
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt*attempt) * time.Second)
		}
		err := db.Exec(query, args...).Error
		if err == nil {
			return nil
		}
		lastErr = err
		if !isRetryableDBErr(err) {
			return err
		}
	}
	return lastErr
}

func isDeleteNotFound(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "no such file") ||
		strings.Contains(msg, "not found") ||
		strings.Contains(msg, "nosuchkey") ||
		strings.Contains(msg, "404")
}

func isRetryableDBErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "invalid connection") ||
		strings.Contains(msg, "connection reset") ||
		strings.Contains(msg, "broken pipe") ||
		strings.Contains(msg, "bad connection") ||
		strings.Contains(msg, "timeout") ||
		strings.Contains(msg, "gone away")
}

func buildBulkAudioURLUpdate(batch []patch) (string, []any) {
	var b strings.Builder
	b.Grow(len(batch) * 48)
	b.WriteString("UPDATE words SET audio_url = CASE id ")
	args := make([]any, 0, len(batch)*3)
	for _, p := range batch {
		b.WriteString("WHEN ? THEN ? ")
		args = append(args, p.id, p.url)
	}
	b.WriteString("END WHERE id IN (")
	for i, p := range batch {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteByte('?')
		args = append(args, p.id)
	}
	b.WriteByte(')')
	return b.String(), args
}

func deleteObjectsParallel(keys []string, workers int, doneFile *os.File) (attempted, failed int) {
	if len(keys) == 0 {
		return 0, 0
	}
	type result struct {
		key     string
		delErr  error
		writeErr error
	}
	jobs := make(chan string, len(keys))
	results := make(chan result, len(keys))
	var wg sync.WaitGroup
	var failLogged atomic.Int32

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for key := range jobs {
				err := stores.Default().Delete(key)
				if isDeleteNotFound(err) {
					err = nil
				}
				results <- result{key: key, delErr: err}
			}
		}()
	}
	for _, key := range keys {
		jobs <- key
	}
	close(jobs)
	wg.Wait()
	close(results)

	var mu sync.Mutex
	done := 0
	for r := range results {
		attempted++
		if r.delErr != nil {
			failed++
			if failLogged.Add(1) <= 20 {
				log.Printf("delete %s: %v", r.key, r.delErr)
			}
			continue
		}
		mu.Lock()
		_, werr := io.WriteString(doneFile, r.key+"\n")
		mu.Unlock()
		if werr != nil {
			log.Fatalf("record deleted key: %v", werr)
		}
		done++
		if done%500 == 0 {
			fmt.Printf("deleted %d/%d (failed=%d)\n", done, len(keys), failed)
		}
	}
	return attempted, failed
}

func scanWordAudio(db *gorm.DB, batch int, fn func(wordAudio)) error {
	if batch < 100 {
		batch = 100
	}
	var rows []wordAudio
	batchNum := 0
	return db.Model(&wordAudio{}).
		Select("id, word, audio_url").
		Where("is_deleted = ? AND audio_url IS NOT NULL AND TRIM(audio_url) <> ''", models.SoftDeleteStatusActive).
		Order("id ASC").
		FindInBatches(&rows, batch, func(tx *gorm.DB, _ int) error {
			batchNum++
			if batchNum%50 == 0 {
				if sqlDB, err := tx.DB(); err == nil {
					_ = sqlDB.Ping()
				}
			}
			for _, row := range rows {
				fn(row)
			}
			return nil
		}).Error
}

func writeLines(path string, lines []string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	for _, line := range lines {
		if _, err := w.WriteString(line + "\n"); err != nil {
			return err
		}
	}
	return w.Flush()
}

func loadLines(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var out []string
	s := bufio.NewScanner(f)
	s.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if line == "" {
			continue
		}
		out = append(out, line)
	}
	return out, s.Err()
}

func loadSet(path string) (map[string]struct{}, error) {
	out := map[string]struct{}{}
	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return out, nil
	}
	if err != nil {
		return nil, err
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	s.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if line == "" {
			continue
		}
		out[line] = struct{}{}
	}
	return out, s.Err()
}

func tunePool(db *gorm.DB, rewriteWorkers, deleteWorkers int) {
	sqlDB, err := db.DB()
	if err != nil {
		return
	}
	max := rewriteWorkers + deleteWorkers + 4
	if max < 12 {
		max = 12
	}
	if max > 32 {
		max = 32
	}
	sqlDB.SetConnMaxLifetime(0)
	sqlDB.SetMaxIdleConns(max)
	sqlDB.SetMaxOpenConns(max)
}

func ensureMySQLTimeouts(dsn string, read time.Duration) string {
	if dsn == "" || !strings.Contains(dsn, "@tcp(") {
		return dsn
	}
	if strings.Contains(dsn, "readTimeout=") {
		return dsn
	}
	sec := int(read.Seconds())
	if sec < 60 {
		sec = 60
	}
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	return dsn + fmt.Sprintf("%sreadTimeout=%ds&writeTimeout=%ds&timeout=30s", sep, sec, sec)
}
