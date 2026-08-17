package handlers

import (
	"context"
	"encoding/json"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/audio"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/LingByte/ling-base/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var posPrefixRe = regexp.MustCompile(`(?i)^[a-z]+\.\s+`)

type wordBookBatchAudioJob struct {
	mu         sync.Mutex
	BookID     uint   `json:"bookId"`
	Status     string `json:"status"`
	Total      int    `json:"total"`
	Processed  int    `json:"processed"`
	Success    int    `json:"success"`
	Failed     int    `json:"failed"`
	Error      string `json:"error,omitempty"`
	Keyword    string `json:"keyword,omitempty"`
	StartedAt  time.Time
	FinishedAt time.Time
	cancel     context.CancelFunc
}

var wordBookBatchAudioJobs sync.Map // bookID -> *wordBookBatchAudioJob

func wordBookBatchAudioGap() time.Duration {
	ms := 8
	if v := os.Getenv("WORDBOOK_BATCH_AUDIO_GAP_MS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			ms = n
		}
	}
	return time.Duration(ms) * time.Millisecond
}

func wordBookTTSRequestGap() time.Duration {
	ms := 8
	if v := os.Getenv("WORDBOOK_TTS_REQUEST_GAP_MS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			ms = n
		}
	}
	return time.Duration(ms) * time.Millisecond
}

func getWordBookBatchAudioJob(bookID uint) *wordBookBatchAudioJob {
	if v, ok := wordBookBatchAudioJobs.Load(bookID); ok {
		return v.(*wordBookBatchAudioJob)
	}
	j := &wordBookBatchAudioJob{BookID: bookID, Status: batchAudioIdle}
	actual, _ := wordBookBatchAudioJobs.LoadOrStore(bookID, j)
	return actual.(*wordBookBatchAudioJob)
}

func (j *wordBookBatchAudioJob) snapshot() gin.H {
	j.mu.Lock()
	defer j.mu.Unlock()
	out := gin.H{
		"bookId":    j.BookID,
		"status":    j.Status,
		"total":     j.Total,
		"processed": j.Processed,
		"success":   j.Success,
		"failed":    j.Failed,
		"error":     j.Error,
	}
	if j.Keyword != "" {
		out["keyword"] = j.Keyword
	}
	if !j.StartedAt.IsZero() {
		out["startedAt"] = j.StartedAt.UTC().Format(time.RFC3339)
	}
	if !j.FinishedAt.IsZero() {
		out["finishedAt"] = j.FinishedAt.UTC().Format(time.RFC3339)
	}
	return out
}

func (j *wordBookBatchAudioJob) tryStart(total int, keyword string) (context.Context, bool) {
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
	j.Keyword = keyword
	j.StartedAt = time.Now()
	j.FinishedAt = time.Time{}
	j.cancel = cancel
	return ctx, true
}

func (j *wordBookBatchAudioJob) requestStop() bool {
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

func (j *wordBookBatchAudioJob) markProgress(processed, success, failed int) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Processed = processed
	j.Success = success
	j.Failed = failed
}

func (j *wordBookBatchAudioJob) finish(status, errMsg string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = status
	j.Error = errMsg
	j.FinishedAt = time.Now()
	j.cancel = nil
}

type wordBookBatchAudioReq struct {
	Keyword string `json:"keyword"`
}

// adminBatchWordBookAudio POST /wordbooks/:id/words/batch-audio
func (h *Handlers) adminBatchWordBookAudio(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.Fail(c, "无效词库 ID", nil)
		return
	}
	job := getWordBookBatchAudioJob(bookID)
	if snap := job.snapshot(); snap["status"] == batchAudioRunning {
		response.SuccessMsg(c, "任务进行中", snap)
		return
	}

	var req wordBookBatchAudioReq
	_ = c.ShouldBindJSON(&req)
	keyword := strings.TrimSpace(req.Keyword)

	q := db.Model(&models.Word{}).
		Where("word_book_id = ? AND (audio_url IS NULL OR audio_url = '')", bookID)
	if keyword != "" {
		q = q.Where("word LIKE ? OR translation LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	if total == 0 {
		response.SuccessMsg(c, "所有单词已有音频", gin.H{
			"bookId":  bookID,
			"status":  batchAudioDone,
			"total":   0,
			"success": 0,
			"started": false,
		})
		return
	}

	ctx, ok := job.tryStart(int(total), keyword)
	if !ok {
		response.SuccessMsg(c, "任务进行中", job.snapshot())
		return
	}

	go runWordBookBatchAudioJob(ctx, db, bookID, keyword, job)

	out := job.snapshot()
	out["started"] = true
	response.SuccessMsg(c, "已在后台开始生成", out)
}

