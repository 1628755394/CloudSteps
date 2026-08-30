package handlers

import (
	"fmt"
	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"github.com/LingByte/ling-base/apidocs/humax"
	"net/http"
	"strconv"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/LingByte/ling-base/notification/inbox"
	"github.com/gin-gonic/gin"
)

// registerNotificationRoutes Notification Module
func (h *Handlers) registerNotificationRoutes(r *humax.Group) {
	notificationGroup := r.Group("notification")
	{
		notificationGroup.GET("unread-count", auth.Required, h.handleUnReadNotificationCount)

		notificationGroup.GET("", auth.Required, h.handleListNotifications)

		notificationGroup.POST("readAll", auth.Required, h.handleAllNotifications)

		notificationGroup.PUT("/read/:id", auth.Required, h.handleMarkNotificationAsRead)

		notificationGroup.DELETE("/:id", auth.Required, h.handleDeleteNotification)

		// Batch delete notifications
		notificationGroup.POST("/batch-delete", auth.Required, h.handleBatchDeleteNotifications)

		// Get all notification IDs (for select all functionality)
		notificationGroup.GET("/all-ids", auth.Required, h.handleGetAllNotificationIds)
	}
}

func uintToStr(id uint) string { return strconv.FormatUint(uint64(id), 10) }

// apiNotification is the stable JSON shape for learner-facing inbox APIs.
// ling-base inbox.Message has no json tags (PascalCase by default), so we map explicitly.
type apiNotification struct {
	ID          uint      `json:"id"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	ActionURL   string    `json:"actionUrl,omitempty"`
	ActionLabel string    `json:"actionLabel,omitempty"`
	Read        bool      `json:"read"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func toAPINotifications(msgs []inbox.Message) []apiNotification {
	out := make([]apiNotification, 0, len(msgs))
	for _, m := range msgs {
		id, _ := strconv.ParseUint(m.ID, 10, 64)
		out = append(out, apiNotification{
			ID:          uint(id),
			Title:       m.Title,
			Content:     m.Content,
			ActionURL:   m.ActionURL,
			ActionLabel: m.ActionLabel,
			Read:        m.Read,
			CreatedAt:   m.CreatedAt,
			UpdatedAt:   m.UpdatedAt,
		})
	}
	return out
}

// GetUnReadNotificationCount get user unread notification count
func (h *Handlers) handleUnReadNotificationCount(c *gin.Context) {
	user := auth.CurrentUser(c)

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
	response.SuccessI18n(c, "common.success", count)
}

// ListNotifications list user notifications
func (h *Handlers) handleListNotifications(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.user_not_logged_in", nil)
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
	response.SuccessI18n(c, "common.success", gin.H{
		"list":        toAPINotifications(res.List),
		"total":       res.Total,
		"totalUnread": res.TotalUnread,
		"totalRead":   res.TotalRead,
		"page":        pageInt,
		"size":        sizeInt,
	})
}

// AllNotifications mark all notifications as read
func (h *Handlers) handleAllNotifications(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.user_not_logged_in", nil)
	}
	store := inbox.NewGormStore(h.db)
	if err := store.MarkAllRead(uintToStr(user.ID)); err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessI18n(c, "auth.all_marked_read", nil)
}

// handleMarkNotificationAsRead marks specified notification as read
func (h *Handlers) handleMarkNotificationAsRead(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.user_not_logged_in", nil)
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
	userID := uintToStr(user.ID)
	if _, err := store.GetByID(userID, uintToStr(notificationID)); err != nil {
		response.FailI18n(c, "auth.no_permission_flag", nil)
		return
	}

	if err := store.MarkRead(userID, uintToStr(notificationID)); err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}

	response.SuccessI18n(c, "auth.notification_marked_read", nil)
}

func (h *Handlers) handleDeleteNotification(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.user_not_logged_in", nil)
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
	response.SuccessI18n(c, "auth.notification_deleted", nil)
}

// handleBatchDeleteNotifications batch deletes notifications
func (h *Handlers) handleBatchDeleteNotifications(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.user_not_logged_in", nil)
		return
	}

	var request struct {
		IDs []uint `json:"ids" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		response.FailI18n(c, "msg.e0f9a39f", err)
		return
	}

	if len(request.IDs) == 0 {
		response.FailI18n(c, "auth.no_notification_ids", nil)
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

	response.SuccessI18n(c, "auth.notifications_deleted", gin.H{
		"deletedCount":   deletedCount,
		"totalRequested": len(request.IDs),
	})
}

// handleGetAllNotificationIds gets all notification IDs (for select all functionality)
func (h *Handlers) handleGetAllNotificationIds(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.FailI18n(c, "auth.user_not_logged_in", nil)
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

	response.SuccessI18n(c, "common.success", gin.H{
		"ids": ids,
	})
}
