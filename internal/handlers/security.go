package handlers

import (
	"github.com/LingByte/ling-base/apidocs/humax"
	lbconstants "github.com/LingByte/ling-base/common/constants"

	"strconv"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/models"
	middleware "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	response "github.com/LingByte/CloudStepsGo/pkg/response"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *Handlers) registerSecurityRoutes(r *humax.Group) {
	security := r.Group("security")
	security.Use(middleware.Required, middleware.AdminRequired)
	{
		security.GET("/operation-logs", h.handleAdminListOperationLogs)
		security.GET("/operation-logs/:id", h.handleAdminGetOperationLog)
	}

	authAdmin := r.Group(configs.Global.Server.AuthPrefix)
	authAdmin.Use(middleware.Required, middleware.AdminRequired)
	{
		authAdmin.GET("/login-history", h.handleAdminListLoginHistory)
		authAdmin.GET("/login-history/:id", h.handleAdminGetLoginHistory)
	}
}

func parsePageParams(c *gin.Context) (page, pageSize int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ = strconv.Atoi(c.DefaultQuery("page_size", ""))
	if pageSize <= 0 {
		pageSize, _ = strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}

// GET /security/operation-logs
func (h *Handlers) handleAdminListOperationLogs(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	page, pageSize := parsePageParams(c)

	query := db.Model(&middleware.OperationLog{})

	if userID := strings.TrimSpace(c.Query("user_id")); userID != "" {
		if id, err := strconv.Atoi(userID); err == nil && id > 0 {
			query = query.Where("user_id = ?", id)
		}
	}
	if action := strings.TrimSpace(c.Query("action")); action != "" {
		query = query.Where("action LIKE ?", "%"+action+"%")
	}
	if target := strings.TrimSpace(c.Query("target")); target != "" {
		query = query.Where("target LIKE ?", "%"+target+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		response.FailI18n(c, "common.query_failed", err)
		return
	}

	var logs []middleware.OperationLog
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		response.FailI18n(c, "common.query_failed", err)
		return
	}

	response.SuccessI18n(c, "common.ok", gin.H{
		"logs":      logs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GET /security/operation-logs/:id
func (h *Handlers) handleAdminGetOperationLog(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		response.FailI18n(c, "coaching.invalid_id", err)
		return
	}

	var log middleware.OperationLog
	if err := db.First(&log, id).Error; err != nil {
		response.FailI18n(c, "notification.log_not_found", err)
		return
	}
	response.SuccessI18n(c, "common.ok", gin.H{"log": log})
}

// GET /auth/login-history
func (h *Handlers) handleAdminListLoginHistory(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	page, pageSize := parsePageParams(c)

	query := db.Model(&models.LoginHistory{})

	if userID := strings.TrimSpace(c.Query("user_id")); userID != "" {
		if id, err := strconv.Atoi(userID); err == nil && id > 0 {
			query = query.Where("user_id = ?", id)
		}
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := "%" + search + "%"
		query = query.Where("email LIKE ? OR ip_address LIKE ? OR location LIKE ?", like, like, like)
	}
	if success := strings.TrimSpace(c.Query("success")); success != "" {
		query = query.Where("success = ?", success == "true" || success == "1")
	}
	if suspicious := strings.TrimSpace(c.Query("is_suspicious")); suspicious != "" {
		query = query.Where("is_suspicious = ?", suspicious == "true" || suspicious == "1")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		response.FailI18n(c, "common.query_failed", err)
		return
	}

	var histories []models.LoginHistory
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&histories).Error; err != nil {
		response.FailI18n(c, "common.query_failed", err)
		return
	}

	response.SuccessI18n(c, "common.ok", gin.H{
		"histories": histories,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GET /auth/login-history/:id
func (h *Handlers) handleAdminGetLoginHistory(c *gin.Context) {
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		response.FailI18n(c, "coaching.invalid_id", err)
		return
	}

	var history models.LoginHistory
	if err := db.First(&history, id).Error; err != nil {
		response.FailI18n(c, "common.record_not_found", err)
		return
	}
	response.SuccessI18n(c, "common.ok", gin.H{"history": history})
}
