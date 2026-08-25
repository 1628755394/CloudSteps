package handlers

import (
	"fmt"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const lighthouseCacheTTL = 45 * time.Second

type lighthouseCacheEntry struct {
	data    gin.H
	expires time.Time
}

var (
	lighthouseCacheMu sync.RWMutex
	lighthouseCache   = make(map[string]lighthouseCacheEntry)
)

func lighthouseCacheKey(userID uint, wordBookID int) string {
	return fmt.Sprintf("%d:%d", userID, wordBookID)
}

func getCachedLighthouse(key string) (gin.H, bool) {
	lighthouseCacheMu.RLock()
	defer lighthouseCacheMu.RUnlock()
	e, ok := lighthouseCache[key]
	if !ok || time.Now().After(e.expires) {
		return nil, false
	}
	return e.data, true
}

func setCachedLighthouse(key string, data gin.H) {
	lighthouseCacheMu.Lock()
	defer lighthouseCacheMu.Unlock()
	lighthouseCache[key] = lighthouseCacheEntry{
		data:    data,
		expires: time.Now().Add(lighthouseCacheTTL),
	}
}

func invalidateLighthouseCacheForUser(userID uint) {
	lighthouseCacheMu.Lock()
	defer lighthouseCacheMu.Unlock()
	prefix := fmt.Sprintf("%d:", userID)
	for k := range lighthouseCache {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			delete(lighthouseCache, k)
		}
	}
}

func computeStudyLighthouse(db *gorm.DB, userID uint, wordBookID int) gin.H {
	now := time.Now().UTC()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	endOfToday := startOfToday.Add(24 * time.Hour)

	type dayItem struct {
		ID    string `json:"id"`
		Count int64  `json:"count"`
		Label string `json:"label"`
	}
	type stageRow struct {
		ReviewStage int   `gorm:"column:review_stage"`
		Cnt         int64 `gorm:"column:cnt"`
	}
	type aggRow struct {
		TodayNewLearned int64 `gorm:"column:today_new"`
		PendingCount    int64 `gorm:"column:pending_cnt"`
		MasteredCount   int64 `gorm:"column:mastered_cnt"`
	}

	scope := func(q *gorm.DB) *gorm.DB {
		q = q.Where("user_id = ?", userID)
		if wordBookID > 0 {
			q = q.Where("word_book_id = ?", uint(wordBookID))
		}
		return q
	}

	stageMap := make(map[int]int64, 7)
	var stageRows []stageRow
	_ = scope(db.Model(&models.UserWordState{})).
		Where("learn_status IN ?", []string{"learning", "learned", "mastered"}).
		Select("review_stage, COUNT(*) AS cnt").
		Group("review_stage").
		Scan(&stageRows).Error
	for _, r := range stageRows {
		stageMap[r.ReviewStage] = r.Cnt
	}

	var agg aggRow
	_ = scope(db.Model(&models.UserWordState{})).
		Select(`SUM(CASE WHEN first_learned_at IS NOT NULL AND first_learned_at >= ? AND first_learned_at < ? THEN 1 ELSE 0 END) AS today_new,
			SUM(CASE WHEN screen_result = ? AND learn_status = ? THEN 1 ELSE 0 END) AS pending_cnt,
			SUM(CASE WHEN learn_status = ? THEN 1 ELSE 0 END) AS mastered_cnt`,
			startOfToday, endOfToday, "unknown", "pending", "mastered").
		Scan(&agg).Error

	days := make([]dayItem, 0, 7)
	intervals := models.EbbinghausIntervals
	for i := 0; i < 7; i++ {
		label := fmt.Sprintf("第%d步", i+1)
		if i < len(intervals) {
			if i == 0 {
				label += "·初学"
			} else {
				label += fmt.Sprintf("·%d天后", intervals[i])
			}
		}
		days = append(days, dayItem{ID: pad2(i + 1), Count: stageMap[i], Label: label})
	}

	// 待学计数：用「词库总词数 - 已进入学习流程的词数」，
	// 让九宫格 01 待学与词库单词数量挂钩；只要词库有词就显示待学数，不能为 0。
	pendingCount := agg.PendingCount
	if wordBookID > 0 {
		var totalWords int64
		_ = db.Model(&models.Word{}).
			Where("word_book_id = ? AND is_deleted = ?", uint(wordBookID), models.SoftDeleteStatusActive).
			Count(&totalWords).Error

		var learnedCount int64
		_ = scope(db.Model(&models.UserWordState{})).
			Where("learn_status IN ?", []string{"learning", "learned", "mastered"}).
			Count(&learnedCount).Error

		// 词库有词时始终用「总词数 - 已学词数」覆盖，未开始的词库显示满词数
		if totalWords > 0 {
			pendingCount = totalWords - learnedCount
			if pendingCount < 0 {
				pendingCount = 0
			}
		}
	}

	return gin.H{
		"days":            days,
		"pendingCount":    pendingCount,
		"masteredCount":   agg.MasteredCount,
		"todayNewLearned": agg.TodayNewLearned,
	}
}
