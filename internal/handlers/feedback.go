package handlers

import (
	"github.com/LingByte/ling-base/apidocs/humax"
	"errors"
	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type feedbackCreateReq struct {
	Content string `json:"content"`
	Contact string `json:"contact"`
}

type feedbackReplyReq struct {
	Content string `json:"content"`
}

type feedbackReplyDTO struct {
	ID        uint      `json:"id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

type feedbackTicketDTO struct {
	ID               uint               `json:"id"`
	Content          string             `json:"content"`
	Contact          string             `json:"contact,omitempty"`
	Status           string             `json:"status"`
	LastRepliedAt    *time.Time         `json:"lastRepliedAt,omitempty"`
	LastReplierRole  string             `json:"lastReplierRole,omitempty"`
	LastReplyPreview string             `json:"lastReplyPreview,omitempty"`
	ReplyCount       int                `json:"replyCount"`
	CreatedAt        time.Time          `json:"createdAt"`
	Replies          []feedbackReplyDTO `json:"replies,omitempty"`
}

func (h *Handlers) registerFeedbackRoutes(r *humax.Group) {
	g := r.Group("feedback")
	g.Use(auth.Required)
	{
		g.GET("", h.handleListMyFeedback)
		g.POST("", h.handleCreateFeedback)
		g.GET("/:id", h.handleGetMyFeedback)
		g.POST("/:id/replies", h.handleReplyMyFeedback)
	}
}

func (h *Handlers) handleCreateFeedback(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未登录", nil)
		return
	}
	var req feedbackCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数无效", err)
		return
	}
	ticket, err := models.NewFeedbackTicket(user.ID, req.Content, req.Contact, strconv.FormatUint(uint64(user.ID), 10))
	if err != nil {
		response.Fail(c, feedbackErrMsg(err), err)
		return
	}
	if err := h.db.Create(ticket).Error; err != nil {
		response.Fail(c, "提交失败", err)
		return
	}
	response.SuccessMsg(c, "已提交", toFeedbackTicketDTO(ticket, nil))
}

func (h *Handlers) handleListMyFeedback(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未登录", nil)
		return
	}
	page, pageSize := parsePageParams(c)
	q := h.db.Model(&models.FeedbackTicket{}).
		Where("user_id = ?", user.ID)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	var rows []models.FeedbackTicket
	if err := q.Order("updated_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	list := make([]feedbackTicketDTO, 0, len(rows))
	for i := range rows {
		list = append(list, toFeedbackTicketDTO(&rows[i], nil))
	}
	response.SuccessMsg(c, "ok", gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *Handlers) handleGetMyFeedback(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未登录", nil)
		return
	}
	ticket, ok := h.findOwnedFeedback(c, user.ID)
	if !ok {
		return
	}
	replies, err := loadFeedbackReplies(h.db, ticket.ID)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	response.SuccessMsg(c, "ok", toFeedbackTicketDTO(ticket, replies))
}

func (h *Handlers) handleReplyMyFeedback(c *gin.Context) {
	user := auth.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未登录", nil)
		return
	}
	ticket, ok := h.findOwnedFeedback(c, user.ID)
	if !ok {
		return
	}
	var req feedbackReplyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数无效", err)
		return
	}
	if _, err := appendFeedbackReply(h.db, ticket, user.ID, models.FeedbackRoleUser, req.Content, strconv.FormatUint(uint64(user.ID), 10)); err != nil {
		response.Fail(c, feedbackErrMsg(err), err)
		return
	}
	replies, err := loadFeedbackReplies(h.db, ticket.ID)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	response.SuccessMsg(c, "已回复", toFeedbackTicketDTO(ticket, replies))
}

func (h *Handlers) findOwnedFeedback(c *gin.Context, userID uint) (*models.FeedbackTicket, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Fail(c, "工单不存在", err)
		return nil, false
	}
	var ticket models.FeedbackTicket
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).
		First(&ticket).Error; err != nil {
		response.Fail(c, "工单不存在", err)
		return nil, false
	}
	return &ticket, true
}

func loadFeedbackReplies(db *gorm.DB, ticketID uint) ([]models.FeedbackReply, error) {
	var replies []models.FeedbackReply
	err := db.Where("ticket_id = ?", ticketID).
		Order("id ASC").Find(&replies).Error
	return replies, err
}

func appendFeedbackReply(db *gorm.DB, ticket *models.FeedbackTicket, authorID uint, role, content, operator string) (*models.FeedbackReply, error) {
	if !ticket.CanReply() {
		return nil, models.ErrFeedbackClosed
	}
	reply, err := models.NewFeedbackReply(ticket.ID, authorID, role, content, operator)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	preview := models.PreviewFeedback(reply.Content, models.FeedbackPreviewMaxRunes)
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(reply).Error; err != nil {
			return err
		}
		return tx.Model(ticket).Updates(map[string]any{
			"reply_count":        gorm.Expr("reply_count + 1"),
			"last_replier_role":  role,
			"last_replied_at":    now,
			"last_reply_preview": preview,
			"update_by":          operator,
			"updated_at":         now,
		}).Error
	})
	if err != nil {
		return nil, err
	}
	ticket.ReplyCount++
	ticket.LastReplierRole = role
	ticket.LastRepliedAt = &now
	ticket.LastReplyPreview = preview
	return reply, nil
}

func toFeedbackTicketDTO(ticket *models.FeedbackTicket, replies []models.FeedbackReply) feedbackTicketDTO {
	out := feedbackTicketDTO{
		ID:               ticket.ID,
		Content:          ticket.Content,
		Contact:          ticket.Contact,
		Status:           ticket.Status,
		LastRepliedAt:    ticket.LastRepliedAt,
		LastReplierRole:  ticket.LastReplierRole,
		LastReplyPreview: ticket.LastReplyPreview,
		ReplyCount:       ticket.ReplyCount,
		CreatedAt:        ticket.CreatedAt,
	}
	if len(replies) > 0 {
		out.Replies = make([]feedbackReplyDTO, 0, len(replies))
		for _, r := range replies {
			out.Replies = append(out.Replies, feedbackReplyDTO{
				ID:        r.ID,
				Role:      r.Role,
				Content:   r.Content,
				CreatedAt: r.CreatedAt,
			})
		}
	}
	return out
}

func feedbackErrMsg(err error) string {
	switch {
	case errors.Is(err, models.ErrFeedbackClosed):
		return "工单已关闭，无法继续回复"
	case errors.Is(err, models.ErrFeedbackContentInvalid):
		return "请填写 4～2000 字的内容"
	case errors.Is(err, models.ErrFeedbackContactInvalid):
		return "联系方式过长"
	default:
		return "操作失败"
	}
}

func parseFeedbackID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || id == 0 {
		response.Fail(c, "工单不存在", err)
		return 0, false
	}
	return uint(id), true
}
