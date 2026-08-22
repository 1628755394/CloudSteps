// 删除 ddjdc 导入的 audio/words/ 对象，并清理 words / vocab_test_questions 中对应 audio_url 槽位。
//
//	go run ./cmd/purge-ddjdc-audio --dry-run
//	go run ./cmd/purge-ddjdc-audio --execute
//	go run ./cmd/purge-ddjdc-audio --execute --skip-db
//	go run ./cmd/purge-ddjdc-audio --execute --skip-delete
//	go run ./cmd/purge-ddjdc-audio --execute --skip-list --delete-limit=20000
package main

import (
	"bufio"
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

	"github.com/LingByte/CloudStepsGo/pkg/audio"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	"github.com/LingByte/ling-base/common"
	lbstores "github.com/LingByte/ling-base/stores"
	"gorm.io/gorm"
)

const defaultPrefix = "audio/words/"

type audioPatch struct {
	table string
	id    uint
	url   string
}

func main() {
	dryRun := flag.Bool("dry-run", true, "仅预览，不写库、不删对象")
	execute := flag.Bool("execute", false, "清理 audio_url 并删除对象")
	skipDelete := flag.Bool("skip-delete", false, "只改库、不删对象")
	skipDB := flag.Bool("skip-db", false, "只删对象、不改库")
	skipList := flag.Bool("skip-list", false, "跳过列举，只删 keys.txt 中尚未删除的 key")
	prefix := flag.String("prefix", defaultPrefix, "对象存储前缀")
	dbBatch := flag.Int("db-batch", 2000, "每条 UPDATE … CASE 最多改多少行")
	dbWorkers := flag.Int("db-workers", 4, "并发改库 worker 数")
	deleteWorkers := flag.Int("delete-workers", 16, "并发删对象 worker 数")
	deleteLimit := flag.Int("delete-limit", 20000, "本轮最多删除的对象数")
	stateDir := flag.String("state-dir", ".purge-ddjdc-audio", "断点状态目录")
	dsnOverride := flag.String("dsn", "", "可选：覆盖 .env 中的 DSN")
	flag.Parse()

	if *execute {
		*dryRun = false
	}
	if !*dryRun && !*execute {
		log.Fatal("请显式指定 --execute 才会执行；预览请用 --dry-run")
	}
	if *deleteLimit < 1 {
		*deleteLimit = 20000
	}
	if *dbBatch < 100 {
		*dbBatch = 100
	}
	if *dbWorkers < 1 {
		*dbWorkers = 1
	}
	if *deleteWorkers < 1 {
		*deleteWorkers = 1
	}

	keyPrefix := strings.TrimSpace(*prefix)
	if keyPrefix == "" {
		keyPrefix = defaultPrefix
	}
	if !strings.HasSuffix(keyPrefix, "/") {
		keyPrefix += "/"
	}

	if err := config.Load(); err != nil {
		log.Fatal(err)
	}
	dsn := config.GlobalConfig.Database.DSN
	if strings.TrimSpace(*dsnOverride) != "" {
		dsn = strings.TrimSpace(*dsnOverride)
	}

	if err := os.MkdirAll(*stateDir, 0o755); err != nil {
		log.Fatal(err)
	}
	keysPath := filepath.Join(*stateDir, "keys.txt")
	donePath := filepath.Join(*stateDir, "deleted.txt")

	fmt.Printf("STORAGE_KIND=%s prefix=%q\n", stores.DefaultStoreKind, keyPrefix)

	var db *gorm.DB
	if !*skipDB {
		var err error
		db, err = common.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, ensureMySQLTimeouts(dsn, 30*time.Minute))
		if err != nil {
			log.Fatal(err)
		}
		tunePool(db, *dbWorkers, *deleteWorkers)
	}

	var patches []audioPatch
	if db != nil {
		var err error
		patches, err = collectPatches(db, keyPrefix)
		if err != nil {
			log.Fatal(err)
		}
		wordRows := 0
		vocabRows := 0
		for _, p := range patches {
			switch p.table {
			case "words":
				wordRows++
			case "vocab_test_questions":
				vocabRows++
			}
		}
		fmt.Printf("db_rows_to_update words=%d vocab_test_questions=%d total=%d\n", wordRows, vocabRows, len(patches))
		if len(patches) > 0 {
			show := min(5, len(patches))
			fmt.Println("db patch samples:")
			for i := 0; i < show; i++ {
				p := patches[i]
				fmt.Printf("  %s id=%d -> %q\n", p.table, p.id, p.url)
			}
		}
	}

	var keys []string
	if !*skipList {
		var err error
		keys, err = listObjectKeys(keyPrefix)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("listed_objects=%d\n", len(keys))
		if len(keys) > 0 {
			show := min(8, len(keys))
			fmt.Println("object samples:")
			for i := 0; i < show; i++ {
				fmt.Printf("  %s\n", keys[i])
			}
		}
		if err := writeLines(keysPath, keys); err != nil {
			log.Fatalf("write keys: %v", err)
		}
		fmt.Printf("wrote %s\n", keysPath)
	} else {
		var err error
		keys, err = loadLines(keysPath)
		if err != nil {
			log.Fatalf("load keys: %v", err)
		}
		fmt.Printf("skip-list: loaded %s (%d keys)\n", keysPath, len(keys))
	}

	if *dryRun {
		fmt.Println("【预览】确认后:")
		if !*skipDB && len(patches) > 0 {
			fmt.Println("  go run ./cmd/purge-ddjdc-audio --execute --skip-delete   # 仅改库")
		}
		if !*skipDelete && len(keys) > 0 {
			fmt.Printf("  go run ./cmd/purge-ddjdc-audio --execute --skip-db --delete-limit=%d\n", *deleteLimit)
			fmt.Printf("  go run ./cmd/purge-ddjdc-audio --execute --skip-list --delete-limit=%d\n", *deleteLimit)
		}
		if !*skipDB && !*skipDelete {
			fmt.Printf("  go run ./cmd/purge-ddjdc-audio --execute --delete-limit=%d\n", *deleteLimit)
		}
		return
	}

	if !*skipDB && len(patches) > 0 {
		fmt.Printf("db rewrite batch=%d workers=%d\n", *dbBatch, *dbWorkers)
		updated, err := applyPatchesParallel(db, patches, *dbBatch, *dbWorkers)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("db_updated_rows=%d\n", updated)
	} else if *skipDB {
		fmt.Println("skip-db: 未改 audio_url")
	} else {
		fmt.Println("db: 无需更新")
	}

	if *skipDelete {
		fmt.Println("skip-delete: 未调用对象存储 Delete")
		return
	}

	already, err := loadSet(donePath)
	if err != nil {
		log.Fatalf("load deleted state: %v", err)
	}
	pending := make([]string, 0, len(keys))
	for _, key := range keys {
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
		fmt.Printf("下一批: go run ./cmd/purge-ddjdc-audio --execute --skip-db --skip-list --delete-limit=%d\n", *deleteLimit)
	} else {
		fmt.Println("audio/words/ 对象已删完")
	}
}

