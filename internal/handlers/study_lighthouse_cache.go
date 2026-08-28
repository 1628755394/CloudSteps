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
			SUM(CASE WHEN learn_status = ? THEN 1 ELSE 0 END) AS mastered_cnt`,
			startOfToday, endOfToday, "mastered").
		Scan(&agg).Error

	// 待学 = 词库中尚未 learned/mastered 的单词数（未入状态表的也算待学）
	var pendingCount int64
	if wordBookID > 0 {
		totalWords, err := models.GetWordCountByBookID(db, uint(wordBookID))
		if err == nil {
			var done int64
			_ = db.Model(&models.UserWordState{}).
				Where("user_id = ? AND word_book_id = ? AND learn_status IN ?", userID, uint(wordBookID), []string{"learned", "mastered"}).
				Count(&done).Error
			pendingCount = totalWords - done
			if pendingCount < 0 {
				pendingCount = 0
			}
		}
	} else {
		// 无词库时退回：仅统计已产生 unknown+pending 状态的行（无法推断全库未学数）
		_ = scope(db.Model(&models.UserWordState{})).
			Where("screen_result = ? AND learn_status = ?", "unknown", "pending").
			Count(&pendingCount).Error
	}

	days := make([]dayItem, 0, 7)
	var presetUser models.User
	_ = db.Select("review_curve_preset").Where("id = ?", userID).First(&presetUser).Error
	schedule := models.ReviewScheduleDaysForUser(&presetUser)
	for i := 0; i < 7; i++ {
		label := fmt.Sprintf("第%d步", i+1)
		if i < len(schedule) {
			label = models.ReviewDayLabel(schedule[i])
		}
		days = append(days, dayItem{ID: pad2(i + 1), Count: stageMap[i], Label: label})
	}

	return gin.H{
		"days":            days,
		"pendingCount":    pendingCount,
		"masteredCount":   agg.MasteredCount,
		"todayNewLearned": agg.TodayNewLearned,
	}
}
