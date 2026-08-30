package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	notify2 "github.com/LingByte/CloudStepsGo/pkg/notify"
	"github.com/LingByte/ling-base/apidocs/humax"

	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type notificationChannelUpsertReq struct {
	ChannelType      string `json:"channelType" binding:"required,oneof=email"`
	Name             string `json:"name" binding:"required,max=128"`
	SortOrder        int    `json:"sortOrder"`
	Enabled          *bool  `json:"enabled"`
	Remark           string `json:"remark" binding:"max=255"`
	Driver           string `json:"driver"`
	SMTPHost         string `json:"smtpHost"`
	SMTPPort         int64  `json:"smtpPort"`
	SMTPUsername     string `json:"smtpUsername"`
	SMTPPassword     string `json:"smtpPassword"`
	SMTPFrom         string `json:"smtpFrom"`
	SendcloudAPIUser string `json:"sendcloudApiUser"`
	SendcloudAPIKey  string `json:"sendcloudApiKey"`
	SendcloudFrom    string `json:"sendcloudFrom"`
	FromDisplayName  string `json:"fromDisplayName"`
}

func buildChannelConfig(req notificationChannelUpsertReq) (string, error) {
	switch strings.ToLower(strings.TrimSpace(req.ChannelType)) {
	case notify2.NotificationChannelTypeEmail:
		switch strings.ToLower(strings.TrimSpace(req.Driver)) {
		case notify2.ProviderSMTP:
			return notify2.BuildEmailChannelConfigJSON(
				notify2.ProviderSMTP, req.Name,
				req.SMTPHost, req.SMTPPort, req.SMTPUsername, req.SMTPPassword, req.SMTPFrom, req.FromDisplayName,
				"", "", "",
			)
		case notify2.ProviderSendCloud:
			return notify2.BuildEmailChannelConfigJSON(
				notify2.ProviderSendCloud, req.Name,
				"", 0, "", "", "", req.FromDisplayName,
				req.SendcloudAPIUser, req.SendcloudAPIKey, req.SendcloudFrom,
			)
		default:
			return "", fmt.Errorf("未知邮件驱动: %q（仅支持 smtp / sendcloud）", req.Driver)
		}
	default:
		return "", errors.New("未知 channelType")
	}
}

func buildChannelConfigForUpdate(req notificationChannelUpsertReq, oldConfigJSON string) (string, error) {
	if strings.TrimSpace(oldConfigJSON) == "" {
		return buildChannelConfig(req)
	}
	patched := req
	var oldC notify2.MailConfig
	if err := json.Unmarshal([]byte(oldConfigJSON), &oldC); err != nil {
		return buildChannelConfig(req)
	}
	driver := strings.ToLower(strings.TrimSpace(req.Driver))
	if driver == notify2.ProviderSendCloud {
		if strings.TrimSpace(patched.SendcloudAPIKey) == "" && oldC.APIKey != "" {
			patched.SendcloudAPIKey = oldC.APIKey
		}
		if strings.TrimSpace(patched.SendcloudFrom) == "" && oldC.From != "" {
			patched.SendcloudFrom = oldC.From
		}
		if strings.TrimSpace(patched.SendcloudAPIUser) == "" && oldC.APIUser != "" {
			patched.SendcloudAPIUser = oldC.APIUser
		}
	}
	if driver == notify2.ProviderSMTP {
		if patched.SMTPPassword == "" && oldC.Password != "" {
			patched.SMTPPassword = oldC.Password
		}
		if strings.TrimSpace(patched.SMTPFrom) == "" && oldC.From != "" {
			patched.SMTPFrom = oldC.From
		}
		if strings.TrimSpace(patched.SMTPHost) == "" && oldC.Host != "" {
			patched.SMTPHost = oldC.Host
		}
		if patched.SMTPPort <= 0 && oldC.Port > 0 {
			patched.SMTPPort = oldC.Port
		}
	}
	if strings.TrimSpace(patched.FromDisplayName) == "" && strings.TrimSpace(oldC.FromName) != "" {
		patched.FromDisplayName = oldC.FromName
	}
	return buildChannelConfig(patched)
}

