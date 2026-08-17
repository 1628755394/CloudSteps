package handlers

import (
	"strconv"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/LingByte/ling-base/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	wordBookPurgeIdle    = "idle"
	wordBookPurgeRunning = "running"
	wordBookPurgeDone    = "done"
	wordBookPurgeFailed  = "failed"
)

type wordBookPurgeAudioJob struct {
	mu               sync.Mutex
	BookID           uint   `json:"bookId"`
	Status           string `json:"status"`
	Total            int    `json:"total"`
	Processed        int    `json:"processed"`
	Cleared          int    `json:"cleared"`
	ObjectsAttempted int    `json:"objectsAttempted"`
	ObjectsFailed    int    `json:"objectsFailed"`
	Error            string `json:"error,omitempty"`
	StartedAt        time.Time
	FinishedAt       time.Time
}

var wordBookPurgeJobs sync.Map // bookID -> *wordBookPurgeAudioJob

func getWordBookPurgeJob(bookID uint) *wordBookPurgeAudioJob {
	if v, ok := wordBookPurgeJobs.Load(bookID); ok {
		return v.(*wordBookPurgeAudioJob)
	}
	j := &wordBookPurgeAudioJob{BookID: bookID, Status: wordBookPurgeIdle}
	actual, _ := wordBookPurgeJobs.LoadOrStore(bookID, j)
	return actual.(*wordBookPurgeAudioJob)
}

func (j *wordBookPurgeAudioJob) snapshot() gin.H {
	j.mu.Lock()
	defer j.mu.Unlock()
	out := gin.H{
		"bookId":           j.BookID,
		"status":           j.Status,
		"total":            j.Total,
		"processed":        j.Processed,
		"cleared":          j.Cleared,
		"objectsAttempted": j.ObjectsAttempted,
		"objectsFailed":    j.ObjectsFailed,
		"error":            j.Error,
	}
	if !j.StartedAt.IsZero() {
		out["startedAt"] = j.StartedAt.UTC().Format(time.RFC3339)
	}
	if !j.FinishedAt.IsZero() {
		out["finishedAt"] = j.FinishedAt.UTC().Format(time.RFC3339)
	}
	return out
}

func (j *wordBookPurgeAudioJob) tryStart(total int) bool {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status == wordBookPurgeRunning {
		return false
	}
	j.Status = wordBookPurgeRunning
	j.Total = total
	j.Processed = 0
	j.Cleared = 0
	j.ObjectsAttempted = 0
	j.ObjectsFailed = 0
	j.Error = ""
	j.StartedAt = time.Now()
	j.FinishedAt = time.Time{}
	return true
}

func (j *wordBookPurgeAudioJob) markProgress(processed, cleared, attempted, failed int) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Processed = processed
	j.Cleared = cleared
	j.ObjectsAttempted = attempted
	j.ObjectsFailed = failed
}

func (j *wordBookPurgeAudioJob) markDone(cleared, attempted, failed int) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = wordBookPurgeDone
	j.Processed = j.Total
	j.Cleared = cleared
	j.ObjectsAttempted = attempted
	j.ObjectsFailed = failed
	j.FinishedAt = time.Now()
}

func (j *wordBookPurgeAudioJob) markFailed(errMsg string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = wordBookPurgeFailed
	j.Error = errMsg
	j.FinishedAt = time.Now()
}

// adminPurgeWordBookAudio POST /wordbooks/:id/words/purge-all-audio
func (h *Handlers) adminPurgeWordBookAudio(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.Fail(c, "无效词库 ID", nil)
		return
	}
	job := getWordBookPurgeJob(bookID)

	if snap := job.snapshot(); snap["status"] == wordBookPurgeRunning {
		response.SuccessMsg(c, "任务进行中", snap)
		return
	}

	var total int64
	if err := db.Model(&models.Word{}).
		Where("word_book_id = ? AND audio_url IS NOT NULL AND audio_url <> ''", bookID).
		Count(&total).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	if total == 0 {
		response.SuccessMsg(c, "没有需要清除的音频", gin.H{
			"bookId":  bookID,
			"status":  wordBookPurgeDone,
			"total":   0,
			"cleared": 0,
			"started": false,
		})
		return
	}

	if !job.tryStart(int(total)) {
		response.SuccessMsg(c, "任务进行中", job.snapshot())
		return
	}

	go runWordBookPurgeAudioJob(db, bookID, job)

	out := job.snapshot()
	out["started"] = true
	response.SuccessMsg(c, "已在后台开始清除", out)
}

// adminPurgeWordBookAudioStatus GET /wordbooks/:id/words/purge-all-audio
func (h *Handlers) adminPurgeWordBookAudioStatus(c *gin.Context) {
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.Fail(c, "无效词库 ID", nil)
		return
	}
	job := getWordBookPurgeJob(bookID)
	response.SuccessMsg(c, "success", job.snapshot())
}

func runWordBookPurgeAudioJob(db *gorm.DB, bookID uint, job *wordBookPurgeAudioJob) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("wordbook purge-audio panic", zap.Uint("bookId", bookID), zap.Any("recover", r))
			job.markFailed("内部错误")
		}
	}()

	var words []models.Word
	if err := db.Select("id, word, audio_url").
		Where("word_book_id = ? AND audio_url IS NOT NULL AND audio_url <> ''", bookID).
		Find(&words).Error; err != nil {
		logger.Error("wordbook purge-audio query failed", zap.Uint("bookId", bookID), zap.Error(err))
		job.markFailed(err.Error())
		return
	}

	job.mu.Lock()
	job.Total = len(words)
	job.mu.Unlock()

	cleared := 0
	objectsAttempted := 0
	objectsFailed := 0
	for i, w := range words {
		a, f := stores.DeleteObjectURLs(w.AudioURL)
		objectsAttempted += a
		objectsFailed += f
		if err := db.Model(&models.Word{}).
			Where("id = ?", w.ID).
			Update("audio_url", "").Error; err != nil {
			logger.Warn("wordbook purge-audio clear failed",
				zap.Uint("bookId", bookID),
				zap.Uint("wordId", w.ID),
				zap.Error(err),
			)
		} else {
			cleared++
		}
		job.markProgress(i+1, cleared, objectsAttempted, objectsFailed)
	}

	job.markDone(cleared, objectsAttempted, objectsFailed)
	logger.Info("wordbook purge-audio finished",
		zap.Uint("bookId", bookID),
		zap.Int("total", len(words)),
		zap.Int("cleared", cleared),
		zap.Int("objectsAttempted", objectsAttempted),
		zap.Int("objectsFailed", objectsFailed),
	)
}

func parseBookIDParam(c *gin.Context) (uint, error) {
	n, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || n == 0 {
		return 0, err
	}
	return uint(n), nil
}
