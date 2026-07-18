package handlers

import (
	"math/rand"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"gorm.io/gorm"
)

const vocabPoolTTL = 10 * time.Minute

var (
	vocabPoolMu       sync.RWMutex
	vocabPoolByLevel  map[string][]models.VocabTestQuestion
	vocabPoolLoadedAt time.Time
)

func invalidateVocabPoolCache() {
	vocabPoolMu.Lock()
	defer vocabPoolMu.Unlock()
	vocabPoolByLevel = nil
	vocabPoolLoadedAt = time.Time{}
}

func getVocabPoolByLevel(db *gorm.DB) (map[string][]models.VocabTestQuestion, error) {
	vocabPoolMu.RLock()
	if vocabPoolByLevel != nil && time.Since(vocabPoolLoadedAt) < vocabPoolTTL {
		pool := vocabPoolByLevel
		vocabPoolMu.RUnlock()
		return pool, nil
	}
	vocabPoolMu.RUnlock()

	vocabPoolMu.Lock()
	defer vocabPoolMu.Unlock()
	if vocabPoolByLevel != nil && time.Since(vocabPoolLoadedAt) < vocabPoolTTL {
		return vocabPoolByLevel, nil
	}

	var all []models.VocabTestQuestion
	if err := db.Select("id, word, options, correct_answer, level, difficulty_score, audio_url").
		Find(&all).Error; err != nil {
		return nil, err
	}
	byLevel := make(map[string][]models.VocabTestQuestion, 5)
	for _, q := range all {
		byLevel[q.Level] = append(byLevel[q.Level], q)
	}
	vocabPoolByLevel = byLevel
	vocabPoolLoadedAt = time.Now()
	return byLevel, nil
}

func pickFromPool(candidates []models.VocabTestQuestion, minScore, maxScore, limit int, used map[uint]bool, rng *rand.Rand) []models.VocabTestQuestion {
	if limit <= 0 || len(candidates) == 0 {
		return nil
	}
	filtered := make([]models.VocabTestQuestion, 0, len(candidates))
	for _, q := range candidates {
		if used[q.ID] {
			continue
		}
		if q.DifficultyScore < minScore {
			continue
		}
		if maxScore < 1_000_000 && q.DifficultyScore > maxScore {
			continue
		}
		filtered = append(filtered, q)
	}
	rng.Shuffle(len(filtered), func(i, j int) { filtered[i], filtered[j] = filtered[j], filtered[i] })
	if len(filtered) > limit {
		filtered = filtered[:limit]
	}
	return filtered
}

func pickBalancedRandomQuestionsFromPool(pool map[string][]models.VocabTestQuestion, level string, n int, excludeIDs []uint) ([]models.VocabTestQuestion, error) {
	if n <= 0 {
		return []models.VocabTestQuestion{}, nil
	}
	candidates := pool[level]
	if len(candidates) == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	used := make(map[uint]bool, len(excludeIDs)+n)
	for _, id := range excludeIDs {
		used[id] = true
	}

	buckets := []struct {
		min int
		max int
		cnt int
	}{
		{min: 1, max: 2, cnt: (n + 2) / 3},
		{min: 3, max: 4, cnt: n / 3},
		{min: 5, max: 1_000_000, cnt: n - (n+2)/3 - n/3},
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	res := make([]models.VocabTestQuestion, 0, n)
	for _, b := range buckets {
		qs := pickFromPool(candidates, b.min, b.max, b.cnt, used, rng)
		for _, q := range qs {
			if len(res) >= n {
				break
			}
			used[q.ID] = true
			res = append(res, q)
		}
	}

	if len(res) < n {
		need := n - len(res)
		fill := pickFromPool(candidates, 1, 1_000_000, need, used, rng)
		for _, q := range fill {
			if len(res) >= n {
				break
			}
			used[q.ID] = true
			res = append(res, q)
		}
	}

	if len(res) == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return res, nil
}
