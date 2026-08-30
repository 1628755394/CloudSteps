package handlers

import (
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *Handlers) registerCheckInRoutes(r *gin.RouterGroup) {
	g := r.Group("teacher/checkin")
	g.Use(models.AuthRequired, h.requireTeacherOrAdmin)
	{
		g.GET("", h.handleTeacherCheckInStatus)
		g.POST("", h.handleTeacherCheckIn)
	}
}

func (h *Handlers) handleTeacherCheckInStatus(c *gin.Context) {
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		response.Fail(c, "未登录", nil)
		return
	}
	db := c.MustGet(constants.DbField).(*gorm.DB)
	st, err := models.GetTeacherCheckInStatus(db, tid, time.Now())
	if err != nil {
		response.Fail(c, "查询失败", err.Error())
		return
	}
	response.SuccessMsg(c, "ok", st)
}

func (h *Handlers) handleTeacherCheckIn(c *gin.Context) {
	tid := coachingCoachingTeacherID(c)
	if tid == 0 {
		response.Fail(c, "未登录", nil)
		return
	}
	db := c.MustGet(constants.DbField).(*gorm.DB)
	res, err := models.DoTeacherCheckIn(db, tid, time.Now())
	if err != nil {
		response.Fail(c, "签到失败", err.Error())
		return
	}
	msg := "签到成功"
	if res.AlreadyCheckedIn {
		msg = "今日已签到"
	}
	response.SuccessMsg(c, msg, res)
}
