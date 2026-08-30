package handlers

import (
	"bytes"
	"context"
	"fmt"

	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	lbconstants "github.com/LingByte/ling-base/common/constants"

	"io"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/imagegen"
	"github.com/LingByte/CloudStepsGo/pkg/stores"
	"github.com/LingByte/ling-base/common/logger"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const wordbookCoverMaxRefBytes = 8 << 20 // 8MB

const (
	wordBookCoverIdle    = "idle"
	wordBookCoverQueued  = "queued"
	wordBookCoverRunning = "running"
	wordBookCoverDone    = "done"
	wordBookCoverFailed  = "failed"
)

type wordBookCoverJob struct {
	mu            sync.Mutex
	BookID        uint   `json:"bookId"`
	Status        string `json:"status"`
	Prompt        string `json:"prompt,omitempty"`
	Size          string `json:"size,omitempty"`
	Error         string `json:"error,omitempty"`
	RevisedPrompt string `json:"revisedPrompt,omitempty"`
	PreviewKey    string `json:"previewKey,omitempty"`
	PreviewURL    string `json:"previewUrl,omitempty"`
	Bytes         int    `json:"bytes,omitempty"`
	Ext           string `json:"ext,omitempty"`
	Saved         bool   `json:"saved"`
	StartedAt     time.Time
	FinishedAt    time.Time
	refImage      []byte
}

var wordBookCoverJobs sync.Map // bookID -> *wordBookCoverJob

func getWordBookCoverJob(bookID uint) *wordBookCoverJob {
	if v, ok := wordBookCoverJobs.Load(bookID); ok {
		return v.(*wordBookCoverJob)
	}
	j := &wordBookCoverJob{BookID: bookID, Status: wordBookCoverIdle}
	actual, _ := wordBookCoverJobs.LoadOrStore(bookID, j)
	return actual.(*wordBookCoverJob)
}

func isWordBookCoverActive(status string) bool {
	return status == wordBookCoverQueued || status == wordBookCoverRunning
}

func (j *wordBookCoverJob) snapshot(includePreview bool) gin.H {
	j.mu.Lock()
	defer j.mu.Unlock()
	out := gin.H{
		"bookId": j.BookID,
		"status": j.Status,
		"saved":  j.Saved,
		"error":  j.Error,
	}
	if j.Prompt != "" {
		out["prompt"] = j.Prompt
	}
	if j.Size != "" {
		out["size"] = j.Size
	}
	if j.RevisedPrompt != "" {
		out["revisedPrompt"] = j.RevisedPrompt
	}
	if j.PreviewURL != "" {
		out["previewUrl"] = j.PreviewURL
	}
	if j.Bytes > 0 {
		out["bytes"] = j.Bytes
	}
	if j.Ext != "" {
		out["ext"] = strings.TrimPrefix(j.Ext, ".")
	}
	if !j.StartedAt.IsZero() {
		out["startedAt"] = j.StartedAt.UTC().Format(time.RFC3339)
	}
	if !j.FinishedAt.IsZero() {
		out["finishedAt"] = j.FinishedAt.UTC().Format(time.RFC3339)
	}
	if includePreview && j.Status == wordBookCoverDone && j.PreviewKey != "" {
		// optional: large payload only when explicitly requested
	}
	return out
}

func (j *wordBookCoverJob) tryStart(prompt, size string, refImage []byte) bool {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status == wordBookCoverQueued || j.Status == wordBookCoverRunning {
		return false
	}
	j.Status = wordBookCoverQueued
	j.Prompt = prompt
	j.Size = size
	j.refImage = refImage
	j.Error = ""
	j.RevisedPrompt = ""
	j.PreviewKey = ""
	j.PreviewURL = ""
	j.Bytes = 0
	j.Ext = ""
	j.Saved = false
	j.StartedAt = time.Now()
	j.FinishedAt = time.Time{}
	return true
}

func (j *wordBookCoverJob) beginRun() bool {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status != wordBookCoverQueued {
		return false
	}
	j.Status = wordBookCoverRunning
	return true
}

func (j *wordBookCoverJob) finishDone(revised string, key, url, ext string, nbytes int) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = wordBookCoverDone
	j.RevisedPrompt = revised
	j.PreviewKey = key
	j.PreviewURL = url
	j.Ext = ext
	j.Bytes = nbytes
	j.FinishedAt = time.Now()
	j.refImage = nil
}

func (j *wordBookCoverJob) finishFailed(msg string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = wordBookCoverFailed
	j.Error = msg
	j.FinishedAt = time.Now()
	j.refImage = nil
}

func (j *wordBookCoverJob) markSaved() {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Saved = true
}

func resetWordBookCoverJob(bookID uint) {
	wordBookCoverJobs.Delete(bookID)
}

func (j *wordBookCoverJob) refImageCopy() []byte {
	j.mu.Lock()
	defer j.mu.Unlock()
	if len(j.refImage) == 0 {
		return nil
	}
	return append([]byte(nil), j.refImage...)
}

