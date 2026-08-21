package sysmetrics

import (
	"strconv"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/ling-base/common/stats"
	ginstats "github.com/LingByte/ling-base/common/stats/gin"
	"github.com/LingByte/ling-base/common/stats/memory"
	"github.com/LingByte/ling-base/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const defaultFlushEvery = 5 * time.Minute

// Service holds the in-process stats collector and flushes daily rows to MySQL.
type Service struct {
	db        *gorm.DB
	collector stats.Collector
	wm        *stats.WebsiteMetrics
	qps       *qpsTracker

	mu   sync.Mutex
	last lastFlush

	stop      chan struct{}
	done      chan struct{}
	closeOnce sync.Once
}

type lastFlush struct {
	date         string
	pv           int64
	requests     int64
	errors       int64
	clientErrors int64
}

// New starts memory collection and a periodic DB flush.
func New(db *gorm.DB) *Service {
	return NewWithFlush(db, defaultFlushEvery)
}

// NewWithFlush is like New with a custom flush interval (0 disables the ticker).
func NewWithFlush(db *gorm.DB, every time.Duration) *Service {
	if db != nil {
		if err := db.AutoMigrate(&models.SysMetric{}); err != nil {
			logger.Warn("sysmetrics migrate failed", zap.Error(err))
		}
	}
	col := memory.New(memory.WithReservoirTimer(4096))
	s := &Service{
		db:        db,
		collector: col,
		wm:        stats.NewWebsiteMetrics(col),
		qps:       newQPSTracker(),
		stop:      make(chan struct{}),
		done:      make(chan struct{}),
	}
	if every > 0 {
		go s.loop(every)
	} else {
		close(s.done)
	}
	return s
}

// Middleware records API PV/UV/IP/latency/status codes after each request.
func (s *Service) Middleware() gin.HandlerFunc {
	statsMw := ginstats.Middleware(s.wm, ginstats.Config{
		GetUserID: func(c *gin.Context) string {
			u := models.CurrentUser(c)
			if u == nil || u.ID == 0 {
				return ""
			}
			return strconv.FormatUint(uint64(u.ID), 10)
		},
	})
	return func(c *gin.Context) {
		statsMw(c)
		s.qps.Record()
		status := c.Writer.Status()
		if status >= 400 && status < 500 {
			date := time.Now().Format("2006-01-02")
			s.collector.Counter("client_errors:" + date).Incr()
		}
	}
}

// Flush writes current memory totals to sys_metrics.
func (s *Service) Flush() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.flushLocked(time.Now())
}

// Close flushes once more and stops the ticker.
func (s *Service) Close() error {
	s.closeOnce.Do(func() {
		close(s.stop)
	})
	<-s.done
	return s.Flush()
}

// ListDays flushes hot counters then returns one row per day for the chart.
func (s *Service) ListDays(days int) ([]DailyMetric, error) {
	if days < 1 {
		days = 14
	}
	if days > 90 {
		days = 90
	}
	now := time.Now()
	from := now.AddDate(0, 0, 1-days)
	return s.ListRange(from, now)
}

// ListRange returns daily metrics for [from, to] inclusive (calendar days, max 90).
func (s *Service) ListRange(from, to time.Time) ([]DailyMetric, error) {
	from = dateOnly(from)
	to = dateOnly(to)
	if to.Before(from) {
		return nil, ErrInvalidMetricRange
	}
	span := int(to.Sub(from).Hours()/24) + 1
	if span > 90 {
		return nil, ErrMetricRangeTooLarge
	}
	if err := s.Flush(); err != nil {
		return nil, err
	}
	fromStr := from.Format("2006-01-02")
	toStr := to.Format("2006-01-02")
	rows, err := models.ListSysMetrics(s.db, fromStr, toStr)
	if err != nil {
		return nil, err
	}
	filled := FillDailyRange(from, to, rows)
	newUsers, err := models.CountNewUsersByDay(s.db, fromStr, toStr)
	if err != nil {
		return nil, err
	}
	out := make([]DailyMetric, 0, len(filled))
	for _, row := range filled {
		out = append(out, DailyMetric{
			SysMetric: row,
			NewUsers:  newUsers[row.MetricDate],
		})
	}
	return out, nil
}

// Live returns realtime counters for dashboard cards.
func (s *Service) Live() LiveMetric {
	now := time.Now()
	date := now.Format("2006-01-02")
	month := now.Format("2006-01")
	return LiveMetric{
		QPS:          s.qps.Rate(),
		MAU:          int64(s.wm.GetMAU(month)),
		DAU:          int64(s.wm.GetDAU(date)),
		Requests:     s.collector.Counter("requests:" + date).Get(),
		Errors:       s.collector.Counter("errors:" + date).Get(),
		ClientErrors: s.collector.Counter("client_errors:" + date).Get(),
	}
}

func (s *Service) loop(every time.Duration) {
	defer close(s.done)
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-t.C:
			if err := s.Flush(); err != nil {
				logger.Warn("sysmetrics flush failed", zap.Error(err))
			}
		}
	}
}

func (s *Service) flushLocked(now time.Time) error {
	today := now.Format("2006-01-02")
	if s.last.date != "" && s.last.date != today {
		if err := s.flushDateLocked(s.last.date); err != nil {
			return err
		}
	}
	return s.flushDateLocked(today)
}

func (s *Service) flushDateLocked(date string) error {
	snap := Collect(s.collector, s.wm, date)
	if s.last.date != date {
		s.last = lastFlush{date: date}
	}
	deltaPV := snap.PV - s.last.pv
	deltaReq := snap.Requests - s.last.requests
	deltaErr := snap.Errors - s.last.errors
	deltaClient := snap.ClientErrors - s.last.clientErrors
	if deltaPV < 0 {
		deltaPV = 0
	}
	if deltaReq < 0 {
		deltaReq = 0
	}
	if deltaErr < 0 {
		deltaErr = 0
	}
	if deltaClient < 0 {
		deltaClient = 0
	}
	s.last.pv = snap.PV
	s.last.requests = snap.Requests
	s.last.errors = snap.Errors
	s.last.clientErrors = snap.ClientErrors

	if deltaPV == 0 && deltaReq == 0 && deltaErr == 0 && deltaClient == 0 {
		return nil
	}
	return models.ApplySysMetricFlush(
		s.db,
		date,
		models.SysMetricDelta{
			PV:           deltaPV,
			Requests:     deltaReq,
			Errors:       deltaErr,
			ClientErrors: deltaClient,
		},
		snap.UV,
		snap.IP,
		snap.RTP50Ms,
		snap.RTP95Ms,
		snap.RTP99Ms,
		deltaReq > 0,
	)
}