func (h *Handlers) registerNotificationAdminRoutes(r *humax.Group) {
	admin := r.Group("admin")
	admin.Use(auth.Required, auth.AdminRequired)
	channels := admin.Group("notification-channels")
	{
		channels.GET("", h.handleListNotificationChannels)
		channels.POST("", h.handleCreateNotificationChannel)
		channels.GET("/:id", h.handleGetNotificationChannel)
		channels.PUT("/:id", h.handleUpdateNotificationChannel)
		channels.DELETE("/:id", h.handleDeleteNotificationChannel)
	}
	templates := admin.Group("notification-templates")
	{
		templates.GET("", h.handleListMailTemplates)
		templates.POST("", h.handleCreateMailTemplate)
		templates.GET("/:id", h.handleGetMailTemplate)
		templates.PUT("/:id", h.handleUpdateMailTemplate)
		templates.DELETE("/:id", h.handleDeleteMailTemplate)
	}
	legacyTemplates := admin.Group("mail-templates")
	{
		legacyTemplates.GET("", h.handleListMailTemplates)
		legacyTemplates.POST("", h.handleCreateMailTemplate)
		legacyTemplates.GET("/:id", h.handleGetMailTemplate)
		legacyTemplates.PUT("/:id", h.handleUpdateMailTemplate)
		legacyTemplates.DELETE("/:id", h.handleDeleteMailTemplate)
	}
	logs := admin.Group("mail-logs")
	{
		logs.GET("", h.handleListMailLogs)
		logs.GET("/:id", h.handleGetMailLogDetail)
		logs.GET("/stats/summary", h.handleGetMailLogStats)
	}
	admin.POST("mail/test", h.handleTestSendMail)
	h.registerInboxAdminRoutes(admin)
	h.registerInboxMeRoutes(admin)
}

func (h *Handlers) handleListNotificationChannels(c *gin.Context) {
	page, pageSize := parsePageParams(c)
	t := strings.TrimSpace(c.Query("type"))
	list, total, err := notify2.ListNotificationChannels(h.db, t, page, pageSize)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "ok", gin.H{
		"list": list, "total": total, "page": page, "pageSize": pageSize,
	})
}

func (h *Handlers) handleGetNotificationChannel(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := notify2.GetNotificationChannel(h.db, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Fail(c, "not found", err)
			return
		}
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	out := gin.H{"channel": row}
	if row.Type == notify2.NotificationChannelTypeEmail && strings.TrimSpace(row.ConfigJSON) != "" {
		if vf, err := notify2.DecodeEmailChannelForm(row.ConfigJSON); err == nil {
			out["emailForm"] = vf
		}
	}
	response.SuccessMsg(c, "ok", out)
}

func (h *Handlers) handleCreateNotificationChannel(c *gin.Context) {
	var req notificationChannelUpsertReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err)
		return
	}
	cfgJSON, err := buildChannelConfig(req)
	if err != nil {
		response.Fail(c, err.Error(), err)
		return
	}
	channelType := strings.ToLower(strings.TrimSpace(req.ChannelType))
	row := notify2.NotificationChannel{
		Type:       channelType,
		Code:       fmt.Sprintf("%s-%d", strings.ToUpper(channelType[:1]), time.Now().UnixNano()),
		Name:       strings.TrimSpace(req.Name),
		SortOrder:  req.SortOrder,
		Enabled:    true,
		Remark:     strings.TrimSpace(req.Remark),
		ConfigJSON: cfgJSON,
	}
	if req.Enabled != nil {
		row.Enabled = *req.Enabled
	}
	if u := auth.CurrentUser(c); u != nil {
		row.SetCreateInfo(u.Username)
	}
	if err := h.db.Create(&row).Error; err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "created", row)
}

func (h *Handlers) handleUpdateNotificationChannel(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	var req notificationChannelUpsertReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err)
		return
	}
	row, err := notify2.GetNotificationChannel(h.db, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Fail(c, "not found", err)
			return
		}
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	channelType := strings.ToLower(strings.TrimSpace(req.ChannelType))
	if channelType != strings.ToLower(strings.TrimSpace(row.Type)) {
		response.Fail(c, "channelType 不匹配", nil)
		return
	}
	cfgJSON, err := buildChannelConfigForUpdate(req, row.ConfigJSON)
	if err != nil {
		response.Fail(c, err.Error(), err)
		return
	}
	if merged, err := notify2.MergeEmailSecretsOnUpdate(row.ConfigJSON, cfgJSON); err == nil {
		row.ConfigJSON = merged
	} else {
		row.ConfigJSON = cfgJSON
	}
	row.Name = strings.TrimSpace(req.Name)
	row.SortOrder = req.SortOrder
	if req.Enabled != nil {
		row.Enabled = *req.Enabled
	}
	row.Remark = strings.TrimSpace(req.Remark)
	if u := auth.CurrentUser(c); u != nil {
		row.SetUpdateInfo(u.Username)
	}
	if err := h.db.Save(row).Error; err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "updated", row)
}

