package handlers

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/synthesizer"
	"github.com/LingByte/ling-base/logger"
	"github.com/LingByte/ling-base/queue"
	memoryqueue "github.com/LingByte/ling-base/queue/memory"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	wordBookBatchAudioQueueName = "wordbook-batch-audio"
	defaultBooksPerAccount      = 9
)

type wordBookBatchAudioPayload struct {
	BookID  uint   `json:"bookId"`
	Keyword string `json:"keyword"`
}

var (
	wordBookBatchAudioQueueMu sync.Mutex
	wordBookBatchAudioQ       queue.Queue
	wordBookBatchAudioSched   *queue.Scheduler
	wordBookBatchAudioDB      *gorm.DB
	wordBookBatchAudioWorkers int
	wordBookBatchAudioRootCancel context.CancelFunc
)

func wordBookBatchAudioTaskID(bookID uint) string {
	return fmt.Sprintf("wb-batch-audio-%d", bookID)
}

// wordBookBatchAudioWorkerCount = QCloud 账号数 × 每账号并发词库数（默认 9）。
func wordBookBatchAudioWorkerCount() (workers, perAccount, accountCount int) {
	perAccount = defaultBooksPerAccount
	if v := os.Getenv("WORDBOOK_BATCH_AUDIO_PER_ACCOUNT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			perAccount = n
		}
	}
	accounts, err := synthesizer.LoadQCloudAccounts()
	accountCount = 1
	if err == nil && len(accounts) > 0 {
		accountCount = len(accounts)
	}
	workers = accountCount * perAccount
	return
}

// StartWordBookBatchAudioQueue 启动词库批量 TTS 任务队列（账号数×每账号并发）。
func StartWordBookBatchAudioQueue(db *gorm.DB) error {
	wordBookBatchAudioQueueMu.Lock()
	defer wordBookBatchAudioQueueMu.Unlock()
	if wordBookBatchAudioSched != nil {
		return nil
	}

	workers, perAccount, accountCount := wordBookBatchAudioWorkerCount()
	rootCtx, rootCancel := context.WithCancel(context.Background())
	q := memoryqueue.New(wordBookBatchAudioQueueName)
	sched, err := queue.NewScheduler(queue.SchedulerConfig{
		Queue: q,
		Handler: func(ctx context.Context, task *queue.Task) error {
			// 进程关停时 rootCtx 取消，打断正在合成的词库任务
			runCtx, cancel := context.WithCancel(ctx)
			defer cancel()
			go func() {
				select {
				case <-rootCtx.Done():
					cancel()
				case <-runCtx.Done():
				}
			}()
			return handleWordBookBatchAudioQueueTask(runCtx, task)
		},
		WorkerCount: workers,
		Mode:        queue.ModeFixedPool,
		OnRecover: func(count int) {
			logger.Info("wordbook batch-audio queue recovered", zap.Int("count", count))
		},
	})
	if err != nil {
		rootCancel()
		return err
	}
	if err := sched.Start(); err != nil {
		rootCancel()
		_ = q.Close()
		return err
	}

	wordBookBatchAudioQ = q
	wordBookBatchAudioSched = sched
	wordBookBatchAudioDB = db
	wordBookBatchAudioWorkers = workers
	wordBookBatchAudioRootCancel = rootCancel
	logger.Info("wordbook batch-audio queue started",
		zap.Int("workers", workers),
		zap.Int("accounts", accountCount),
		zap.Int("perAccount", perAccount),
	)
	return nil
}

// cancelAllWordBookBatchAudioJobs 取消排队中与运行中的全部词库批量任务。
func cancelAllWordBookBatchAudioJobs() {
	wordBookBatchAudioJobs.Range(func(_, value any) bool {
		job, ok := value.(*wordBookBatchAudioJob)
		if !ok || job == nil {
			return true
		}
		_ = job.requestStop()
		return true
	})
}

