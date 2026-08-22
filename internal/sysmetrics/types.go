package sysmetrics

import "github.com/LingByte/CloudStepsGo/internal/models"

// DailyMetric is one calendar day of stored metrics plus derived signup counts.
type DailyMetric struct {
	models.SysMetric
	NewUsers int64 `json:"newUsers"`
}

// LiveMetric is the in-memory snapshot for realtime dashboard cards.
type LiveMetric struct {
	QPS          float64 `json:"qps"`
	MAU          int64   `json:"mau"`
	DAU          int64   `json:"dau"`
	Requests     int64   `json:"requestsToday"`
	Errors       int64   `json:"errorsToday"`
	ClientErrors int64   `json:"clientErrorsToday"`
}