func (h *Handlers) handleDeleteNotificationChannel(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := notify2.GetNotificationChannel(h.db, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Fail(c, "not found", err)
			return
		}
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	operator := ""
	if u := auth.CurrentUser(c); u != nil {
		operator = u.Username
	}
	row.SoftDelete(operator)
	if err := h.db.Save(row).Error; err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "deleted", gin.H{"id": id})
}

type mailTemplateCreateReq struct {
	Code        string `json:"code" binding:"required,max=64"`
	Name        string `json:"name" binding:"required,max=128"`
	ChannelType string `json:"channelType" binding:"required,oneof=email inbox"`
	Subject     string `json:"subject" binding:"max=255"`
	HTMLBody    string `json:"htmlBody"`
	InboxTitle  string `json:"inboxTitle" binding:"max=255"`
	InboxBody   string `json:"inboxBody"`
	Description string `json:"description" binding:"max=512"`
	Variables   string `json:"variables"`
	Locale      string `json:"locale" binding:"max=32"`
	Enabled     *bool  `json:"enabled"`
}

type mailTemplateUpdateReq struct {
	Name        string `json:"name" binding:"required,max=128"`
	Subject     string `json:"subject" binding:"max=255"`
	HTMLBody    string `json:"htmlBody"`
	InboxTitle  string `json:"inboxTitle" binding:"max=255"`
	InboxBody   string `json:"inboxBody"`
	Description string `json:"description" binding:"max=512"`
	Variables   string `json:"variables"`
	Locale      string `json:"locale" binding:"max=32"`
	Enabled     *bool  `json:"enabled"`
}

func applyMailTemplateUpsert(tpl *notify2.MailTemplate, htmlBody, variables string) error {
	switch notify2.NormalizeNotificationTemplateType(tpl.ChannelType) {
	case notify2.NotificationTemplateTypeEmail:
		notify2.ApplyMailTemplateHTMLDerivedFields(tpl, htmlBody, variables)
	case notify2.NotificationTemplateTypeInbox:
		notify2.ApplyInboxTemplateDerivedFields(tpl, variables)
	}
	return notify2.ValidateNotificationTemplate(tpl)
}

func (h *Handlers) handleListMailTemplates(c *gin.Context) {
	page, pageSize := parsePageParams(c)
	channelType := strings.TrimSpace(c.Query("channelType"))
	list, total, err := notify2.ListMailTemplatesPage(h.db, page, pageSize, channelType)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "ok", gin.H{
		"list": list, "total": total, "page": page, "pageSize": pageSize,
	})
}

func (h *Handlers) handleGetMailTemplate(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	tpl, err := notify2.GetMailTemplateByID(h.db, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Fail(c, "not found", err)
			return
		}
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "ok", tpl)
}

func (h *Handlers) handleCreateMailTemplate(c *gin.Context) {
	var req mailTemplateCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err)
		return
	}
	tpl := notify2.MailTemplate{
		Code:        req.Code,
		Name:        req.Name,
		ChannelType: notify2.NormalizeNotificationTemplateType(req.ChannelType),
		Subject:     req.Subject,
		InboxTitle:  req.InboxTitle,
		InboxBody:   req.InboxBody,
		Description: req.Description,
		Locale:      req.Locale,
		Enabled:     true,
	}
	if err := applyMailTemplateUpsert(&tpl, req.HTMLBody, req.Variables); err != nil {
		response.Fail(c, err.Error(), err)
		return
	}
	if req.Enabled != nil {
		tpl.Enabled = *req.Enabled
	}
	if u := auth.CurrentUser(c); u != nil {
		tpl.SetCreateInfo(u.Username)
	}
	if err := notify2.CreateMailTemplate(h.db, &tpl); err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "created", tpl)
}