func collectPatches(db *gorm.DB, prefix string) ([]audioPatch, error) {
	out := make([]audioPatch, 0)
	if err := scanTableAudio(db, "words", prefix, func(id uint, raw string) {
		if next, ok := stripPrefixSlots(raw, prefix); ok {
			out = append(out, audioPatch{table: "words", id: id, url: next})
		}
	}); err != nil {
		return nil, err
	}
	if err := scanTableAudio(db, "vocab_test_questions", prefix, func(id uint, raw string) {
		if next, ok := stripPrefixSlots(raw, prefix); ok {
			out = append(out, audioPatch{table: "vocab_test_questions", id: id, url: next})
		}
	}); err != nil {
		return nil, err
	}
	return out, nil
}

func scanTableAudio(db *gorm.DB, table string, prefix string, fn func(id uint, raw string)) error {
	type row struct {
		ID       uint   `gorm:"column:id"`
		AudioURL string `gorm:"column:audio_url"`
	}
	var rows []row
	return db.Table(table).
		Select("id, audio_url").
		Where("audio_url IS NOT NULL AND TRIM(audio_url) <> ''").
		Where("audio_url LIKE ?", "%"+strings.TrimSuffix(prefix, "/")+"%").
		Order("id ASC").
		FindInBatches(&rows, 5000, func(tx *gorm.DB, _ int) error {
			for _, r := range rows {
				fn(r.ID, r.AudioURL)
			}
			return nil
		}).Error
}

func stripPrefixSlots(raw, prefix string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}
	parts := audio.SplitSlots(raw)
	if parts == nil {
		parts = []string{raw}
	}
	changed := false
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t == "" {
			out = append(out, "")
			continue
		}
		if isUnderPrefix(t, prefix) {
			changed = true
			out = append(out, "")
			continue
		}
		out = append(out, t)
	}
	for len(out) > 0 && strings.TrimSpace(out[len(out)-1]) == "" {
		out = out[:len(out)-1]
	}
	next := strings.Join(out, ";")
	if !changed {
		return raw, false
	}
	return next, true
}

