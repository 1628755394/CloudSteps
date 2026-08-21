// 列举 tts/ 前缀下对象，与数据库 audio_url 引用对比，删除未被引用的孤儿文件。
//
//	go run ./cmd/purge-orphan-tts --dry-run
//	go run ./cmd/purge-orphan-tts --execute --delete-limit=20000
//	go run ./cmd/purge-orphan-tts --execute --skip-list --delete-limit=20000
//	go run ./cmd/purge-orphan-tts --execute --skip-scan --delete-limit=20000
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

	"github.com/LingByte/CloudStepsGo/pkg/audio"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	"github.com/LingByte/ling-base/common"
	lbstores "github.com/LingByte/ling-base/stores"
	"gorm.io/gorm"
)

const defaultPrefix = "tts/"

func main() {
	dryRun := flag.Bool("dry-run", true, "仅预览，不删对象")
	execute := flag.Bool("execute", false, "删除未被数据库引用的 tts/ 对象")
	skipList := flag.Bool("skip-list", false, "跳过列举与对账，只删 orphans.txt 中尚未删除的 key")
	skipScan := flag.Bool("skip-scan", false, "跳过扫库，使用 referenced.txt 与 orphans.txt")
	prefix := flag.String("prefix", defaultPrefix, "对象存储前缀")
	scanBatch := flag.Int("scan-batch", 5000, "扫库批次大小")
	deleteWorkers := flag.Int("delete-workers", 16, "并发删对象 worker 数")
	deleteLimit := flag.Int("delete-limit", 20000, "本轮最多删除的对象数")
	stateDir := flag.String("state-dir", ".purge-orphan-tts", "断点状态目录")
	dsnOverride := flag.String("dsn", "", "可选：覆盖 .env 中的 DSN")
	flag.Parse()

	if *execute {
		*dryRun = false
	}
	if !*dryRun && !*execute {
		log.Fatal("请显式指定 --execute 才会删除；预览请用 --dry-run")
	}
	if *deleteLimit < 1 {
		*deleteLimit = 20000
	}
	if *deleteWorkers < 1 {
		*deleteWorkers = 1
	}
	if *scanBatch < 100 {
		*scanBatch = 100
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

	referencedPath := filepath.Join(*stateDir, "referenced.txt")
	orphansPath := filepath.Join(*stateDir, "orphans.txt")
	donePath := filepath.Join(*stateDir, "deleted.txt")

	fmt.Printf("STORAGE_KIND=%s prefix=%q\n", stores.DefaultStoreKind, keyPrefix)

	var referenced map[string]struct{}
	var orphans []string

	if *skipList {
		var err error
		orphans, err = loadLines(orphansPath)
		if err != nil {
			log.Fatalf("load orphans: %v", err)
		}
		fmt.Printf("skip-list: loaded %s (%d keys)\n", orphansPath, len(orphans))
	} else {
		if *skipScan {
			var err error
			referenced, err = loadSet(referencedPath)
			if err != nil {
				log.Fatalf("load referenced: %v", err)
			}
			orphans, err = loadLines(orphansPath)
			if err != nil {
				log.Fatalf("load orphans: %v", err)
			}
			fmt.Printf("skip-scan: referenced=%d orphans=%d\n", len(referenced), len(orphans))
		} else {
			db, err := common.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, ensureMySQLTimeouts(dsn, 30*time.Minute))
			if err != nil {
				log.Fatal(err)
			}
			tunePool(db, *deleteWorkers)

			referenced, err = collectReferencedKeys(db, keyPrefix, *scanBatch)
			if err != nil {
				log.Fatal(err)
			}
			fmt.Printf("referenced_keys=%d\n", len(referenced))
			if err := writeSet(referencedPath, referenced); err != nil {
				log.Fatalf("write referenced: %v", err)
			}
			fmt.Printf("wrote %s\n", referencedPath)

			allKeys, err := listObjectKeys(keyPrefix)
			if err != nil {
				log.Fatal(err)
			}
			fmt.Printf("listed_objects=%d\n", len(allKeys))

			orphans = make([]string, 0)
			for _, key := range allKeys {
				if _, ok := referenced[key]; !ok {
					orphans = append(orphans, key)
				}
			}
			sort.Strings(orphans)
			fmt.Printf("orphan_keys=%d\n", len(orphans))
			if len(orphans) > 0 {
				show := min(8, len(orphans))
				fmt.Println("orphan samples:")
				for i := 0; i < show; i++ {
					fmt.Printf("  %s\n", orphans[i])
				}
			}
			if err := writeLines(orphansPath, orphans); err != nil {
				log.Fatalf("write orphans: %v", err)
			}
			fmt.Printf("wrote %s\n", orphansPath)
		}
	}

	if *dryRun {
		fmt.Printf("【预览】确认后: go run ./cmd/purge-orphan-tts --execute --skip-list --delete-limit=%d\n", *deleteLimit)
		if !*skipList && !*skipScan {
			fmt.Printf("或: go run ./cmd/purge-orphan-tts --execute --delete-limit=%d\n", *deleteLimit)
		}
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
	if len(batch) == 0 {
		fmt.Println("tts/ 孤儿文件已删完")
		return
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
		fmt.Printf("下一批: go run ./cmd/purge-orphan-tts --execute --skip-list --delete-limit=%d\n", *deleteLimit)
	} else {
		fmt.Println("tts/ 孤儿文件已删完")
	}
}

func collectReferencedKeys(db *gorm.DB, prefix string, batch int) (map[string]struct{}, error) {
	out := map[string]struct{}{}
	tables := []string{"words", "vocab_test_questions"}
	for _, table := range tables {
		if err := scanTableRefs(db, table, prefix, batch, out); err != nil {
			return nil, fmt.Errorf("%s: %w", table, err)
		}
	}
	return out, nil
}

func scanTableRefs(db *gorm.DB, table, prefix string, batch int, out map[string]struct{}) error {
	type row struct {
		ID       uint   `gorm:"column:id"`
		AudioURL string `gorm:"column:audio_url"`
	}
	var rows []row
	like := "%" + strings.TrimSuffix(prefix, "/") + "%"
	return db.Table(table).
		Select("id, audio_url").
		Where("audio_url IS NOT NULL AND TRIM(audio_url) <> ''").
		Where("audio_url LIKE ?", like).
		FindInBatches(&rows, batch, func(tx *gorm.DB, _ int) error {
			for _, r := range rows {
				audio.EachSlot(r.AudioURL, func(u string) {
					key := stores.RecordingObjectKeyFromURL(u)
					if key != "" && strings.HasPrefix(key, prefix) {
						out[key] = struct{}{}
					}
				})
			}
			return nil
		}).Error
}

func listObjectKeys(prefix string) ([]string, error) {
	m := stores.DefaultManager()
	if m != nil {
		return listAllObjectKeys(m, stores.DefaultBucketName(), prefix)
	}
	if stores.DefaultStoreKind == stores.KindLocal {
		return listLocalObjectKeys(prefix)
	}
	return nil, fmt.Errorf("当前 STORAGE_KIND=%q 不支持列举前缀", stores.DefaultStoreKind)
}

func listAllObjectKeys(m stores.ObjectStorageManager, bucket, prefix string) ([]string, error) {
	var keys []string
	marker := ""
	page := 0
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
		page++
		if page%100 == 0 {
			fmt.Printf("list progress keys=%d\n", len(keys))
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

func writeSet(path string, set map[string]struct{}) error {
	lines := make([]string, 0, len(set))
	for k := range set {
		lines = append(lines, k)
	}
	sort.Strings(lines)
	return writeLines(path, lines)
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
	lines, err := loadLines(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]struct{}{}, nil
		}
		return nil, err
	}
	out := make(map[string]struct{}, len(lines))
	for _, line := range lines {
		out[line] = struct{}{}
	}
	return out, nil
}

func tunePool(db *gorm.DB, deleteWorkers int) {
	sqlDB, err := db.DB()
	if err != nil {
		return
	}
	max := deleteWorkers + 8
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
