package models

import (
	"testing"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testSysMetricsDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:sysmetrics_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&SysMetric{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestSysMetric_TableName(t *testing.T) {
	if (SysMetric{}).TableName() != constants.SYS_METRIC_TABLE_NAME {
		t.Fatalf("SysMetric table name = %q, want %q",
			(SysMetric{}).TableName(), constants.SYS_METRIC_TABLE_NAME)
	}
}

func TestMax64(t *testing.T) {
	cases := []struct {
		a, b, want int64
	}{
		{1, 2, 2},
		{5, 5, 5},
		{-1, 0, 0},
		{-3, -5, -3},
	}
	for _, tc := range cases {
		if got := max64(tc.a, tc.b); got != tc.want {
			t.Fatalf("max64(%d,%d)=%d want=%d", tc.a, tc.b, got, tc.want)
		}
	}
}

func TestApplySysMetricFlush_emptyDateNoop(t *testing.T) {
	db := testSysMetricsDB(t)
	if err := ApplySysMetricFlush(db, "", SysMetricDelta{PV: 1}, 1, 1, 1, 1, 1, true); err != nil {
		t.Fatalf("empty date should be noop, got: %v", err)
	}
	var count int64
	db.Model(&SysMetric{}).Count(&count)
	if count != 0 {
		t.Fatalf("expected no rows for empty date, got %d", count)
	}
}

func TestApplySysMetricFlush_insertAndAccumulate(t *testing.T) {
	db := testSysMetricsDB(t)
	// First flush inserts
	if err := ApplySysMetricFlush(db, "2026-01-01",
		SysMetricDelta{PV: 10, Requests: 100, Errors: 1, ClientErrors: 2},
		5, 3, 12.0, 50.0, 90.0, true); err != nil {
		t.Fatalf("first flush: %v", err)
	}
	var row SysMetric
	if err := db.Where("metric_date = ?", "2026-01-01").First(&row).Error; err != nil {
		t.Fatalf("find: %v", err)
	}
	if row.PV != 10 || row.Requests != 100 || row.Errors != 1 || row.ClientErrors != 2 {
		t.Fatalf("unexpected counters: %+v", row)
	}
	if row.UV != 5 || row.IP != 3 {
		t.Fatalf("unexpected uv/ip: %+v", row)
	}
	if row.P50Ms != 12.0 || row.P95Ms != 50.0 || row.P99Ms != 90.0 {
		t.Fatalf("unexpected latency: %+v", row)
	}

	// Second flush accumulates counters, takes max uv/ip, overwrites latency
	if err := ApplySysMetricFlush(db, "2026-01-01",
		SysMetricDelta{PV: 5, Requests: 50, Errors: 2, ClientErrors: 1},
		8, 2, 15.0, 60.0, 95.0, true); err != nil {
		t.Fatalf("second flush: %v", err)
	}
	var row2 SysMetric
	if err := db.Where("metric_date = ?", "2026-01-01").First(&row2).Error; err != nil {
		t.Fatal(err)
	}
	if row2.PV != 15 || row2.Requests != 150 || row2.Errors != 3 || row2.ClientErrors != 3 {
		t.Fatalf("unexpected accumulated counters: %+v", row2)
	}
	if row2.UV != 8 || row2.IP != 3 {
		t.Fatalf("unexpected max uv/ip: %+v", row2)
	}
	if row2.P50Ms != 15.0 || row2.P95Ms != 60.0 || row2.P99Ms != 95.0 {
		t.Fatalf("unexpected overwritten latency: %+v", row2)
	}

	// Third flush without latency update keeps previous latency
	if err := ApplySysMetricFlush(db, "2026-01-01",
		SysMetricDelta{PV: 1, Requests: 1, Errors: 0, ClientErrors: 0},
		6, 1, 99.0, 99.0, 99.0, false); err != nil {
		t.Fatalf("third flush: %v", err)
	}
	var row3 SysMetric
	if err := db.Where("metric_date = ?", "2026-01-01").First(&row3).Error; err != nil {
		t.Fatal(err)
	}
	if row3.P50Ms != 15.0 || row3.P95Ms != 60.0 || row3.P99Ms != 95.0 {
		t.Fatalf("latency should be unchanged: %+v", row3)
	}
	if row3.PV != 16 {
		t.Fatalf("pv should accumulate: %+v", row3)
	}
}

func TestApplySysMetricFlush_negativeDeltasClamped(t *testing.T) {
	db := testSysMetricsDB(t)
	if err := ApplySysMetricFlush(db, "2026-02-02",
		SysMetricDelta{PV: -5, Requests: -10, Errors: -1, ClientErrors: -2},
		-3, -1, 0, 0, 0, true); err != nil {
		t.Fatalf("flush: %v", err)
	}
	var row SysMetric
	if err := db.Where("metric_date = ?", "2026-02-02").First(&row).Error; err != nil {
		t.Fatal(err)
	}
	if row.PV != 0 || row.Requests != 0 || row.Errors != 0 || row.ClientErrors != 0 {
		t.Fatalf("negative deltas should be clamped to 0: %+v", row)
	}
	if row.UV != 0 || row.IP != 0 {
		t.Fatalf("negative uv/ip should be clamped to 0: %+v", row)
	}
}

func TestListSysMetrics_rangeAndOrder(t *testing.T) {
	db := testSysMetricsDB(t)
	dates := []string{"2026-03-01", "2026-03-02", "2026-03-03", "2026-03-05"}
	for _, d := range dates {
		if err := ApplySysMetricFlush(db, d, SysMetricDelta{PV: 1}, 1, 1, 1, 1, 1, true); err != nil {
			t.Fatalf("flush %s: %v", d, err)
		}
	}

	// Inclusive range
	rows, err := ListSysMetrics(db, "2026-03-02", "2026-03-03")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(rows))
	}
	if rows[0].MetricDate != "2026-03-02" || rows[1].MetricDate != "2026-03-03" {
		t.Fatalf("expected ascending order: %+v", rows)
	}

	// Full range
	all, err := ListSysMetrics(db, "2026-03-01", "2026-03-31")
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 4 {
		t.Fatalf("expected 4 rows, got %d", len(all))
	}

	// Empty range
	none, err := ListSysMetrics(db, "2026-04-01", "2026-04-30")
	if err != nil {
		t.Fatal(err)
	}
	if len(none) != 0 {
		t.Fatalf("expected 0 rows, got %d", len(none))
	}
}
