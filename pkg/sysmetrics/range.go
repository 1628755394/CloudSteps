package sysmetrics

import (
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
)

// FillDailyRange inserts zero rows so charts have one point per calendar day.
func FillDailyRange(from, to time.Time, rows []models.SysMetric) []models.SysMetric {
	from = dateOnly(from)
	to = dateOnly(to)
	if to.Before(from) {
		return nil
	}
	byDate := make(map[string]models.SysMetric, len(rows))
	for _, row := range rows {
		byDate[row.MetricDate] = row
	}
	n := int(to.Sub(from).Hours()/24) + 1
	out := make([]models.SysMetric, 0, n)
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		if row, ok := byDate[key]; ok {
			out = append(out, row)
			continue
		}
		out = append(out, models.SysMetric{MetricDate: key})
	}
	return out
}

func dateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}