func runWordBookCoverJob(bookID uint, prompt, size string) {
	job := getWordBookCoverJob(bookID)
	if !job.beginRun() {
		return
	}
	refImage := job.refImageCopy()

	defer func() {
		if r := recover(); r != nil {
			logger.Error("wordbook cover job panic", zap.Uint("bookId", bookID), zap.Any("recover", r))
			job.finishFailed("内部错误")
		}
	}()

	cfg := imagegen.FromGlobal()
	if strings.TrimSpace(cfg.APIKey) == "" {
		job.finishFailed("未配置 IMAGE_GEN_API_KEY")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	genRes, err := imagegen.Generate(ctx, cfg, imagegen.GenerateRequest{
		Prompt:         prompt,
		Size:           size,
		ReferenceImage: refImage,
	})
	if err != nil {
		job.finishFailed(err.Error())
		return
	}

	finalData := genRes.Data
	finalExt := genRes.Ext
	if wm, wmExt, wmErr := imagegen.ApplyCoverWatermark(genRes.Data, genRes.Ext); wmErr != nil {
		logger.Warn("wordbook cover watermark failed, using original image",
			zap.Uint("bookId", bookID),
			zap.Error(wmErr),
		)
	} else {
		finalData = wm
		if wmExt != "" {
			finalExt = wmExt
		}
	}

	store := stores.Default()
	key := fmt.Sprintf("wordbooks/covers/pending/%d_%d%s", bookID, time.Now().Unix(), finalExt)
	if err := store.Write(key, bytes.NewReader(finalData)); err != nil {
		job.finishFailed("封面上传存储失败: " + err.Error())
		return
	}
	url := store.PublicURL(key)
	job.finishDone(genRes.RevisedPrompt, key, url, finalExt, len(finalData))
	logger.Info("wordbook cover generated",
		zap.Uint("bookId", bookID),
		zap.Int("bytes", len(finalData)),
	)
}

func parseCoverStartRequest(c *gin.Context, db *gorm.DB, book *models.WordBook) (prompt, size string, refImage []byte, errMsg string) {
	prompt = strings.TrimSpace(c.PostForm("prompt"))
	size = strings.TrimSpace(c.PostForm("size"))
	referenceBookID := 0

	if strings.HasPrefix(c.GetHeader("Content-Type"), "application/json") {
		var body struct {
			Prompt          string `json:"prompt"`
			Size            string `json:"size"`
			ReferenceBookID uint   `json:"referenceBookId"`
		}
		if err := c.ShouldBindJSON(&body); err == nil {
			if body.Prompt != "" {
				prompt = strings.TrimSpace(body.Prompt)
			}
			if body.Size != "" {
				size = strings.TrimSpace(body.Size)
			}
			if body.ReferenceBookID > 0 {
				referenceBookID = int(body.ReferenceBookID)
			}
		}
	} else {
		if v := strings.TrimSpace(c.PostForm("referenceBookId")); v != "" {
			if id, err := strconv.Atoi(v); err == nil && id > 0 {
				referenceBookID = id
			}
		}
	}

	if prompt == "" {
		prompt = imagegen.BuildPrompt(imagegen.DefaultPromptTemplate, book.Name, book.Level, book.Description)
	}
	if size == "" {
		size = imagegen.DefaultCoverSize
	} else {
		size = imagegen.NormalizeCoverSize(size)
	}

	file, header, fileErr := c.Request.FormFile("referenceImage")
	if fileErr == nil {
		defer file.Close()
		if header.Size > wordbookCoverMaxRefBytes {
			return "", "", nil, "参考图不能超过 8MB"
		}
		refImage, err := io.ReadAll(io.LimitReader(file, wordbookCoverMaxRefBytes+1))
		if err != nil {
			return "", "", nil, "读取参考图失败"
		}
		if len(refImage) > wordbookCoverMaxRefBytes {
			return "", "", nil, "参考图不能超过 8MB"
		}
	} else if referenceBookID > 0 {
		var refBook models.WordBook
		if err := db.Where("id = ?", referenceBookID).First(&refBook).Error; err != nil {
			return "", "", nil, "参考词库不存在"
		}
		coverURL := strings.TrimSpace(refBook.CoverURL)
		if coverURL == "" {
			return "", "", nil, "参考词库没有封面"
		}
		data, err := stores.ReadMediaURL(coverURL)
		if err != nil {
			return "", "", nil, "读取参考词库封面失败"
		}
		if len(data) > wordbookCoverMaxRefBytes {
			return "", "", nil, "参考图不能超过 8MB"
		}
		refImage = data
	}
	return prompt, size, refImage, ""
}

// adminStartWordBookCover POST — enqueue async cover generation (preview only).
func (h *Handlers) adminStartWordBookCover(c *gin.Context) {
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.FailI18n(c, "wordbook.invalid_id", nil)
		return
	}
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	var book models.WordBook
	if err := db.Where("id = ?", bookID).First(&book).Error; err != nil {
		response.FailI18n(c, "wordbook.not_found", err)
		return
	}

	cfg := imagegen.FromGlobal()
	if strings.TrimSpace(cfg.APIKey) == "" {
		response.FailI18n(c, "image.not_configured", nil)
		return
	}

	job := getWordBookCoverJob(bookID)
	snap := job.snapshot(false)
	status, _ := snap["status"].(string)
	if isWordBookCoverActive(status) {
		response.SuccessI18n(c, "wordbook.job_running", snap)
		return
	}

	prompt, size, refImage, errMsg := parseCoverStartRequest(c, db, &book)
	if errMsg != "" {
		response.FailI18n(c, "common.invalid_params", gin.H{"detail": errMsg})
		return
	}

	if !job.tryStart(prompt, size, refImage) {
		response.SuccessI18n(c, "wordbook.job_running", job.snapshot(false))
		return
	}

	go runWordBookCoverJob(bookID, prompt, size)

	response.SuccessI18n(c, "wordbook.cover_job_queued", gin.H{
		"bookId":  bookID,
		"status":  wordBookCoverQueued,
		"started": true,
	})
}

