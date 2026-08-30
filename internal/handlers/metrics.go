package handlers

import (
	"errors"
	"strconv"
	"time"

	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"github.com/LingByte/CloudStepsGo/pkg/sysmetrics"
	"github.com/LingByte/ling-base/apidocs/humax"

	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
)

func (h *Handlers) registerMetricsRoutes(r *humax.Group) {
	g := r.Group("metrics")
	g.Use(auth.Required, auth.AdminRequired)
	{
		g.GET("/daily", h.handleAdminDailyMetrics)
		g.GET("/live", h.handleAdminLiveMetrics)
	}
}

// GET /metrics/daily?days=14
// GET /metrics/daily?from=2026-08-01&to=2026-08-14
func (h *Handlers) handleAdminDailyMetrics(c *gin.Context) {
	if h.sysMetrics == nil {
		response.FailI18n(c, "metrics.unavailable", nil)
		return
	}

	fromQ := c.Query("from")
	toQ := c.Query("to")
	if fromQ != "" || toQ != "" {
		if fromQ == "" || toQ == "" {
			response.FailI18n(c, "coaching.need_range", nil)
			return
		}
		from, err := parseMetricDate(fromQ)
		if err != nil {
			response.FailI18n(c, "coaching.invalid_from_date", err)
			return
		}
		to, err := parseMetricDate(toQ)
		if err != nil {
			response.FailI18n(c, "coaching.invalid_to_date", err)
			return
		}
		today := dateOnly(time.Now())
		if to.After(today) {
			to = today
		}
		rows, err := h.sysMetrics.ListRange(from, to)
		if err != nil {
			if errors.Is(err, sysmetrics.ErrInvalidMetricRange) {
				response.FailI18n(c, "coaching.end_before_start", err)
				return
			}
			if errors.Is(err, sysmetrics.ErrMetricRangeTooLarge) {
				response.FailI18n(c, "coaching.range_too_long", err)
				return
			}
			response.FailI18n(c, "common.query_failed", err)
			return
		}
		response.SuccessI18n(c, "common.ok", gin.H{
			"list": rows,
			"from": from.Format("2006-01-02"),
			"to":   to.Format("2006-01-02"),
			"days": len(rows),
		})
		return
	}

	days, _ := strconv.Atoi(c.DefaultQuery("days", "14"))
	if days < 1 {
		days = 14
	}
	if days > 90 {
		days = 90
	}
	rows, err := h.sysMetrics.ListDays(days)
	if err != nil {
		response.FailI18n(c, "common.query_failed", err)
		return
	}
	response.SuccessI18n(c, "common.ok", gin.H{
		"list": rows,
		"days": days,
	})
}

// GET /metrics/live
func (h *Handlers) handleAdminLiveMetrics(c *gin.Context) {
	if h.sysMetrics == nil {
		response.FailI18n(c, "metrics.unavailable", nil)
		return
	}
	response.SuccessI18n(c, "common.ok", h.sysMetrics.Live())
}

func parseMetricDate(raw string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", raw, time.Local)
}

func dateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}
