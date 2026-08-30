package models

import (
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SysMetric is one calendar day's API traffic/health snapshot.
type SysMetric struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	MetricDate string    `json:"metricDate" gorm:"size:10;uniqueIndex;not null;comment:YYYY-MM-DD"`
	PV         int64     `json:"pv" gorm:"not null;default:0;comment:API page-view / request hits"`
	UV         int64     `json:"uv" gorm:"not null;default:0;comment:Unique logged-in users (HLL)"`
	IP         int64     `json:"ip" gorm:"not null;default:0;comment:Unique client IPs (HLL)"`
	Requests     int64     `json:"requests" gorm:"not null;default:0"`
	Errors       int64     `json:"errors" gorm:"not null;default:0;comment:HTTP 5xx count"`
	ClientErrors int64     `json:"clientErrors" gorm:"not null;default:0;comment:HTTP 4xx count"`
	P50Ms        float64   `json:"p50Ms" gorm:"column:p50_ms;not null;default:0;comment:Response time P50 ms"`
	P95Ms      float64   `json:"p95Ms" gorm:"column:p95_ms;not null;default:0;comment:Response time P95 ms"`
	P99Ms      float64   `json:"p99Ms" gorm:"column:p99_ms;not null;default:0;comment:Response time P99 ms"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (SysMetric) TableName() string { return constants.SYS_METRIC_TABLE_NAME }

// SysMetricDelta is the counter increment since the last flush.
type SysMetricDelta struct {
	PV           int64
	Requests     int64
	Errors       int64
	ClientErrors int64
}

// ApplySysMetricFlush upserts a day's row: counters add deltas, UV/IP take the
// larger estimate, latency overwrites when this flush observed requests.
func ApplySysMetricFlush(db *gorm.DB, date string, delta SysMetricDelta, uv, ip int64, p50, p95, p99 float64, updateLatency bool) error {
	if date == "" {
		return nil
	}
	now := time.Now()
	row := SysMetric{
		MetricDate:   date,
		PV:           max64(delta.PV, 0),
		UV:           max64(uv, 0),
		IP:           max64(ip, 0),
		Requests:     max64(delta.Requests, 0),
		Errors:       max64(delta.Errors, 0),
		ClientErrors: max64(delta.ClientErrors, 0),
		P50Ms:        p50,
		P95Ms:        p95,
		P99Ms:        p99,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	expr := map[string]any{
		"pv":            gorm.Expr("pv + ?", row.PV),
		"requests":      gorm.Expr("requests + ?", row.Requests),
		"errors":        gorm.Expr("errors + ?", row.Errors),
		"client_errors": gorm.Expr("client_errors + ?", row.ClientErrors),
		"uv":         gorm.Expr("CASE WHEN ? > uv THEN ? ELSE uv END", row.UV, row.UV),
		"ip":         gorm.Expr("CASE WHEN ? > ip THEN ? ELSE ip END", row.IP, row.IP),
		"updated_at": now,
	}
	if updateLatency {
		expr["p50_ms"] = row.P50Ms
		expr["p95_ms"] = row.P95Ms
		expr["p99_ms"] = row.P99Ms
	}

	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "metric_date"}},
		DoUpdates: clause.Assignments(expr),
	}).Create(&row).Error
}

func max64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

// ListSysMetrics returns rows in [from, to] inclusive, ordered by date.
func ListSysMetrics(db *gorm.DB, from, to string) ([]SysMetric, error) {
	var rows []SysMetric
	err := db.Where("metric_date >= ? AND metric_date <= ?", from, to).
		Order("metric_date ASC").
		Find(&rows).Error
	return rows, err
}
