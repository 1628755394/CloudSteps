package handlers

import (
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/LingByte/ling-base/common/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	purgeAllAudioIdle    = "idle"
	purgeAllAudioRunning = "running"
	purgeAllAudioDone    = "done"
	purgeAllAudioFailed  = "failed"
)

type purgeAllAudioJob struct {
	mu               sync.Mutex
	Status           string    `json:"status"`
	Total            int       `json:"total"`
	Processed        int       `json:"processed"`
	Cleared          int       `json:"cleared"`
	ObjectsAttempted int       `json:"objectsAttempted"`
	ObjectsFailed    int       `json:"objectsFailed"`
	Error            string    `json:"error,omitempty"`
	StartedAt        time.Time `json:"startedAt,omitempty"`
	FinishedAt       time.Time `json:"finishedAt,omitempty"`
}

var vocabPurgeAllAudioJob = &purgeAllAudioJob{Status: purgeAllAudioIdle}

func (j *purgeAllAudioJob) snapshot() gin.H {
	j.mu.Lock()
	defer j.mu.Unlock()
	out := gin.H{
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

func (j *purgeAllAudioJob) tryStart(total int) bool {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status == purgeAllAudioRunning {
		return false
	}
	j.Status = purgeAllAudioRunning
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

func (j *purgeAllAudioJob) markProgress(processed, cleared, attempted, failed int) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Processed = processed
	j.Cleared = cleared
	j.ObjectsAttempted = attempted
	j.ObjectsFailed = failed
}

func (j *purgeAllAudioJob) markDone(cleared, attempted, failed int) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = purgeAllAudioDone
	j.Processed = j.Total
	j.Cleared = cleared
	j.ObjectsAttempted = attempted
	j.ObjectsFailed = failed
	j.FinishedAt = time.Now()
}

func (j *purgeAllAudioJob) markFailed(errMsg string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = purgeAllAudioFailed
	j.Error = errMsg
	j.FinishedAt = time.Now()
}

// handlePurgeAllAudio POST /vocab/questions/purge-all-audio
// 启动后台任务：对象存储 Delete + 清空 audio_url；立即返回。
func (h *Handlers) handlePurgeAllAudio(c *gin.Context) {
	snap := vocabPurgeAllAudioJob.snapshot()
	if snap["status"] == purgeAllAudioRunning {
		response.SuccessMsg(c, "任务进行中", snap)
		return
	}

	var total int64
	if err := h.db.Model(&models.VocabTestQuestion{}).
		Where("audio_url IS NOT NULL AND audio_url <> ''").
		Count(&total).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	if total == 0 {
		response.SuccessMsg(c, "无需清除", gin.H{
			"status":  purgeAllAudioDone,
			"total":   0,
			"cleared": 0,
			"started": false,
		})
		return
	}

	if !vocabPurgeAllAudioJob.tryStart(int(total)) {
		response.SuccessMsg(c, "任务进行中", vocabPurgeAllAudioJob.snapshot())
		return
	}

	db := h.db
	go runPurgeAllAudioJob(db)

	out := vocabPurgeAllAudioJob.snapshot()
	out["started"] = true
	response.SuccessMsg(c, "已在后台开始清除", out)
}

// handlePurgeAllAudioStatus GET /vocab/questions/purge-all-audio
func (h *Handlers) handlePurgeAllAudioStatus(c *gin.Context) {
	response.SuccessMsg(c, "success", vocabPurgeAllAudioJob.snapshot())
}

func runPurgeAllAudioJob(db *gorm.DB) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("purge-all-audio panic", zap.Any("recover", r))
			vocabPurgeAllAudioJob.markFailed("内部错误")
		}
	}()

	var questions []models.VocabTestQuestion
	if err := db.Select("id, word, audio_url").
		Where("audio_url IS NOT NULL AND audio_url <> ''").
		Find(&questions).Error; err != nil {
		logger.Error("purge-all-audio query failed", zap.Error(err))
		vocabPurgeAllAudioJob.markFailed(err.Error())
		return
	}

	vocabPurgeAllAudioJob.mu.Lock()
	vocabPurgeAllAudioJob.Total = len(questions)
	vocabPurgeAllAudioJob.mu.Unlock()

	cleared := 0
	objectsAttempted := 0
	objectsFailed := 0
	for i, q := range questions {
		a, f := stores.DeleteObjectURLs(q.AudioURL)
		objectsAttempted += a
		objectsFailed += f
		if err := db.Model(&models.VocabTestQuestion{}).
			Where("id = ?", q.ID).
			Update("audio_url", "").Error; err != nil {
			logger.Warn("purge-all-audio clear audio_url failed",
				zap.Uint("id", q.ID), zap.Error(err))
		} else {
			cleared++
		}
		vocabPurgeAllAudioJob.markProgress(i+1, cleared, objectsAttempted, objectsFailed)
	}

	if cleared > 0 {
		invalidateVocabPoolCache()
	}
	vocabPurgeAllAudioJob.markDone(cleared, objectsAttempted, objectsFailed)
	logger.Info("purge-all-audio finished",
		zap.Int("total", len(questions)),
		zap.Int("cleared", cleared),
		zap.Int("objectsAttempted", objectsAttempted),
		zap.Int("objectsFailed", objectsFailed),
	)
}
