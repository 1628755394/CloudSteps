package sysmetrics

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Discard,
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.SysMetric{}, &models.User{}))
	return db
}

func TestFlushAddsCounterDeltas(t *testing.T) {
	db := testDB(t)
	s := NewWithFlush(db, 0)
	t.Cleanup(func() { _ = s.Close() })

	date := time.Now().Format("2006-01-02")
	s.wm.RecordPVTotal(date)
	s.wm.RecordPVTotal(date)
	s.wm.RecordRequest(date)
	s.wm.RecordRequest(date)
	s.wm.RecordUV(date, "u1")
	s.wm.RecordIP(date, "10.0.0.1")
	s.wm.RecordResponseTimeMs(date, 12)

	require.NoError(t, s.Flush())

	var row models.SysMetric
	require.NoError(t, db.Where("metric_date = ?", date).First(&row).Error)
	require.Equal(t, int64(2), row.PV)
	require.Equal(t, int64(2), row.Requests)
	require.Equal(t, int64(1), row.UV)
	require.Equal(t, int64(1), row.IP)
	require.InDelta(t, 12, row.P50Ms, 0.1)

	s.wm.RecordPVTotal(date)
	s.wm.RecordRequest(date)
	require.NoError(t, s.Flush())
	require.NoError(t, db.Where("metric_date = ?", date).First(&row).Error)
	require.Equal(t, int64(3), row.PV)
	require.Equal(t, int64(3), row.Requests)
}

func TestFlushDoesNotDoubleCount(t *testing.T) {
	db := testDB(t)
	s := NewWithFlush(db, 0)
	t.Cleanup(func() { _ = s.Close() })

	date := time.Now().Format("2006-01-02")
	s.wm.RecordPVTotal(date)
	s.wm.RecordRequest(date)
	require.NoError(t, s.Flush())
	require.NoError(t, s.Flush())

	var row models.SysMetric
	require.NoError(t, db.Where("metric_date = ?", date).First(&row).Error)
	require.Equal(t, int64(1), row.PV)
	require.Equal(t, int64(1), row.Requests)
}

func TestListDaysFillsRange(t *testing.T) {
	db := testDB(t)
	s := NewWithFlush(db, 0)
	t.Cleanup(func() { _ = s.Close() })

	date := time.Now().Format("2006-01-02")
	s.wm.RecordPVTotal(date)
	s.wm.RecordRequest(date)
	rows, err := s.ListDays(3)
	require.NoError(t, err)
	require.Len(t, rows, 3)
	require.Equal(t, date, rows[2].MetricDate)
	require.Equal(t, int64(1), rows[2].PV)
	require.Equal(t, int64(1), rows[2].Requests)
}

func TestFlushClientErrors(t *testing.T) {
	db := testDB(t)
	s := NewWithFlush(db, 0)
	t.Cleanup(func() { _ = s.Close() })

	date := time.Now().Format("2006-01-02")
	s.collector.Counter("client_errors:" + date).Incr()
	s.collector.Counter("client_errors:" + date).Incr()
	s.wm.RecordRequest(date)
	require.NoError(t, s.Flush())

	var row models.SysMetric
	require.NoError(t, db.Where("metric_date = ?", date).First(&row).Error)
	require.Equal(t, int64(2), row.ClientErrors)
	require.Equal(t, int64(1), row.Requests)
}