func isUnderPrefix(raw, prefix string) bool {
	key := stores.RecordingObjectKeyFromURL(raw)
	if key != "" {
		return strings.HasPrefix(key, prefix)
	}
	lower := strings.ToLower(raw)
	return strings.Contains(lower, strings.ToLower(strings.TrimSuffix(prefix, "/")))
}

func listObjectKeys(prefix string) ([]string, error) {
	m := stores.DefaultManager()
	if m != nil {
		return listAllObjectKeys(m, stores.DefaultBucketName(), prefix)
	}
	if stores.DefaultStoreKind == stores.KindLocal {
		return listLocalObjectKeys(prefix)
	}
	return nil, fmt.Errorf("当前 STORAGE_KIND=%q 不支持列举前缀，请改用支持管理接口的后端", stores.DefaultStoreKind)
}

func listAllObjectKeys(m stores.ObjectStorageManager, bucket, prefix string) ([]string, error) {
	var keys []string
	marker := ""
	for {
		resp, err := m.ListFiles(bucket, &lbstores.ListFilesRequest{
			Prefix: prefix,
			Marker: marker,
			Limit:  1000,
		})
		if err != nil {
			return nil, err
		}
		for _, f := range resp.Files {
			if f.Key != "" {
				keys = append(keys, f.Key)
			}
		}
		if !resp.IsTruncated || resp.Marker == "" {
			break
		}
		marker = resp.Marker
	}
	return keys, nil
}

func listLocalObjectKeys(prefix string) ([]string, error) {
	root := strings.TrimSpace(os.Getenv("UPLOAD_DIR"))
	if root == "" {
		return nil, fmt.Errorf("local 存储未设置 UPLOAD_DIR")
	}
	base := filepath.Join(root, filepath.FromSlash(strings.TrimSuffix(prefix, "/")))
	info, err := os.Stat(base)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return []string{strings.TrimSuffix(prefix, "/")}, nil
	}
	var keys []string
	err = filepath.Walk(base, func(path string, fi os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if fi.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		keys = append(keys, filepath.ToSlash(rel))
		return nil
	})
	return keys, err
}

func applyPatchesParallel(db *gorm.DB, patches []audioPatch, batchSize, workers int) (int, error) {
	byTable := map[string][]audioPatch{}
	for _, p := range patches {
		byTable[p.table] = append(byTable[p.table], p)
	}
	totalUpdated := 0
	for table, batch := range byTable {
		n, err := applyTablePatchesParallel(db, table, batch, batchSize, workers)
		if err != nil {
			return totalUpdated, fmt.Errorf("%s: %w", table, err)
		}
		totalUpdated += n
	}
	return totalUpdated, nil
}

func applyTablePatchesParallel(db *gorm.DB, table string, patches []audioPatch, batchSize, workers int) (int, error) {
	total := len(patches)
	if total == 0 {
		return 0, nil
	}
	type job struct{ start, end int }
	jobs := make(chan job, (total+batchSize-1)/batchSize)
	var wg sync.WaitGroup
	var updated atomic.Int64
	errCh := make(chan error, workers)

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobs {
				if err := bulkUpdateAudioURL(db, table, patches[j.start:j.end]); err != nil {
					errCh <- err
					return
				}
				updated.Add(int64(j.end - j.start))
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

func bulkUpdateAudioURL(db *gorm.DB, table string, batch []audioPatch) error {
	if len(batch) == 0 {
		return nil
	}
	var b strings.Builder
	b.Grow(len(batch) * 48)
	b.WriteString("UPDATE ")
	b.WriteString(table)
	b.WriteString(" SET audio_url = CASE id ")
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
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt*attempt) * time.Second)
		}
		err := db.Exec(b.String(), args...).Error
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

func deleteObjectsParallel(keys []string, workers int, doneFile *os.File) (attempted, failed int) {
	if len(keys) == 0 {
		return 0, 0
	}
	type result struct {
		key    string
		delErr error
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
		if _, err := io.WriteString(doneFile, r.key+"\n"); err != nil {
			mu.Unlock()
			log.Fatalf("record deleted key: %v", err)
		}
		mu.Unlock()
		done++
		if done%500 == 0 {
			fmt.Printf("deleted %d/%d (failed=%d)\n", done, len(keys), failed)
		}
	}
	return attempted, failed
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

func tunePool(db *gorm.DB, dbWorkers, deleteWorkers int) {
	sqlDB, err := db.DB()
	if err != nil {
		return
	}
	max := dbWorkers + deleteWorkers + 4
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
