// 给缺少 audio_url 的活跃单词补音频：
//
//  1. 同拼写已有音频的，直接复用（不重新合成）
//
//  2. 整组都没有的，TTS 合成一次后写回所有缺音频行
//
//     go run ./cmd/fill-missing-word-audio --dry-run
//     go run ./cmd/fill-missing-word-audio --execute
//     go run ./cmd/fill-missing-word-audio --execute --copy-only
//     go run ./cmd/fill-missing-word-audio --execute --tts-limit=500
package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/audio"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	"github.com/LingByte/CloudStepsGo/pkg/synthesizer"
	"github.com/LingByte/ling-base/common"
	"gorm.io/gorm"
)

var posPrefixRe = regexp.MustCompile(`(?i)^[a-z]+\.\s+`)
var englishGlossRe = regexp.MustCompile(`(?i)[a-z][a-z\s\-']*`)

type wordRow struct {
	ID          uint   `gorm:"column:id"`
	Word        string `gorm:"column:word"`
	Translation string `gorm:"column:translation"`
	AudioURL    string `gorm:"column:audio_url"`
}

func (wordRow) TableName() string { return "words" }

type spellingGroup struct {
	word        string
	translation string
	donor       string
	emptyIDs    []uint
	allIDs      []uint
}

type patch struct {
	id  uint
	url string
}

func main() {
	dryRun := flag.Bool("dry-run", true, "仅统计，不写库、不合成")
	execute := flag.Bool("execute", false, "写库并合成缺失拼写")
	copyOnly := flag.Bool("copy-only", false, "只复用已有音频，不 TTS")
	skipCopy := flag.Bool("skip-copy", false, "跳过同拼写复用，只 TTS")
	ttsLimit := flag.Int("tts-limit", 0, "本轮最多合成多少个拼写（0=不限）")
	ttsWorkers := flag.Int("tts-workers", 4, "TTS 并发数")
	rewriteBatch := flag.Int("rewrite-batch", 2000, "每条 UPDATE … CASE 最多改多少行")
	scanBatch := flag.Int("scan-batch", 5000, "扫库批次大小")
	stateDir := flag.String("state-dir", ".fill-missing-word-audio", "TTS 断点目录")
	dsnOverride := flag.String("dsn", "", "可选：覆盖 .env 中的 DSN")
	flag.Parse()

	if *execute {
		*dryRun = false
	}
	if !*dryRun && !*execute {
		log.Fatal("请显式指定 --execute 才会写入；预览请用 --dry-run")
	}
	if *ttsWorkers < 1 {
		*ttsWorkers = 1
	}
	if *rewriteBatch < 100 {
		*rewriteBatch = 100
	}

	if err := config.Load(); err != nil {
		log.Fatal(err)
	}
	dsn := config.GlobalConfig.Database.DSN
	if strings.TrimSpace(*dsnOverride) != "" {
		dsn = strings.TrimSpace(*dsnOverride)
	}
	db, err := common.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, ensureMySQLTimeouts(dsn, 30*time.Minute))
	if err != nil {
		log.Fatal(err)
	}
	tunePool(db, *ttsWorkers)

	if err := os.MkdirAll(*stateDir, 0o755); err != nil {
		log.Fatal(err)
	}
	donePath := filepath.Join(*stateDir, "tts-done.txt")
	alreadyTTS, err := loadSet(donePath)
	if err != nil {
		log.Fatalf("load tts-done: %v", err)
	}

	groups := map[string]*spellingGroup{}
	active := 0
	withAudio := 0
	noAudio := 0
	if err := scanWords(db, *scanBatch, func(row wordRow) {
		active++
		key := strings.ToLower(strings.TrimSpace(row.Word))
		if key == "" {
			return
		}
		g := groups[key]
		if g == nil {
			g = &spellingGroup{word: strings.TrimSpace(row.Word)}
			groups[key] = g
		}
		if g.translation == "" {
			g.translation = row.Translation
		}
		g.allIDs = append(g.allIDs, row.ID)
		url := strings.TrimSpace(row.AudioURL)
		if url == "" {
			noAudio++
			g.emptyIDs = append(g.emptyIDs, row.ID)
			return
		}
		withAudio++
		if betterDonor(url, g.donor) {
			g.donor = url
		}
	}); err != nil {
		log.Fatal(err)
	}

	copyPatches := make([]patch, 0)
	needTTS := make([]*spellingGroup, 0)
	copySpellings := 0
	ttsRows := 0
	for _, g := range groups {
		if len(g.emptyIDs) == 0 {
			continue
		}
		if g.donor != "" {
			copySpellings++
			for _, id := range g.emptyIDs {
				copyPatches = append(copyPatches, patch{id: id, url: g.donor})
			}
			continue
		}
		needTTS = append(needTTS, g)
		ttsRows += len(g.emptyIDs)
	}

	if len(alreadyTTS) > 0 {
		filtered := make([]*spellingGroup, 0, len(needTTS))
		skipped := 0
		ttsRows = 0
		for _, g := range needTTS {
			key := strings.ToLower(strings.TrimSpace(g.word))
			if _, ok := alreadyTTS[key]; ok {
				skipped++
				continue
			}
			filtered = append(filtered, g)
			ttsRows += len(g.emptyIDs)
		}
		fmt.Printf("tts_checkpoint skipped_done=%d remaining=%d\n", skipped, len(filtered))
		needTTS = filtered
	}

	fmt.Printf("active_words=%d with_audio=%d no_audio=%d spellings=%d\n",
		active, withAudio, noAudio, len(groups))
	fmt.Printf("reuse_from_same_spelling rows=%d spellings=%d\n", len(copyPatches), copySpellings)
	fmt.Printf("need_tts spellings=%d rows=%d\n", len(needTTS), ttsRows)
	if len(needTTS) > 0 {
		show := min(8, len(needTTS))
		fmt.Println("tts samples:")
		for i := 0; i < show; i++ {
			g := needTTS[i]
			fmt.Printf("  %q empty_rows=%d\n", g.word, len(g.emptyIDs))
		}
	}

	if *dryRun {
		fmt.Println("【预览】确认后:")
		fmt.Println("  go run ./cmd/fill-missing-word-audio --execute --copy-only")
		fmt.Println("  go run ./cmd/fill-missing-word-audio --execute")
		if *ttsLimit > 0 {
			fmt.Printf("  go run ./cmd/fill-missing-word-audio --execute --tts-limit=%d\n", *ttsLimit)
		}
		return
	}

	updatedCopy := 0
	if !*skipCopy && len(copyPatches) > 0 {
		fmt.Printf("copy rewrite rows=%d\n", len(copyPatches))
		n, err := applyPatchesParallel(db, copyPatches, *rewriteBatch, 4)
		if err != nil {
			log.Fatal(err)
		}
		updatedCopy = n
		fmt.Printf("copied_rows=%d\n", updatedCopy)
	} else if *skipCopy {
		fmt.Println("skip-copy: 未复用已有音频")
	}

	if *copyOnly {
		fmt.Println("copy-only: 未调用 TTS")
		return
	}

	if *ttsLimit > 0 && len(needTTS) > *ttsLimit {
		needTTS = needTTS[:*ttsLimit]
	}
	if len(needTTS) == 0 {
		fmt.Println("无需 TTS")
		return
	}

	fmt.Printf("tts spellings=%d workers=%d\n", len(needTTS), *ttsWorkers)
	doneFile, err := os.OpenFile(donePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		log.Fatal(err)
	}
	defer doneFile.Close()
	synthOK, synthFail, updated := synthesizeGroups(db, needTTS, *ttsWorkers, doneFile)
	fmt.Printf("tts_ok=%d tts_fail=%d tts_updated_rows=%d\n", synthOK, synthFail, updated)
}