// adminBatchWordBookAudioStatus GET /wordbooks/:id/words/batch-audio
func (h *Handlers) adminBatchWordBookAudioStatus(c *gin.Context) {
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.Fail(c, "无效词库 ID", nil)
		return
	}
	job := getWordBookBatchAudioJob(bookID)
	response.SuccessMsg(c, "success", job.snapshot())
}

// adminBatchWordBookAudioStop POST /wordbooks/:id/words/batch-audio/stop
func (h *Handlers) adminBatchWordBookAudioStop(c *gin.Context) {
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.Fail(c, "无效词库 ID", nil)
		return
	}
	job := getWordBookBatchAudioJob(bookID)
	if !job.requestStop() {
		response.SuccessMsg(c, "当前没有进行中的任务", job.snapshot())
		return
	}
	response.SuccessMsg(c, "已请求停止", job.snapshot())
}

func runWordBookBatchAudioJob(ctx context.Context, db *gorm.DB, bookID uint, keyword string, job *wordBookBatchAudioJob) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("wordbook batch-audio panic", zap.Uint("bookId", bookID), zap.Any("recover", r))
			job.finish(batchAudioFailed, "内部错误")
		}
	}()

	q := db.Model(&models.Word{}).
		Where("word_book_id = ? AND (audio_url IS NULL OR audio_url = '')", bookID)
	if keyword != "" {
		q = q.Where("word LIKE ? OR translation LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	var words []models.Word
	if err := q.Select("id, word, translation").
		Order("sort_order ASC, id ASC").
		Find(&words).Error; err != nil {
		logger.Error("wordbook batch-audio query failed", zap.Uint("bookId", bookID), zap.Error(err))
		job.finish(batchAudioFailed, err.Error())
		return
	}

	job.mu.Lock()
	job.Total = len(words)
	job.mu.Unlock()

	success := 0
	failed := 0
	wordGap := wordBookBatchAudioGap()
	segGap := wordBookTTSRequestGap()

	for i, w := range words {
		if ctx.Err() != nil {
			job.markProgress(i, success, failed)
			job.finish(batchAudioStopped, "")
			return
		}

		reqCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
		audioURL, err := synthesizeWordBookAudioURLs(reqCtx, w.Word, w.Translation, segGap)
		cancel()
		if err != nil {
			failed++
			logger.Warn("wordbook batch-audio tts failed",
				zap.Uint("bookId", bookID),
				zap.Uint("wordId", w.ID),
				zap.String("word", w.Word),
				zap.Error(err),
			)
		} else {
			cleaned := audio.DeduplicateSlots(audioURL)
			if err := db.Model(&models.Word{}).
				Where("id = ?", w.ID).
				Update("audio_url", cleaned).Error; err != nil {
				failed++
				logger.Warn("wordbook batch-audio save failed",
					zap.Uint("bookId", bookID),
					zap.Uint("wordId", w.ID),
					zap.Error(err),
				)
			} else {
				success++
			}
		}

		job.markProgress(i+1, success, failed)

		if i+1 < len(words) && wordGap > 0 {
			select {
			case <-ctx.Done():
				job.finish(batchAudioStopped, "")
				return
			case <-time.After(wordGap):
			}
		}
	}

	job.finish(batchAudioDone, "")
	logger.Info("wordbook batch-audio finished",
		zap.Uint("bookId", bookID),
		zap.Int("total", len(words)),
		zap.Int("success", success),
		zap.Int("failed", failed),
	)
}

func synthesizeWordBookAudioURLs(ctx context.Context, word, translation string, segGap time.Duration) (string, error) {
	texts := buildWordAudioTexts(word, translation)
	urls := make([]string, 0, len(texts))
	for i, text := range texts {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		reqCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
		url, err := synthesizeTextToURL(reqCtx, text, "", "")
		cancel()
		if err != nil {
			return "", err
		}
		urls = append(urls, url)
		if i+1 < len(texts) && segGap > 0 {
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(segGap):
			}
		}
	}
	return strings.Join(urls, ";"), nil
}

func buildWordAudioTexts(word, translation string) []string {
	w := strings.TrimSpace(word)
	if w == "" {
		return nil
	}
	zh := pickChineseGloss(w, translation)
	return []string{w, w + " " + w + " " + w, w + " " + w + " " + zh}
}

func pickChineseGloss(word, translation string) string {
	translation = strings.TrimSpace(translation)
	if translation == "" {
		return word
	}
	var items []string
	if err := json.Unmarshal([]byte(translation), &items); err == nil && len(items) > 0 {
		if s := strings.TrimSpace(items[0]); s != "" {
			return stripPosFromGloss(s, word)
		}
	}
	return stripPosFromGloss(translation, word)
}

func stripPosFromGloss(s, word string) string {
	s = strings.TrimSpace(posPrefixRe.ReplaceAllString(s, ""))
	if s == "" {
		return word
	}
	return s
}