// StopWordBookBatchAudioQueue 停止队列：先取消所有任务，再关调度器（带超时，避免 Ctrl+C 卡死）。
func StopWordBookBatchAudioQueue() error {
	// 1) 在还持有 queue 引用时先取消全部任务（排队 + 运行中）
	cancelAllWordBookBatchAudioJobs()

	wordBookBatchAudioQueueMu.Lock()
	sched := wordBookBatchAudioSched
	q := wordBookBatchAudioQ
	rootCancel := wordBookBatchAudioRootCancel
	wordBookBatchAudioSched = nil
	wordBookBatchAudioQ = nil
	wordBookBatchAudioDB = nil
	wordBookBatchAudioRootCancel = nil
	wordBookBatchAudioQueueMu.Unlock()

	if rootCancel != nil {
		rootCancel()
	}

	// 2) 关闭队列，阻止再取新任务
	if q != nil {
		_ = q.Close()
	}

	// 3) 等待 worker 退出，但最多 5s（单次腾讯云请求可能卡很久）
	if sched != nil {
		done := make(chan struct{})
		go func() {
			_ = sched.Stop()
			close(done)
		}()
		select {
		case <-done:
			logger.Info("wordbook batch-audio queue stopped")
		case <-time.After(5 * time.Second):
			logger.Warn("wordbook batch-audio queue stop timed out; in-flight TTS may still finish in background")
		}
	}
	return nil
}

func enqueueWordBookBatchAudio(bookID uint, keyword string, total int) (map[string]any, error) {
	wordBookBatchAudioQueueMu.Lock()
	q := wordBookBatchAudioQ
	db := wordBookBatchAudioDB
	workers := wordBookBatchAudioWorkers
	wordBookBatchAudioQueueMu.Unlock()
	if q == nil || db == nil {
		return nil, fmt.Errorf("批量音频队列未启动")
	}

	job := getWordBookBatchAudioJob(bookID)
	if !job.tryQueue(total, keyword, wordBookBatchAudioTaskID(bookID)) {
		return job.snapshot(), fmt.Errorf("任务进行中")
	}

	payload, err := queue.EncodePayload(wordBookBatchAudioPayload{
		BookID:  bookID,
		Keyword: keyword,
	})
	if err != nil {
		job.finish(batchAudioFailed, "编码任务失败")
		return job.snapshot(), err
	}

	task := &queue.Task{
		ID:         wordBookBatchAudioTaskID(bookID),
		Queue:      wordBookBatchAudioQueueName,
		Kind:       "wordbook-batch-audio",
		JobID:      fmt.Sprintf("book-%d", bookID),
		Priority:   0,
		Payload:    payload,
		MaxRetries: 0,
	}
	if err := q.Enqueue(context.Background(), task); err != nil {
		job.finish(batchAudioFailed, err.Error())
		return job.snapshot(), err
	}

	out := job.snapshot()
	out["started"] = true
	out["queued"] = true
	out["queueWorkers"] = workers
	if pos, posErr := q.Position(context.Background(), task.ID); posErr == nil && pos >= 0 {
		out["queuePosition"] = pos
	}
	if stats, statsErr := q.Stats(context.Background()); statsErr == nil {
		out["queuePending"] = stats.Pending
		out["queueRunning"] = stats.Running
	}
	return out, nil
}

func cancelQueuedWordBookBatchAudio(taskID string) {
	wordBookBatchAudioQueueMu.Lock()
	q := wordBookBatchAudioQ
	wordBookBatchAudioQueueMu.Unlock()
	if q == nil || taskID == "" {
		return
	}
	_ = q.Cancel(context.Background(), taskID)
}

func handleWordBookBatchAudioQueueTask(ctx context.Context, task *queue.Task) error {
	payload, err := queue.DecodePayload[wordBookBatchAudioPayload](task)
	if err != nil {
		return err
	}

	wordBookBatchAudioQueueMu.Lock()
	db := wordBookBatchAudioDB
	wordBookBatchAudioQueueMu.Unlock()
	if db == nil {
		return fmt.Errorf("db unavailable")
	}

	job := getWordBookBatchAudioJob(payload.BookID)
	jobCtx, ok := job.beginRun()
	if !ok {
		// 排队期间已被取消
		return context.Canceled
	}

	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	stopCh := make(chan struct{})
	go func() {
		select {
		case <-jobCtx.Done():
			cancel()
		case <-runCtx.Done():
		case <-stopCh:
		}
	}()

	runWordBookBatchAudioJob(runCtx, db, payload.BookID, payload.Keyword, job)
	close(stopCh)

	job.mu.Lock()
	status := job.Status
	errMsg := job.Error
	job.mu.Unlock()

	switch status {
	case batchAudioStopped:
		return context.Canceled
	case batchAudioFailed:
		if errMsg != "" {
			return fmt.Errorf("%s", errMsg)
		}
		return fmt.Errorf("batch audio failed")
	default:
		return nil
	}
}