func (h *Handlers) handleUpdateMailTemplate(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	var req mailTemplateUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err)
		return
	}
	tpl, err := notify2.GetMailTemplateByID(h.db, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Fail(c, "not found", err)
			return
		}
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	tpl.Name = req.Name
	tpl.Subject = req.Subject
	tpl.InboxTitle = req.InboxTitle
	tpl.InboxBody = req.InboxBody
	tpl.Description = req.Description
	tpl.Locale = req.Locale
	if err := applyMailTemplateUpsert(tpl, req.HTMLBody, req.Variables); err != nil {
		response.Fail(c, err.Error(), err)
		return
	}
	if req.Enabled != nil {
		tpl.Enabled = *req.Enabled
	}
	if u := auth.CurrentUser(c); u != nil {
		tpl.SetUpdateInfo(u.Username)
	}
	if err := notify2.SaveMailTemplate(h.db, tpl); err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "updated", tpl)
}

func (h *Handlers) handleDeleteMailTemplate(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	n, err := notify2.DeleteMailTemplateByID(h.db, id)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	if n == 0 {
		response.Fail(c, "not found", nil)
		return
	}
	response.SuccessMsg(c, "deleted", gin.H{"id": id})
}

func (h *Handlers) handleListMailLogs(c *gin.Context) {
	page, pageSize := parsePageParams(c)
	q := h.db.Model(&notify2.MailLog{})
	if s := strings.TrimSpace(c.Query("status")); s != "" && s != "all" {
		q = q.Where("status = ?", s)
	}
	if s := strings.TrimSpace(c.Query("provider")); s != "" {
		q = q.Where("provider = ?", s)
	}
	if s := strings.TrimSpace(c.Query("channel_name")); s != "" {
		q = q.Where("channel_name = ?", s)
	}
	if s := strings.TrimSpace(c.Query("search")); s != "" {
		like := "%" + s + "%"
		q = q.Where("to_email LIKE ? OR subject LIKE ?", like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	var list []notify2.MailLog
	if err := q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error; err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "ok", gin.H{
		"list": list, "total": total, "page": page, "pageSize": pageSize,
	})
}

func (h *Handlers) handleGetMailLogDetail(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	row, err := notify2.GetMailLogByID(h.db, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Fail(c, "Mail log not found", nil)
			return
		}
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	response.SuccessMsg(c, "ok", row)
}

func (h *Handlers) handleGetMailLogStats(c *gin.Context) {
	type row struct {
		Status string
		Cnt    int64
	}
	var rows []row
	if err := h.db.Model(&notify2.MailLog{}).Select("status, count(*) as cnt").Group("status").Scan(&rows).Error; err != nil {
		response.AbortWithStatusJSON(c, http.StatusInternalServerError, err)
		return
	}
	out := map[string]int64{"total": 0}
	for _, r := range rows {
		out[r.Status] = r.Cnt
		out["total"] += r.Cnt
	}
	response.SuccessMsg(c, "ok", out)
}

func parseUintParam(c *gin.Context, name string) (uint, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || id == 0 {
		response.Fail(c, "invalid id", err)
		return 0, false
	}
	return uint(id), true
}

type mailTestReq struct {
	To      string         `json:"to"`
	Mode    string         `json:"mode"`
	Code    string         `json:"code"`
	Vars    map[string]any `json:"vars"`
	Subject string         `json:"subject"`
	Body    string         `json:"body"`
}

func (h *Handlers) handleTestSendMail(c *gin.Context) {
	var req mailTestReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err)
		return
	}
	mail := notify2.TestMail{
		To:      req.To,
		Mode:    req.Mode,
		Code:    req.Code,
		Vars:    req.Vars,
		Subject: req.Subject,
		Body:    req.Body,
	}.Normalize()
	if err := mail.Validate(); err != nil {
		response.Fail(c, err.Error(), err)
		return
	}
	userID := uint(0)
	if u := auth.CurrentUser(c); u != nil {
		userID = u.ID
	}
	mailer := notify2.NewMailer(h.db, userID, c.ClientIP())
	if err := mail.Send(c.Request.Context(), mailer); err != nil {
		response.Fail(c, err.Error(), err)
		return
	}
	response.SuccessMsg(c, "sent", gin.H{"to": mail.To, "mode": mail.Mode})
}
