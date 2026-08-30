package handlers

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *Handlers) registerAnnouncementRoutes(r *gin.RouterGroup) {
	user := r.Group("announcements")
	user.Use(models.AuthRequired)
	{
		user.GET("/pending-popup", h.handleAnnouncementPendingPopup)
		user.GET("", h.handleListPublishedAnnouncements)
		user.POST("/:id/read", h.handleMarkAnnouncementRead)
		user.GET("/:id", h.handleGetPublishedAnnouncement)
	}

	admin := r.Group("admin/announcements")
	admin.Use(models.AuthRequired, adminOnly())
	{
		admin.GET("", h.handleAdminListAnnouncements)
		admin.POST("", h.handleAdminCreateAnnouncement)
		admin.GET("/:id", h.handleAdminGetAnnouncement)
		admin.GET("/:id/readers", h.handleAdminListAnnouncementReaders)
		admin.PUT("/:id", h.handleAdminUpdateAnnouncement)
		admin.POST("/:id/publish", h.handleAdminPublishAnnouncement)
		admin.POST("/:id/unpublish", h.handleAdminUnpublishAnnouncement)
		admin.DELETE("/:id", h.handleAdminDeleteAnnouncement)
	}
}

type announcementDTO struct {
	ID          uint       `json:"id"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	Status      string     `json:"status,omitempty"`
	PublishedAt *time.Time `json:"publishedAt,omitempty"`
	Priority    int        `json:"priority"`
	Read        *bool      `json:"read,omitempty"`
	ReadCount   *int64     `json:"readCount,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type announcementReaderDTO struct {
	UserID     uint      `json:"userId"`
	UserName   string    `json:"userName"`
	UserEmail  string    `json:"userEmail,omitempty"`
	ReadAt     time.Time `json:"readAt"`
}

func toAnnouncementDTO(a *models.Announcement, read *bool, readCount *int64) announcementDTO {
	return announcementDTO{
		ID:          a.ID,
		Title:       a.Title,
		Content:     a.Content,
		Status:      a.Status,
		PublishedAt: a.PublishedAt,
		Priority:    a.Priority,
		Read:        read,
		ReadCount:   readCount,
		CreatedAt:   a.CreatedAt,
		UpdatedAt:   a.UpdatedAt,
	}
}

func announcementOperator(user *models.User) string {
	if user == nil {
		return ""
	}
	if user.DisplayName != "" {
		return user.DisplayName
	}
	if user.Username != "" {
		return user.Username
	}
	return fmt.Sprintf("%d", user.ID)
}

func (h *Handlers) handleAnnouncementPendingPopup(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "请先登录", nil)
		return
	}
	db := c.MustGet(constants.DbField).(*gorm.DB)
	list, err := models.ListUnreadPublishedAnnouncements(db, user.ID, 20)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	read := false
	items := make([]announcementDTO, 0, len(list))
	for i := range list {
		items = append(items, toAnnouncementDTO(&list[i], &read, nil))
	}
	var first *announcementDTO
	if len(items) > 0 {
		first = &items[0]
	}
	// announcements：全部未读；announcement：兼容旧客户端取首条
	response.SuccessMsg(c, "success", gin.H{
		"announcements": items,
		"announcement":  first,
	})
}

func (h *Handlers) handleListPublishedAnnouncements(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "请先登录", nil)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	db := c.MustGet(constants.DbField).(*gorm.DB)
	list, readMap, total, err := models.ListPublishedAnnouncementsForUser(db, user.ID, page, pageSize)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	out := make([]announcementDTO, 0, len(list))
	for i := range list {
		r := readMap[list[i].ID]
		out = append(out, toAnnouncementDTO(&list[i], &r, nil))
	}
	response.SuccessMsg(c, "success", gin.H{
		"list":     out,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *Handlers) handleGetPublishedAnnouncement(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "请先登录", nil)
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		response.Fail(c, "参数无效", nil)
		return
	}
	db := c.MustGet(constants.DbField).(*gorm.DB)
	row, err := models.GetAnnouncementByID(db, uint(id))
	if err != nil || row.Status != models.AnnouncementStatusPublished {
		response.Fail(c, "公告不存在", err)
		return
	}
	read := false
	var n int64
	_ = db.Model(&models.AnnouncementRead{}).
		Where("announcement_id = ? AND user_id = ? AND is_deleted = ?", row.ID, user.ID, models.SoftDeleteStatusActive).
		Count(&n).Error
	if n > 0 {
		read = true
	}
	response.SuccessMsg(c, "success", toAnnouncementDTO(row, &read, nil))
}

