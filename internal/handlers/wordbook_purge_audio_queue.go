package handlers

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/LingByte/ling-base/common/logger"
	"github.com/LingByte/ling-base/queue"
	memoryqueue "github.com/LingByte/ling-base/queue/memory"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	wordBookPurgeAudioQueueName = "wordbook-purge-audio"
	defaultPurgeAudioWorkers    = 16
)

type wordBookPurgeAudioPayload struct {
	BookID uint `json:"bookId"`
}

var (
	wordBookPurgeAudioQueueMu sync.Mutex
	wordBookPurgeAudioQ       queue.Queue
	wordBookPurgeAudioSched   *queue.Scheduler
	wordBookPurgeAudioDB      *gorm.DB
	wordBookPurgeAudioWorkers int
	wordBookPurgeAudioRootCancel context.CancelFunc
)

func wordBookPurgeAudioTaskID(bookID uint) string {
	return fmt.Sprintf("wb-purge-audio-%d", bookID)
}

func wordBookPurgeAudioWorkerCount() int {
	workers := defaultPurgeAudioWorkers
	if v := os.Getenv("WORDBOOK_PURGE_AUDIO_WORKERS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			workers = n
		}
	}
	return workers
}

// StartWordBookPurgeAudioQueue 启动词库清除音频队列（默认 16 并发，与 TTS 队列独立）。
func StartWordBookPurgeAudioQueue(db *gorm.DB) error {
	wordBookPurgeAudioQueueMu.Lock()
	defer wordBookPurgeAudioQueueMu.Unlock()
	if wordBookPurgeAudioSched != nil {
		return nil
	}

	workers := wordBookPurgeAudioWorkerCount()
	rootCtx, rootCancel := context.WithCancel(context.Background())
	q := memoryqueue.New(wordBookPurgeAudioQueueName)
	sched, err := queue.NewScheduler(queue.SchedulerConfig{
		Queue: q,
		Handler: func(ctx context.Context, task *queue.Task) error {
			runCtx, cancel := context.WithCancel(ctx)
			defer cancel()
			go func() {
				select {
				case <-rootCtx.Done():
					cancel()
				case <-runCtx.Done():
				}
			}()
			return handleWordBookPurgeAudioQueueTask(runCtx, task)
		},
		WorkerCount: workers,
		Mode:        queue.ModeFixedPool,
		OnRecover: func(count int) {
			logger.Info("wordbook purge-audio queue recovered", zap.Int("count", count))
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

	wordBookPurgeAudioQ = q
	wordBookPurgeAudioSched = sched
	wordBookPurgeAudioDB = db
	wordBookPurgeAudioWorkers = workers
	wordBookPurgeAudioRootCancel = rootCancel
	logger.Info("wordbook purge-audio queue started", zap.Int("workers", workers))
	return nil
}

// StopWordBookPurgeAudioQueue 停止清除音频队列。
func StopWordBookPurgeAudioQueue() error {
	wordBookPurgeAudioQueueMu.Lock()
	sched := wordBookPurgeAudioSched
	q := wordBookPurgeAudioQ
	rootCancel := wordBookPurgeAudioRootCancel
	wordBookPurgeAudioSched = nil
	wordBookPurgeAudioQ = nil
	wordBookPurgeAudioDB = nil
	wordBookPurgeAudioRootCancel = nil
	wordBookPurgeAudioQueueMu.Unlock()

	if rootCancel != nil {
		rootCancel()
	}
	if q != nil {
		_ = q.Close()
	}
	if sched != nil {
		done := make(chan struct{})
		go func() {
			_ = sched.Stop()
			close(done)
		}()
		select {
		case <-done:
			logger.Info("wordbook purge-audio queue stopped")
		case <-time.After(5 * time.Second):
			logger.Warn("wordbook purge-audio queue stop timed out")
		}
	}
	return nil
}

func enqueueWordBookPurgeAudio(bookID uint, total int) (map[string]any, error) {
	wordBookPurgeAudioQueueMu.Lock()
	q := wordBookPurgeAudioQ
	workers := wordBookPurgeAudioWorkers
	wordBookPurgeAudioQueueMu.Unlock()
	if q == nil {
		return nil, fmt.Errorf("清除音频队列未启动")
	}

	job := getWordBookPurgeJob(bookID)
	if !job.tryQueue(total, wordBookPurgeAudioTaskID(bookID)) {
		return job.snapshot(), fmt.Errorf("任务进行中")
	}

	payload, err := queue.EncodePayload(wordBookPurgeAudioPayload{BookID: bookID})
	if err != nil {
		job.finish(wordBookPurgeFailed, "编码任务失败")
		return job.snapshot(), err
	}

	task := &queue.Task{
		ID:         wordBookPurgeAudioTaskID(bookID),
		Queue:      wordBookPurgeAudioQueueName,
		Kind:       "wordbook-purge-audio",
		JobID:      fmt.Sprintf("book-%d", bookID),
		Priority:   0,
		Payload:    payload,
		MaxRetries: 0,
	}
	if err := q.Enqueue(context.Background(), task); err != nil {
		job.finish(wordBookPurgeFailed, err.Error())
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

func handleWordBookPurgeAudioQueueTask(ctx context.Context, task *queue.Task) error {
	payload, err := queue.DecodePayload[wordBookPurgeAudioPayload](task)
	if err != nil {
		return err
	}

	wordBookPurgeAudioQueueMu.Lock()
	db := wordBookPurgeAudioDB
	wordBookPurgeAudioQueueMu.Unlock()
	if db == nil {
		return fmt.Errorf("db unavailable")
	}

	job := getWordBookPurgeJob(payload.BookID)
	if !job.beginRun() {
		return context.Canceled
	}

	runWordBookPurgeAudioJob(db, payload.BookID, job)

	job.mu.Lock()
	status := job.Status
	errMsg := job.Error
	job.mu.Unlock()

	if status == wordBookPurgeFailed {
		if errMsg != "" {
			return fmt.Errorf("%s", errMsg)
		}
		return fmt.Errorf("purge audio failed")
	}
	return nil
}
