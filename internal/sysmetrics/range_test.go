package sysmetrics

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/stretchr/testify/require"
)

func TestFillDailyRangeInsertsZeroDays(t *testing.T) {
	loc := time.UTC
	from := time.Date(2026, 8, 16, 12, 0, 0, 0, loc)
	to := time.Date(2026, 8, 18, 9, 0, 0, 0, loc)
	got := FillDailyRange(from, to, []models.SysMetric{
		{MetricDate: "2026-08-17", PV: 9},
	})
	require.Equal(t, []string{"2026-08-16", "2026-08-17", "2026-08-18"}, datesOf(got))
	require.Equal(t, int64(0), got[0].PV)
	require.Equal(t, int64(9), got[1].PV)
	require.Equal(t, int64(0), got[2].PV)
}

func datesOf(rows []models.SysMetric) []string {
	out := make([]string, len(rows))
	for i, row := range rows {
		out[i] = row.MetricDate
	}
	return out
}
