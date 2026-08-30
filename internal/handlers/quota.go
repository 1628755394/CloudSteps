package handlers

import (
	"net/http"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// registerQuotaRoutes 用户额度与签到路由
func (h *Handlers) registerQuotaRoutes(r *gin.RouterGroup) {
	q := r.Group("quota")
	q.Use(models.AuthRequired)
	{
		q.GET("", h.handleGetUserQuota)
		q.POST("/check-in", h.handleCheckIn)
	}
}

// handleGetUserQuota 获取当前用户额度及今日签到状态
func (h *Handlers) handleGetUserQuota(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}

	quota, err := models.EnsureUserQuota(db, user.ID)
	if err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}

	checkedIn, err := models.HasCheckedInToday(db, user.ID)
	if err != nil {
		response.Fail(c, "查询签到状态失败", err.Error())
		return
	}

	remaining, total := 0, 0
	if quota != nil {
		remaining = quota.RemainingMinutes
		total = quota.TotalAllocatedMinutes
	}

	response.SuccessMsg(c, "ok", gin.H{
		"remainingMinutes":      remaining,
		"totalAllocatedMinutes": total,
		"checkedInToday":        checkedIn,
		"dailyMinutes":          models.DailyCheckInMinutes,
	})
}

// handleCheckIn 每日签到
func (h *Handlers) handleCheckIn(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "msg": "未登录"})
		return
	}

	checkedIn, err := models.HasCheckedInToday(db, user.ID)
	if err != nil {
		response.Fail(c, "查询签到状态失败", err.Error())
		return
	}
	if checkedIn {
		response.Fail(c, "今日已签到", "already checked in")
		return
	}

	record, err := models.PerformCheckIn(db, user.ID)
	if err != nil {
		response.Fail(c, "签到失败", err.Error())
		return
	}

	// 返回最新额度
	quota, _ := models.EnsureUserQuota(db, user.ID)
	remaining, total := 0, 0
	if quota != nil {
		remaining = quota.RemainingMinutes
		total = quota.TotalAllocatedMinutes
	}

	response.SuccessMsg(c, "签到成功", gin.H{
		"minutesAwarded":        record.MinutesAwarded,
		"remainingMinutes":      remaining,
		"totalAllocatedMinutes": total,
		"checkedInToday":        true,
	})
}