func (h *Handlers) handleMarkAnnouncementRead(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "请先登录", nil)
		return
	}
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		response.Fail(c, "参数无效", nil)
		return
	}
	db := c.MustGet(constants.DbField).(*gorm.DB)
	row, err := models.GetAnnouncementByID(db, uint(id))
	if err != nil || row.Status != models.AnnouncementStatusPublished {
		response.Fail(c, "公告不存在", err)
		return
	}
	if err := models.MarkAnnouncementRead(db, row.ID, user.ID); err != nil {
		response.Fail(c, "标记失败", err)
		return
	}
	response.SuccessMsg(c, "已读", nil)
}

func (h *Handlers) handleAdminListAnnouncements(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	status := strings.TrimSpace(c.Query("status"))
	db := c.MustGet(constants.DbField).(*gorm.DB)
	list, total, err := models.ListAnnouncementsAdmin(db, status, page, pageSize)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	out := make([]announcementDTO, 0, len(list))
	ids := make([]uint, 0, len(list))
	for i := range list {
		ids = append(ids, list[i].ID)
	}
	counts := models.CountAnnouncementReaders(db, ids)
	for i := range list {
		cnt := counts[list[i].ID]
		out = append(out, toAnnouncementDTO(&list[i], nil, &cnt))
	}
	response.SuccessMsg(c, "success", gin.H{"list": out, "total": total, "page": page, "pageSize": pageSize})
}

