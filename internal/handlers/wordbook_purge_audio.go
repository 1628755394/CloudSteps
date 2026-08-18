package handlers

import (
	"context"
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
	wordBookPurgeQueued  = "queued"
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
	TaskID           string `json:"taskId,omitempty"`
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
	if j.TaskID != "" {
		out["taskId"] = j.TaskID
	}
	if !j.StartedAt.IsZero() {
		out["startedAt"] = j.StartedAt.UTC().Format(time.RFC3339)
	}
	if !j.FinishedAt.IsZero() {
		out["finishedAt"] = j.FinishedAt.UTC().Format(time.RFC3339)
	}
	return out
}

func (j *wordBookPurgeAudioJob) isActiveLocked() bool {
	return j.Status == wordBookPurgeQueued || j.Status == wordBookPurgeRunning
}

func (j *wordBookPurgeAudioJob) tryQueue(total int, taskID string) bool {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.isActiveLocked() {
		return false
	}
	j.Status = wordBookPurgeQueued
	j.Total = total
	j.Processed = 0
	j.Cleared = 0
	j.ObjectsAttempted = 0
	j.ObjectsFailed = 0
	j.Error = ""
	j.TaskID = taskID
	j.StartedAt = time.Now()
	j.FinishedAt = time.Time{}
	return true
}

func (j *wordBookPurgeAudioJob) beginRun() bool {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status != wordBookPurgeQueued {
		return false
	}
	j.Status = wordBookPurgeRunning
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

func (j *wordBookPurgeAudioJob) finish(status, errMsg string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = status
	j.Error = errMsg
	j.FinishedAt = time.Now()
	if status == wordBookPurgeDone {
		j.Processed = j.Total
	}
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

	if snap := job.snapshot(); snap["status"] == wordBookPurgeRunning || snap["status"] == wordBookPurgeQueued {
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

	out, err := enqueueWordBookPurgeAudio(bookID, int(total))
	if err != nil {
		if out != nil {
			response.SuccessMsg(c, "任务进行中", out)
			return
		}
		response.Fail(c, err.Error(), nil)
		return
	}
	response.SuccessMsg(c, "已加入清除队列", out)
}

// adminPurgeWordBookAudioStatus GET /wordbooks/:id/words/purge-all-audio
func (h *Handlers) adminPurgeWordBookAudioStatus(c *gin.Context) {
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.Fail(c, "无效词库 ID", nil)
		return
	}
	job := getWordBookPurgeJob(bookID)
	out := job.snapshot()
	if status, _ := out["status"].(string); status == wordBookPurgeQueued {
		wordBookPurgeAudioQueueMu.Lock()
		q := wordBookPurgeAudioQ
		workers := wordBookPurgeAudioWorkers
		wordBookPurgeAudioQueueMu.Unlock()
		out["queueWorkers"] = workers
		if q != nil {
			if taskID, _ := out["taskId"].(string); taskID != "" {
				if pos, err := q.Position(context.Background(), taskID); err == nil && pos >= 0 {
					out["queuePosition"] = pos
				}
			}
			if stats, err := q.Stats(context.Background()); err == nil {
				out["queuePending"] = stats.Pending
				out["queueRunning"] = stats.Running
			}
		}
	}
	response.SuccessMsg(c, "success", out)
}

func runWordBookPurgeAudioJob(db *gorm.DB, bookID uint, job *wordBookPurgeAudioJob) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("wordbook purge-audio panic", zap.Uint("bookId", bookID), zap.Any("recover", r))
			job.finish(wordBookPurgeFailed, "内部错误")
		}
	}()

	var words []models.Word
	if err := db.Select("id, word, audio_url").
		Where("word_book_id = ? AND audio_url IS NOT NULL AND audio_url <> ''", bookID).
		Find(&words).Error; err != nil {
		logger.Error("wordbook purge-audio query failed", zap.Uint("bookId", bookID), zap.Error(err))
		job.finish(wordBookPurgeFailed, err.Error())
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

	job.mu.Lock()
	job.Cleared = cleared
	job.ObjectsAttempted = objectsAttempted
	job.ObjectsFailed = objectsFailed
	job.mu.Unlock()
	job.finish(wordBookPurgeDone, "")

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