// adminWordBookCoverStatus GET — poll cover generation job.
func (h *Handlers) adminWordBookCoverStatus(c *gin.Context) {
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.FailI18n(c, "wordbook.invalid_id", nil)
		return
	}
	job := getWordBookCoverJob(bookID)
	response.SuccessI18n(c, "common.success", job.snapshot(false))
}

// adminListWordBookCoverJobs GET — active cover jobs for list polling.
func (h *Handlers) adminListWordBookCoverJobs(c *gin.Context) {
	reqCtx := c.Request.Context()
	jobs := make([]gin.H, 0, 4)
	wordBookCoverJobs.Range(func(key, value any) bool {
		if reqCtx.Err() != nil {
			return false
		}
		bookID, ok := key.(uint)
		if !ok {
			return true
		}
		job, ok := value.(*wordBookCoverJob)
		if !ok || job == nil {
			wordBookCoverJobs.Delete(key)
			return true
		}
		snap := job.snapshot(false)
		status, _ := snap["status"].(string)
		saved, _ := snap["saved"].(bool)
		if isWordBookCoverActive(status) || (status == wordBookCoverDone && !saved) {
			jobs = append(jobs, snap)
			return true
		}
		wordBookCoverJobs.Delete(bookID)
		return true
	})
	if reqCtx.Err() != nil {
		return
	}
	response.SuccessI18n(c, "common.success", gin.H{"jobs": jobs})
}

// adminSaveWordBookCover POST — persist preview image as official cover.
func (h *Handlers) adminSaveWordBookCover(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.FailI18n(c, "wordbook.invalid_id", nil)
		return
	}

	job := getWordBookCoverJob(bookID)
	snap := job.snapshot(false)
	status, _ := snap["status"].(string)
	if status != wordBookCoverDone {
		response.FailI18n(c, "wordbook.cover_preview_required", nil)
		return
	}
	previewURL, _ := snap["previewUrl"].(string)
	if previewURL == "" {
		response.FailI18n(c, "wordbook.no_preview_to_save", nil)
		return
	}

	if _, err := models.GetWordBookByID(db, bookID); err != nil {
		response.FailI18n(c, "wordbook.not_found", err)
		return
	}

	updates := map[string]any{"cover_url": previewURL}
	if user != nil {
		operator := user.DisplayName
		if operator == "" {
			operator = user.Username
		}
		if operator == "" {
			operator = fmt.Sprintf("%d", user.ID)
		}
		updates["update_by"] = operator
	}
	if err := models.UpdateWordBook(db, bookID, updates); err != nil {
		response.FailI18n(c, "wordbook.cover_update_failed", err)
		return
	}

	job.markSaved()
	response.SuccessI18n(c, "wordbook.cover_saved", gin.H{
		"bookId":   bookID,
		"coverUrl": previewURL,
		"saved":    true,
	})
}

// adminClearWordBookCover POST — remove official cover (restore no-cover state).
func (h *Handlers) adminClearWordBookCover(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	user := auth.CurrentUser(c)
	bookID, err := parseBookIDParam(c)
	if err != nil || bookID == 0 {
		response.FailI18n(c, "wordbook.invalid_id", nil)
		return
	}

	job := getWordBookCoverJob(bookID)
	snap := job.snapshot(false)
	status, _ := snap["status"].(string)
	if isWordBookCoverActive(status) {
		response.FailI18n(c, "wordbook.cover_job_running", nil)
		return
	}

	if _, err := models.GetWordBookByID(db, bookID); err != nil {
		response.FailI18n(c, "wordbook.not_found", err)
		return
	}

	updates := map[string]any{"cover_url": ""}
	if user != nil {
		operator := user.DisplayName
		if operator == "" {
			operator = user.Username
		}
		if operator == "" {
			operator = fmt.Sprintf("%d", user.ID)
		}
		updates["update_by"] = operator
	}
	if err := models.UpdateWordBook(db, bookID, updates); err != nil {
		response.FailI18n(c, "wordbook.cover_clear_failed", err)
		return
	}

	resetWordBookCoverJob(bookID)

	response.SuccessI18n(c, "wordbook.cover_cleared", gin.H{
		"bookId":   bookID,
		"coverUrl": "",
		"cleared":  true,
	})
}
