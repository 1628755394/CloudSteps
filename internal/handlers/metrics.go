package handlers

import (
	"errors"
	"strconv"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/internal/sysmetrics"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
)

func (h *Handlers) registerMetricsRoutes(r *gin.RouterGroup) {
	g := r.Group("metrics")
	g.Use(models.AuthRequired, adminOnly())
	{
		g.GET("/daily", h.handleAdminDailyMetrics)
		g.GET("/live", h.handleAdminLiveMetrics)
	}
}

// GET /metrics/daily?days=14
// GET /metrics/daily?from=2026-08-01&to=2026-08-14
func (h *Handlers) handleAdminDailyMetrics(c *gin.Context) {
	if h.sysMetrics == nil {
		response.Fail(c, "metrics unavailable", nil)
		return
	}

	fromQ := c.Query("from")
	toQ := c.Query("to")
	if fromQ != "" || toQ != "" {
		if fromQ == "" || toQ == "" {
			response.Fail(c, "from 与 to 需同时指定", nil)
			return
		}
		from, err := parseMetricDate(fromQ)
		if err != nil {
			response.Fail(c, "from 日期格式无效", err)
			return
		}
		to, err := parseMetricDate(toQ)
		if err != nil {
			response.Fail(c, "to 日期格式无效", err)
			return
		}
		today := dateOnly(time.Now())
		if to.After(today) {
			to = today
		}
		rows, err := h.sysMetrics.ListRange(from, to)
		if err != nil {
			if errors.Is(err, sysmetrics.ErrInvalidMetricRange) {
				response.Fail(c, "结束日期不能早于开始日期", err)
				return
			}
			if errors.Is(err, sysmetrics.ErrMetricRangeTooLarge) {
				response.Fail(c, "时间范围不能超过 90 天", err)
				return
			}
			response.Fail(c, "查询失败", err)
			return
		}
		response.SuccessMsg(c, "ok", gin.H{
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
		response.Fail(c, "查询失败", err)
		return
	}
	response.SuccessMsg(c, "ok", gin.H{
		"list": rows,
		"days": days,
	})
}

// GET /metrics/live
func (h *Handlers) handleAdminLiveMetrics(c *gin.Context) {
	if h.sysMetrics == nil {
		response.Fail(c, "metrics unavailable", nil)
		return
	}
	response.SuccessMsg(c, "ok", h.sysMetrics.Live())
}

func parseMetricDate(raw string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", raw, time.Local)
}

func dateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}