func betterDonor(candidate, current string) bool {
	if current == "" {
		return true
	}
	return slotCount(candidate) > slotCount(current)
}

func slotCount(raw string) int {
	n := 0
	audio.EachSlot(raw, func(string) { n++ })
	return n
}

func synthesizeGroups(db *gorm.DB, groups []*spellingGroup, workers int, doneFile *os.File) (ok, fail, updated int) {
	type result struct {
		g   *spellingGroup
		url string
		err error
	}
	jobs := make(chan *spellingGroup, workers*8)
	out := make(chan result, workers*8)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for g := range jobs {
				ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
				url, err := synthesizeWordAudio(ctx, g.word, g.translation)
				cancel()
				out <- result{g: g, url: url, err: err}
			}
		}()
	}
	go func() {
		for _, g := range groups {
			jobs <- g
		}
		close(jobs)
	}()
	go func() {
		wg.Wait()
		close(out)
	}()

	done := 0
	total := len(groups)
	var failLogged atomic.Int32
	for r := range out {
		done++
		if r.err != nil {
			fail++
			if failLogged.Add(1) <= 20 {
				log.Printf("tts %q: %v", r.g.word, r.err)
			}
		} else {
			url := audio.DeduplicateSlots(r.url)
			batch := make([]patch, 0, len(r.g.emptyIDs))
			for _, id := range r.g.emptyIDs {
				batch = append(batch, patch{id: id, url: url})
			}
			if err := bulkUpdatePatches(db, batch); err != nil {
				fail++
				log.Printf("save tts %q: %v", r.g.word, err)
			} else {
				ok++
				updated += len(batch)
				if doneFile != nil {
					key := strings.ToLower(strings.TrimSpace(r.g.word))
					if _, err := io.WriteString(doneFile, key+"\n"); err != nil {
						log.Printf("record tts-done %s: %v", key, err)
					}
				}
			}
		}
		if done%50 == 0 || done == total {
			fmt.Printf("tts progress %d/%d ok=%d fail=%d\n", done, total, ok, fail)
		}
	}
	return ok, fail, updated
}

