package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/LingByte/ling-base/notification/inbox"
	"github.com/gin-gonic/gin"
)

// registerNotificationRoutes Notification Module
func (h *Handlers) registerNotificationRoutes(r *gin.RouterGroup) {
	notificationGroup := r.Group("notification")
	{
		notificationGroup.GET("unread-count", models.AuthRequired, h.handleUnReadNotificationCount)

		notificationGroup.GET("", models.AuthRequired, h.handleListNotifications)

		notificationGroup.POST("readAll", models.AuthRequired, h.handleAllNotifications)

		notificationGroup.PUT("/read/:id", models.AuthRequired, h.handleMarkNotificationAsRead)

		notificationGroup.DELETE("/:id", models.AuthRequired, h.handleDeleteNotification)

		// Batch delete notifications
		notificationGroup.POST("/batch-delete", models.AuthRequired, h.handleBatchDeleteNotifications)

		// Get all notification IDs (for select all functionality)
		notificationGroup.GET("/all-ids", models.AuthRequired, h.handleGetAllNotificationIds)
	}
}

func uintToStr(id uint) string { return strconv.FormatUint(uint64(id), 10) }

// GetUnReadNotificationCount get user unread notification count
func (h *Handlers) handleUnReadNotificationCount(c *gin.Context) {
	user := models.CurrentUser(c)

	users, err := models.GetUserByUsername(h.db, user.Username)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	store := inbox.NewGormStore(h.db)
	count, err := store.UnreadCount(uintToStr(users.ID))
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "success", count)
}

// ListNotifications list user notifications
func (h *Handlers) handleListNotifications(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User is not logged in.", nil)
	}
	page := c.DefaultQuery("page", "1")
	size := c.DefaultQuery("size", "10")

	var (
		pageInt  int
		sizeInt  int
		filterBy = c.Query("filter")  // read / unread
		title    = c.Query("title")   // Query by title
		content  = c.Query("content") // Query by content
		layout   = "2006-01-02T15:04:05Z07:00"
		startStr = c.Query("start_time") // Start time
		endStr   = c.Query("end_time")   // End time
		start    time.Time
		end      time.Time
	)

	_, _ = fmt.Sscanf(page, "%d", &pageInt)
	_, _ = fmt.Sscanf(size, "%d", &sizeInt)

	if startStr != "" {
		start, _ = time.Parse(layout, startStr)
	}
	if endStr != "" {
		end, _ = time.Parse(layout, endStr)
	}

	store := inbox.NewGormStore(h.db)
	res, err := store.List(
		uintToStr(user.ID),
		pageInt, sizeInt,
		filterBy, title, content,
		start, end,
	)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "success", gin.H{
		"list":        res.List,
		"total":       res.Total,
		"totalUnread": res.TotalUnread,
		"totalRead":   res.TotalRead,
		"page":        pageInt,
		"size":        sizeInt,
	})
}

// AllNotifications mark all notifications as read
func (h *Handlers) handleAllNotifications(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User is not logged in.", nil)
	}
	store := inbox.NewGormStore(h.db)
	if err := store.MarkAllRead(uintToStr(user.ID)); err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "already mark all notifications", nil)
}

// handleMarkNotificationAsRead marks specified notification as read
func (h *Handlers) handleMarkNotificationAsRead(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User is not logged in.", nil)
		return
	}

	// Get notification ID from path parameter
	idStr := c.Param("id")
	var notificationID uint
	_, err := fmt.Sscanf(idStr, "%d", &notificationID)
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	store := inbox.NewGormStore(h.db)
	if _, err := store.GetByID(uintToStr(user.ID), uintToStr(notificationID)); err != nil {
		response.Fail(c, "You don't have permission to flag this message.", nil)
		return
	}

	if err := store.MarkRead("", uintToStr(notificationID)); err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}

	response.SuccessMsg(c, "Notification marked as read", nil)
}

func (h *Handlers) handleDeleteNotification(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User is not logged in.", nil)
		return
	}
	var notificationID uint
	_, err := fmt.Sscanf(c.Param("id"), "%d", &notificationID)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadRequest, err)
		return
	}
	store := inbox.NewGormStore(h.db)
	if err := store.Delete(uintToStr(user.ID), uintToStr(notificationID)); err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "Notification deleted", nil)
}

// handleBatchDeleteNotifications batch deletes notifications
func (h *Handlers) handleBatchDeleteNotifications(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User is not logged in.", nil)
		return
	}

	var request struct {
		IDs []uint `json:"ids" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		response.Fail(c, "Invalid request format", err)
		return
	}

	if len(request.IDs) == 0 {
		response.Fail(c, "No notification IDs provided", nil)
		return
	}

	ids := make([]string, 0, len(request.IDs))
	for _, id := range request.IDs {
		ids = append(ids, uintToStr(id))
	}
	store := inbox.NewGormStore(h.db)
	deletedCount, err := store.BatchDelete(uintToStr(user.ID), ids)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}

	response.SuccessMsg(c, "Notifications deleted successfully", gin.H{
		"deletedCount":   deletedCount,
		"totalRequested": len(request.IDs),
	})
}

// handleGetAllNotificationIds gets all notification IDs (for select all functionality)
func (h *Handlers) handleGetAllNotificationIds(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User is not logged in.", nil)
		return
	}

	var (
		filterBy = c.Query("filter")  // read / unread
		title    = c.Query("title")   // Query by title
		content  = c.Query("content") // Query by content
		layout   = "2006-01-02T15:04:05Z07:00"
		startStr = c.Query("start_time") // Start time
		endStr   = c.Query("end_time")   // End time
		start    time.Time
		end      time.Time
	)

	if startStr != "" {
		start, _ = time.Parse(layout, startStr)
	}
	if endStr != "" {
		end, _ = time.Parse(layout, endStr)
	}

	store := inbox.NewGormStore(h.db)
	res, err := store.List(
		uintToStr(user.ID),
		1, 1<<31-1,
		filterBy, title, content,
		start, end,
	)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}

	ids := make([]uint, 0, len(res.List))
	for _, msg := range res.List {
		id, err := strconv.ParseUint(msg.ID, 10, 64)
		if err != nil {
			continue
		}
		ids = append(ids, uint(id))
	}

	response.SuccessMsg(c, "success", gin.H{
		"ids": ids,
	})
}
