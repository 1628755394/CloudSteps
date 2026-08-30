package handlers

import (
	"context"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/ling-base/common/logger"
	response "github.com/LingByte/CloudStepsGo/pkg/response"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	batchAudioIdle    = "idle"
	batchAudioQueued  = "queued"
	batchAudioRunning = "running"
	batchAudioDone    = "done"
	batchAudioFailed  = "failed"
	batchAudioStopped = "stopped"
)

type batchAudioFilters struct {
	Level string `json:"level"`
	Word  string `json:"word"`
}

type batchAudioJob struct {
	mu         sync.Mutex
	Status     string            `json:"status"`
	Total      int               `json:"total"`
	Processed  int               `json:"processed"`
	Success    int               `json:"success"`
	Failed     int               `json:"failed"`
	Error      string            `json:"error,omitempty"`
	Filters    batchAudioFilters `json:"filters,omitempty"`
	StartedAt  time.Time         `json:"startedAt,omitempty"`
	FinishedAt time.Time         `json:"finishedAt,omitempty"`
	cancel     context.CancelFunc
}

var vocabBatchAudioJob = &batchAudioJob{Status: batchAudioIdle}

func batchAudioGap() time.Duration {
	ms := 8
	if v := os.Getenv("VOCAB_BATCH_AUDIO_GAP_MS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			ms = n
		}
	}
	return time.Duration(ms) * time.Millisecond
}

func (j *batchAudioJob) snapshot() gin.H {
	j.mu.Lock()
	defer j.mu.Unlock()
	out := gin.H{
		"status":    j.Status,
		"total":     j.Total,
		"processed": j.Processed,
		"success":   j.Success,
		"failed":    j.Failed,
		"error":     j.Error,
	}
	if j.Filters.Level != "" || j.Filters.Word != "" {
		out["filters"] = gin.H{
			"level": j.Filters.Level,
			"word":  j.Filters.Word,
		}
	}
	if !j.StartedAt.IsZero() {
		out["startedAt"] = j.StartedAt.UTC().Format(time.RFC3339)
	}
	if !j.FinishedAt.IsZero() {
		out["finishedAt"] = j.FinishedAt.UTC().Format(time.RFC3339)
	}
	return out
}

func (j *batchAudioJob) tryStart(total int, filters batchAudioFilters) (context.Context, bool) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status == batchAudioRunning {
		return nil, false
	}
	ctx, cancel := context.WithCancel(context.Background())
	j.Status = batchAudioRunning
	j.Total = total
	j.Processed = 0
	j.Success = 0
	j.Failed = 0
	j.Error = ""
	j.Filters = filters
	j.StartedAt = time.Now()
	j.FinishedAt = time.Time{}
	j.cancel = cancel
	return ctx, true
}

func (j *batchAudioJob) requestStop() bool {
	j.mu.Lock()
	cancel := j.cancel
	running := j.Status == batchAudioRunning
	j.mu.Unlock()
	if running && cancel != nil {
		cancel()
		return true
	}
	return false
}

func (j *batchAudioJob) markProgress(processed, success, failed int) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Processed = processed
	j.Success = success
	j.Failed = failed
}

func (j *batchAudioJob) finish(status string, errMsg string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = status
	j.Error = errMsg
	j.FinishedAt = time.Now()
	j.cancel = nil
}

// handleBatchAudio POST /vocab/questions/batch-audio
// 后台批量为无音频题目生成 TTS，刷新页面不中断。
func (h *Handlers) handleBatchAudio(c *gin.Context) {
	snap := vocabBatchAudioJob.snapshot()
	if snap["status"] == batchAudioRunning {
		response.SuccessI18n(c, "wordbook.job_running", snap)
		return
	}

	var filters batchAudioFilters
	_ = c.ShouldBindJSON(&filters)

	q := h.db.Model(&models.VocabTestQuestion{}).
		Where("audio_url IS NULL OR audio_url = ''")
	if filters.Level != "" {
		q = q.Where("level = ?", filters.Level)
	}
	if filters.Word != "" {
		q = q.Where("word LIKE ?", "%"+filters.Word+"%")
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		response.FailI18n(c, "common.query_failed", err)
		return
	}
	if total == 0 {
		response.SuccessI18n(c, "wordbook.all_audio_exists", gin.H{
			"status":  batchAudioDone,
			"total":   0,
			"success": 0,
			"started": false,
		})
		return
	}

	ctx, ok := vocabBatchAudioJob.tryStart(int(total), filters)
	if !ok {
		response.SuccessI18n(c, "wordbook.job_running", vocabBatchAudioJob.snapshot())
		return
	}

	db := h.db
	go runBatchAudioJob(ctx, db, filters)

	out := vocabBatchAudioJob.snapshot()
	out["started"] = true
	response.SuccessI18n(c, "wordbook.audio_generation_started", out)
}

