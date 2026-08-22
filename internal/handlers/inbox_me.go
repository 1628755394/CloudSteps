package handlers

import (
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/LingByte/ling-base/notification/inbox"
	"github.com/gin-gonic/gin"
)

type meInboxMessageRow struct {
	ID          uint      `json:"id"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	ActionURL   string    `json:"actionUrl,omitempty"`
	ActionLabel string    `json:"actionLabel,omitempty"`
	Read        bool      `json:"read"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type meInboxBatchDeleteReq struct {
	IDs []uint `json:"ids" binding:"required,min=1"`
}

func (h *Handlers) registerInboxMeRoutes(admin *gin.RouterGroup) {
	me := admin.Group("me/inbox-messages")
	{
		me.GET("/unread-count", h.handleMeInboxUnreadCount)
		me.GET("", h.handleMeListInboxMessages)
		me.POST("/read-all", h.handleMeMarkAllInboxRead)
		me.POST("/batch-delete", h.handleMeBatchDeleteInboxMessages)
		me.GET("/:id", h.handleMeGetInboxMessage)
		me.PUT("/:id/read", h.handleMeMarkInboxRead)
		me.DELETE("/:id", h.handleMeDeleteInboxMessage)
	}
}

func currentUserIDStr(c *gin.Context) (string, bool) {
	user := models.CurrentUser(c)
	if user == nil {
		return "", false
	}
	return strconv.FormatUint(uint64(user.ID), 10), true
}

// GET /admin/me/inbox-messages/unread-count
func (h *Handlers) handleMeInboxUnreadCount(c *gin.Context) {
	userID, ok := currentUserIDStr(c)
	if !ok {
		response.Fail(c, "未登录", nil)
		return
	}
	store := inbox.NewGormStore(h.db)
	count, err := store.UnreadCount(userID)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	response.SuccessMsg(c, "ok", count)
}

// GET /admin/me/inbox-messages
func (h *Handlers) handleMeListInboxMessages(c *gin.Context) {
	userID, ok := currentUserIDStr(c)
	if !ok {
		response.Fail(c, "未登录", nil)
		return
	}
	page, pageSize := parsePageParams(c)
	filter := c.DefaultQuery("filter", inbox.FilterAll)
	if !inbox.IsValidFilter(filter) {
		filter = inbox.FilterAll
	}
	title := strings.TrimSpace(c.Query("title"))
	content := strings.TrimSpace(c.Query("content"))

	store := inbox.NewGormStore(h.db)
	res, err := store.List(userID, page, pageSize, filter, title, content, time.Time{}, time.Time{})
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}

	list := make([]meInboxMessageRow, 0, len(res.List))
	for _, msg := range res.List {
		row, ok := messageToMeRow(msg)
		if !ok {
			continue
		}
		list = append(list, row)
	}

	response.SuccessMsg(c, "ok", gin.H{
		"list":        list,
		"total":       res.Total,
		"totalUnread": res.TotalUnread,
		"totalRead":   res.TotalRead,
		"page":        page,
		"pageSize":    pageSize,
	})
}

// GET /admin/me/inbox-messages/:id
func (h *Handlers) handleMeGetInboxMessage(c *gin.Context) {
	userID, ok := currentUserIDStr(c)
	if !ok {
		response.Fail(c, "未登录", nil)
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	store := inbox.NewGormStore(h.db)
	msg, err := store.GetByID(userID, id)
	if err != nil {
		response.Fail(c, "站内信不存在", err)
		return
	}
	row, ok := messageToMeRow(*msg)
	if !ok {
		response.Fail(c, "无效消息", nil)
		return
	}
	response.SuccessMsg(c, "ok", row)
}

// PUT /admin/me/inbox-messages/:id/read
func (h *Handlers) handleMeMarkInboxRead(c *gin.Context) {
	userID, ok := currentUserIDStr(c)
	if !ok {
		response.Fail(c, "未登录", nil)
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	store := inbox.NewGormStore(h.db)
	if _, err := store.GetByID(userID, id); err != nil {
		response.Fail(c, "站内信不存在", err)
		return
	}
	if err := store.MarkRead("", id); err != nil {
		response.Fail(c, "标记已读失败", err)
		return
	}
	response.SuccessMsg(c, "已标记为已读", nil)
}

// POST /admin/me/inbox-messages/read-all
func (h *Handlers) handleMeMarkAllInboxRead(c *gin.Context) {
	userID, ok := currentUserIDStr(c)
	if !ok {
		response.Fail(c, "未登录", nil)
		return
	}
	store := inbox.NewGormStore(h.db)
	if err := store.MarkAllRead(userID); err != nil {
		response.Fail(c, "全部标记已读失败", err)
		return
	}
	response.SuccessMsg(c, "已全部标记为已读", nil)
}

// DELETE /admin/me/inbox-messages/:id
func (h *Handlers) handleMeDeleteInboxMessage(c *gin.Context) {
	userID, ok := currentUserIDStr(c)
	if !ok {
		response.Fail(c, "未登录", nil)
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	store := inbox.NewGormStore(h.db)
	if err := store.Delete(userID, id); err != nil {
		response.Fail(c, "删除失败", err)
		return
	}
	response.SuccessMsg(c, "已删除", nil)
}

// POST /admin/me/inbox-messages/batch-delete
func (h *Handlers) handleMeBatchDeleteInboxMessages(c *gin.Context) {
	userID, ok := currentUserIDStr(c)
	if !ok {
		response.Fail(c, "未登录", nil)
		return
	}
	var req meInboxBatchDeleteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数无效", err)
		return
	}
	ids := make([]string, 0, len(req.IDs))
	for _, id := range req.IDs {
		if id > 0 {
			ids = append(ids, strconv.FormatUint(uint64(id), 10))
		}
	}
	if len(ids) == 0 {
		response.Fail(c, "未提供有效 ID", nil)
		return
	}
	store := inbox.NewGormStore(h.db)
	deleted, err := store.BatchDelete(userID, ids)
	if err != nil {
		response.Fail(c, "批量删除失败", err)
		return
	}
	response.SuccessMsg(c, "已删除", gin.H{
		"deletedCount":   deleted,
		"totalRequested": len(ids),
	})
}

func messageToMeRow(msg inbox.Message) (meInboxMessageRow, bool) {
	id, err := strconv.ParseUint(msg.ID, 10, 64)
	if err != nil || id == 0 {
		return meInboxMessageRow{}, false
	}
	return meInboxMessageRow{
		ID:          uint(id),
		Title:       msg.Title,
		Content:     msg.Content,
		ActionURL:   msg.ActionURL,
		ActionLabel: msg.ActionLabel,
		Read:        msg.Read,
		CreatedAt:   msg.CreatedAt,
		UpdatedAt:   msg.UpdatedAt,
	}, true
}
