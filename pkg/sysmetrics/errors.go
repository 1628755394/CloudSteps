package sysmetrics

import "errors"

var (
	ErrInvalidMetricRange  = errors.New("invalid metric date range")
	ErrMetricRangeTooLarge = errors.New("metric date range exceeds 90 days")
)