// handleBatchAudioStatus GET /vocab/questions/batch-audio
func (h *Handlers) handleBatchAudioStatus(c *gin.Context) {
	response.SuccessI18n(c, "common.success", vocabBatchAudioJob.snapshot())
}

// handleBatchAudioStop POST /vocab/questions/batch-audio/stop
func (h *Handlers) handleBatchAudioStop(c *gin.Context) {
	if !vocabBatchAudioJob.requestStop() {
		response.SuccessI18n(c, "wordbook.no_running_job", vocabBatchAudioJob.snapshot())
		return
	}
	response.SuccessI18n(c, "wordbook.audio_stop_requested", vocabBatchAudioJob.snapshot())
}

func runBatchAudioJob(ctx context.Context, db *gorm.DB, filters batchAudioFilters) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("batch-audio panic", zap.Any("recover", r))
			vocabBatchAudioJob.finish(batchAudioFailed, "内部错误")
		}
	}()

	q := db.Model(&models.VocabTestQuestion{}).
		Where("audio_url IS NULL OR audio_url = ''")
	if filters.Level != "" {
		q = q.Where("level = ?", filters.Level)
	}
	if filters.Word != "" {
		q = q.Where("word LIKE ?", "%"+filters.Word+"%")
	}

	var questions []models.VocabTestQuestion
	if err := q.Select("id, word").
		Order("id ASC").
		Find(&questions).Error; err != nil {
		logger.Error("batch-audio query failed", zap.Error(err))
		vocabBatchAudioJob.finish(batchAudioFailed, err.Error())
		return
	}

	vocabBatchAudioJob.mu.Lock()
	vocabBatchAudioJob.Total = len(questions)
	vocabBatchAudioJob.mu.Unlock()

	success := 0
	failed := 0
	gap := batchAudioGap()

	for i, q := range questions {
		if ctx.Err() != nil {
			vocabBatchAudioJob.markProgress(i, success, failed)
			vocabBatchAudioJob.finish(batchAudioStopped, "")
			logger.Info("batch-audio stopped",
				zap.Int("processed", i),
				zap.Int("success", success),
				zap.Int("failed", failed),
			)
			return
		}

		reqCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
		audioURL, err := synthesizeTextToURL(reqCtx, q.Word, "", "")
		cancel()
		if err != nil {
			failed++
			logger.Warn("batch-audio tts failed",
				zap.Uint("id", q.ID),
				zap.String("word", q.Word),
				zap.Error(err),
			)
		} else if err := db.Model(&models.VocabTestQuestion{}).
			Where("id = ?", q.ID).
			Update("audio_url", audioURL).Error; err != nil {
			failed++
			logger.Warn("batch-audio save failed",
				zap.Uint("id", q.ID),
				zap.Error(err),
			)
		} else {
			success++
		}

		vocabBatchAudioJob.markProgress(i+1, success, failed)

		if i+1 < len(questions) && gap > 0 {
			select {
			case <-ctx.Done():
				vocabBatchAudioJob.finish(batchAudioStopped, "")
				logger.Info("batch-audio stopped",
					zap.Int("processed", i+1),
					zap.Int("success", success),
					zap.Int("failed", failed),
				)
				return
			case <-time.After(gap):
			}
		}
	}

	if success > 0 {
		invalidateVocabPoolCache()
	}
	vocabBatchAudioJob.finish(batchAudioDone, "")
	logger.Info("batch-audio finished",
		zap.Int("total", len(questions)),
		zap.Int("success", success),
		zap.Int("failed", failed),
	)
}
