package models

import (
	"context"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/LingByte/ling-base/common/logger"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// 内存词条补全缓存：启动时从 words 表抽取去重词条，enrich 只读缓存，未命中则不填。
const (
	enrichCacheMaxEntries = 250_000
	enrichScanBatch       = 5_000
	enrichReloadInterval  = 12 * time.Hour
	// 启动后若缓存尚未就绪，enrich 最多等待这么久（等首批写入）
	enrichWaitReady = 8 * time.Second
)

type EnrichEntry struct {
	Phonetic         string
	PhoneticUS       string
	Translation      string
	TranslationShort string
}

var (
	enrichMu        sync.RWMutex
	enrichMap       = map[string]EnrichEntry{}
	enrichReady     atomic.Bool
	enrichOnce      sync.Once
	enrichReadyCh   = make(chan struct{})
	enrichReadyOnce sync.Once
)

func markEnrichReady() {
	enrichReady.Store(true)
	enrichReadyOnce.Do(func() { close(enrichReadyCh) })
}

func waitEnrichReady() {
	if enrichReady.Load() {
		return
	}
	select {
	case <-enrichReadyCh:
	case <-time.After(enrichWaitReady):
	}
}

// EnrichFromCache 仅用内存缓存补全；未命中保持原样（空字段也会返回）。
func EnrichFromCache(items []ParsedWord) []ParsedWord {
	if len(items) == 0 {
		return items
	}
	waitEnrichReady()
	if !enrichReady.Load() {
		return items
	}
	enrichMu.RLock()
	defer enrichMu.RUnlock()
	for i := range items {
		key := strings.ToLower(strings.TrimSpace(items[i].Word))
		if key == "" {
			continue
		}
		e, ok := enrichMap[key]
		if !ok {
			continue
		}
		if items[i].Phonetic == "" {
			if e.Phonetic != "" {
				items[i].Phonetic = e.Phonetic
			} else {
				items[i].Phonetic = e.PhoneticUS
			}
		}
		if items[i].Translation == "" {
			items[i].Translation = e.Translation
		}
		if items[i].TranslationShort == "" {
			items[i].TranslationShort = e.TranslationShort
			if items[i].TranslationShort == "" {
				items[i].TranslationShort = e.Translation
			}
		}
	}
	return items
}

// EnrichCacheSize 当前缓存词条数（测试/诊断用）
func EnrichCacheSize() int {
	enrichMu.RLock()
	defer enrichMu.RUnlock()
	return len(enrichMap)
}

// StartEnrichCacheLoader 后台加载并周期性刷新
func StartEnrichCacheLoader(db *gorm.DB) {
	if db == nil {
		return
	}
	enrichOnce.Do(func() {
		go func() {
			loadEnrichCache(db)
			ticker := time.NewTicker(enrichReloadInterval)
			defer ticker.Stop()
			for range ticker.C {
				loadEnrichCache(db)
			}
		}()
	})
}

func loadEnrichCache(db *gorm.DB) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	start := time.Now()
	next := make(map[string]EnrichEntry, 64_000)

	type row struct {
		ID               uint
		Word             string
		Phonetic         string
		PhoneticUS       string
		Translation      string
		TranslationShort string
	}

	var lastID uint
	scanned := 0

	publishSnapshot := func() {
		if len(next) == 0 {
			return
		}
		// 拷贝快照，避免读侧拿到正在写入的 map
		snap := make(map[string]EnrichEntry, len(next))
		for k, v := range next {
			snap[k] = v
		}
		enrichMu.Lock()
		enrichMap = snap
		enrichMu.Unlock()
		markEnrichReady()
	}

	for {
		if ctx.Err() != nil {
			break
		}
		if len(next) >= enrichCacheMaxEntries {
			break
		}
		var part []row
		err := db.WithContext(ctx).Model(&Word{}).
			Select("id, word, phonetic, phonetic_us, translation, translation_short").
			Where("id > ?", lastID).
			Where("(phonetic <> '' OR phonetic_us <> '' OR translation <> '' OR translation_short <> '')").
			Order("id ASC").
			Limit(enrichScanBatch).
			Find(&part).Error
		if err != nil {
			logger.Lg.Warn("custom word enrich cache load failed", zap.Error(err), zap.Int("loaded", len(next)))
			break
		}
		if len(part) == 0 {
			break
		}
		for _, r := range part {
			lastID = r.ID
			scanned++
			key := strings.ToLower(strings.TrimSpace(r.Word))
			if key == "" {
				continue
			}
			cur, exists := next[key]
			merged := mergeEnrichEntry(cur, EnrichEntry{
				Phonetic:         strings.TrimSpace(r.Phonetic),
				PhoneticUS:       strings.TrimSpace(r.PhoneticUS),
				Translation:      strings.TrimSpace(r.Translation),
				TranslationShort: strings.TrimSpace(r.TranslationShort),
			})
			if !exists || enrichScore(merged) > enrichScore(cur) {
				next[key] = merged
			}
			if len(next) >= enrichCacheMaxEntries {
				break
			}
		}
		// 首批起即可对外服务；周期刷新时旧缓存仍可用，直到最终 swap
		if !enrichReady.Load() {
			publishSnapshot()
		}
		if len(next) >= enrichCacheMaxEntries || len(part) < enrichScanBatch {
			break
		}
	}

	if len(next) == 0 {
		logger.Lg.Warn("custom word enrich cache empty after scan",
			zap.Int("scanned", scanned),
			zap.Duration("elapsed", time.Since(start)))
		return
	}

	publishSnapshot()
	logger.Lg.Info("custom word enrich cache ready",
		zap.Int("entries", len(next)),
		zap.Int("scanned", scanned),
		zap.Duration("elapsed", time.Since(start)))
}

func mergeEnrichEntry(a, b EnrichEntry) EnrichEntry {
	out := a
	if out.Phonetic == "" {
		out.Phonetic = b.Phonetic
	}
	if out.PhoneticUS == "" {
		out.PhoneticUS = b.PhoneticUS
	}
	if out.Translation == "" {
		out.Translation = b.Translation
	}
	if out.TranslationShort == "" {
		out.TranslationShort = b.TranslationShort
	}
	return out
}

func enrichScore(e EnrichEntry) int {
	n := 0
	if e.Phonetic != "" || e.PhoneticUS != "" {
		n += 2
	}
	if e.TranslationShort != "" {
		n += 2
	} else if e.Translation != "" {
		n++
	}
	return n
}