func (h *Handlers) handleAdminCreateAnnouncement(c *gin.Context) {
	user := models.CurrentUser(c)
	var body struct {
		Title    string `json:"title" binding:"required"`
		Content  string `json:"content"`
		Priority int    `json:"priority"`
		Publish  bool   `json:"publish"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Fail(c, "参数错误", err)
		return
	}
	db := c.MustGet(constants.DbField).(*gorm.DB)
	op := announcementOperator(user)
	row := &models.Announcement{
		Title:    body.Title,
		Content:  body.Content,
		Status:   models.AnnouncementStatusDraft,
		Priority: body.Priority,
	}
	row.CreateBy = op
	if err := models.CreateAnnouncement(db, row); err != nil {
		response.Fail(c, "创建失败", err)
		return
	}
	if body.Publish {
		if err := models.PublishAnnouncement(db, row.ID, op); err != nil {
			response.Fail(c, "发布失败", err)
			return
		}
		fresh, _ := models.GetAnnouncementByID(db, row.ID)
		if fresh != nil {
			row = fresh
		}
	}
	response.SuccessMsg(c, "创建成功", toAnnouncementDTO(row, nil, nil))
}

func (h *Handlers) handleAdminGetAnnouncement(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db := c.MustGet(constants.DbField).(*gorm.DB)
	row, err := models.GetAnnouncementByID(db, uint(id))
	if err != nil {
		response.Fail(c, "公告不存在", err)
		return
	}
	cntMap := models.CountAnnouncementReaders(db, []uint{row.ID})
	cnt := cntMap[row.ID]
	response.SuccessMsg(c, "success", toAnnouncementDTO(row, nil, &cnt))
}

func (h *Handlers) handleAdminListAnnouncementReaders(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		response.Fail(c, "参数无效", nil)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))
	db := c.MustGet(constants.DbField).(*gorm.DB)
	if _, err := models.GetAnnouncementByID(db, uint(id)); err != nil {
		response.Fail(c, "公告不存在", err)
		return
	}
	reads, total, err := models.ListAnnouncementReaders(db, uint(id), page, pageSize)
	if err != nil {
		response.Fail(c, "查询失败", err)
		return
	}
	userIDs := make([]uint, 0, len(reads))
	seen := map[uint]struct{}{}
	for _, r := range reads {
		if _, ok := seen[r.UserID]; ok {
			continue
		}
		seen[r.UserID] = struct{}{}
		userIDs = append(userIDs, r.UserID)
	}
	labels := map[uint]inboxUserLabel{}
	if len(userIDs) > 0 {
		var users []models.User
		_ = db.Where("id IN ?", userIDs).Find(&users).Error
		for _, u := range users {
			name := u.DisplayName
			if name == "" {
				name = u.Username
			}
			labels[u.ID] = inboxUserLabel{Name: name, Email: u.Username}
		}
	}
	out := make([]announcementReaderDTO, 0, len(reads))
	for _, r := range reads {
		lb := labels[r.UserID]
		out = append(out, announcementReaderDTO{
			UserID:    r.UserID,
			UserName:  lb.Name,
			UserEmail: lb.Email,
			ReadAt:    r.ReadAt,
		})
	}
	response.SuccessMsg(c, "success", gin.H{
		"list":     out,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *Handlers) handleAdminUpdateAnnouncement(c *gin.Context) {
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		response.Fail(c, "参数无效", nil)
		return
	}
	var body struct {
		Title    *string `json:"title"`
		Content  *string `json:"content"`
		Priority *int    `json:"priority"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Fail(c, "参数错误", err)
		return
	}
	vals := map[string]any{"update_by": announcementOperator(user)}
	if body.Title != nil {
		t := strings.TrimSpace(*body.Title)
		if t == "" {
			response.Fail(c, "标题不能为空", nil)
			return
		}
		vals["title"] = t
	}
	if body.Content != nil {
		vals["content"] = strings.TrimSpace(*body.Content)
	}
	if body.Priority != nil {
		vals["priority"] = *body.Priority
	}
	db := c.MustGet(constants.DbField).(*gorm.DB)
	if err := models.UpdateAnnouncement(db, uint(id), vals); err != nil {
		response.Fail(c, "更新失败", err)
		return
	}
	row, _ := models.GetAnnouncementByID(db, uint(id))
	response.SuccessMsg(c, "更新成功", toAnnouncementDTO(row, nil, nil))
}

func (h *Handlers) handleAdminPublishAnnouncement(c *gin.Context) {
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	db := c.MustGet(constants.DbField).(*gorm.DB)
	if err := models.PublishAnnouncement(db, uint(id), announcementOperator(user)); err != nil {
		response.Fail(c, "发布失败", err)
		return
	}
	row, _ := models.GetAnnouncementByID(db, uint(id))
	response.SuccessMsg(c, "已发布", toAnnouncementDTO(row, nil, nil))
}

func (h *Handlers) handleAdminUnpublishAnnouncement(c *gin.Context) {
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	db := c.MustGet(constants.DbField).(*gorm.DB)
	if err := models.UnpublishAnnouncement(db, uint(id), announcementOperator(user)); err != nil {
		response.Fail(c, "取消发布失败", err)
		return
	}
	row, _ := models.GetAnnouncementByID(db, uint(id))
	response.SuccessMsg(c, "已取消发布", toAnnouncementDTO(row, nil, nil))
}

func (h *Handlers) handleAdminDeleteAnnouncement(c *gin.Context) {
	user := models.CurrentUser(c)
	id, _ := strconv.Atoi(c.Param("id"))
	db := c.MustGet(constants.DbField).(*gorm.DB)
	if err := models.DeleteAnnouncement(db, uint(id), announcementOperator(user)); err != nil {
		response.Fail(c, "删除失败", err)
		return
	}
	response.SuccessMsg(c, "已删除", nil)
}