func synthesizeWordAudio(ctx context.Context, word, translation string) (string, error) {
	texts := buildWordAudioTexts(word, translation)
	if len(texts) == 0 {
		return "", fmt.Errorf("文本为空")
	}
	urls := make([]string, 0, len(texts))
	for i, text := range texts {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		reqCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
		url, err := synthesizeTextToURL(reqCtx, text)
		cancel()
		if err != nil {
			return "", err
		}
		urls = append(urls, url)
		if i+1 < len(texts) {
			time.Sleep(8 * time.Millisecond)
		}
	}
	return strings.Join(urls, ";"), nil
}

func synthesizeTextToURL(ctx context.Context, text string) (string, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return "", fmt.Errorf("文本为空")
	}
	if len([]rune(text)) > 500 {
		return "", fmt.Errorf("文本过长（最多 500 字）")
	}
	cfg, err := synthesizer.NewQCloudConfig(synthesizer.QCloudOverrides{})
	if err != nil {
		return "", err
	}
	svc, err := synthesizer.NewWithConfig(cfg)
	if err != nil {
		return "", err
	}
	defer func() { _ = svc.Close() }()
	pcm, err := svc.Synthesize(ctx, text)
	if err != nil {
		return "", err
	}
	sampleRate := int(cfg.SampleRate)
	if sampleRate <= 0 {
		sampleRate = synthesizer.DefaultSampleRate
	}
	wav, err := synthesizer.EncodeWAV(pcm, sampleRate)
	if err != nil {
		return "", err
	}
	sum := sha1.Sum([]byte(fmt.Sprintf("%s|%d|%s", text, cfg.VoiceType, cfg.Language)))
	hash := hex.EncodeToString(sum[:8])
	key := fmt.Sprintf("tts/%s_%d.wav", hash, time.Now().UnixMilli())
	store := stores.Default()
	if err := store.Write(key, bytes.NewReader(wav)); err != nil {
		return "", err
	}
	return store.PublicURL(key), nil
}

func buildWordAudioTexts(word, translation string) []string {
	w := strings.TrimSpace(word)
	if w == "" {
		return nil
	}
	zh := pickChineseGloss(w, translation)
	return []string{w, w, zh}
}

func pickChineseGloss(word, translation string) string {
	translation = strings.TrimSpace(translation)
	if translation == "" {
		return word
	}
	var items []string
	if err := json.Unmarshal([]byte(translation), &items); err == nil && len(items) > 0 {
		translation = items[0]
	}
	gloss := stripPosFromGloss(translation, word)
	gloss = englishGlossRe.ReplaceAllString(gloss, " ")
	fields := strings.Fields(gloss)
	if len(fields) == 0 {
		return word
	}
	gloss = strings.TrimSpace(fields[0])
	if i := strings.IndexAny(gloss, "；;，,"); i >= 0 {
		gloss = strings.TrimSpace(gloss[:i])
	}
	if gloss == "" {
		return word
	}
	return gloss
}

func stripPosFromGloss(s, word string) string {
	s = strings.TrimSpace(posPrefixRe.ReplaceAllString(s, ""))
	if s == "" {
		return word
	}
	return s
}

func scanWords(db *gorm.DB, batch int, fn func(wordRow)) error {
	if batch < 100 {
		batch = 100
	}
	var rows []wordRow
	return db.Model(&wordRow{}).
		Select("id, word, translation, audio_url").
		Where("is_deleted = ?", models.SoftDeleteStatusActive).
		Order("id ASC").
		FindInBatches(&rows, batch, func(tx *gorm.DB, _ int) error {
			for _, row := range rows {
				fn(row)
			}
			return nil
		}).Error
}

func applyPatchesParallel(db *gorm.DB, patches []patch, batchSize, workers int) (int, error) {
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
				if err := bulkUpdatePatches(db, patches[j.start:j.end]); err != nil {
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

func bulkUpdatePatches(db *gorm.DB, batch []patch) error {
	if len(batch) == 0 {
		return nil
	}
	var b strings.Builder
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
		msg := strings.ToLower(err.Error())
		retry := strings.Contains(msg, "invalid connection") ||
			strings.Contains(msg, "timeout") ||
			strings.Contains(msg, "gone away")
		if !retry {
			return err
		}
	}
	return lastErr
}

func tunePool(db *gorm.DB, workers int) {
	sqlDB, err := db.DB()
	if err != nil {
		return
	}
	max := workers + 8
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func init() {
	log.SetOutput(os.Stderr)
}
