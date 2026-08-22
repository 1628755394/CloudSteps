package listeners

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/internal/notify"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	common "github.com/LingByte/ling-base/common"
	"github.com/LingByte/ling-base/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// InitAuthMailListeners wires auth Sig events to async email and inbox notification handlers.
func InitAuthMailListeners(db *gorm.DB) {
	if db == nil {
		return
	}
	authMailListenersOnce.Do(func() {
		initAuthMailListeners(db)
	})
}

var authMailListenersOnce sync.Once

func initAuthMailListeners(db *gorm.DB) {
	_ = db.AutoMigrate(&models.MailTemplate{})
	_ = models.SplitLegacyMailTemplates(db)

	connectAsync := func(event string, fn func(*gorm.DB, ...any)) {
		common.Sig().Connect(event, func(_ any, params ...any) {
			workDB := db
			workParams := params
			if n := len(params); n > 0 {
				if passed, ok := params[n-1].(*gorm.DB); ok {
					workDB = passed
					workParams = params[:n-1]
				}
			}
			go fn(workDB, workParams...)
		})
	}

	connectAsync(constants.SigUserCreate, deliverWelcomeEmail)
	connectAsync(constants.SigUserCreate, deliverWelcomeInbox)
	connectAsync(constants.SigUserVerifyEmail, deliverVerificationEmail)
	connectAsync(constants.SigUserVerifyEmail, deliverVerificationInbox)
	connectAsync(constants.SigUserResetPassword, deliverPasswordResetEmail)
	connectAsync(constants.SigUserResetPassword, deliverPasswordResetInbox)
	connectAsync(constants.SigUserNewDeviceLogin, deliverNewDeviceLoginEmail)
	connectAsync(constants.SigUserNewDeviceLogin, deliverNewDeviceLoginInbox)
	connectAsync(constants.SigUserLogin, deliverLoginEmail)
	connectAsync(constants.SigUserLogin, deliverLoginInbox)
	connectAsync(constants.SigUserLogout, deliverLogoutEmail)
	connectAsync(constants.SigUserLogout, deliverLogoutInbox)
	connectAsync(constants.SigUserChangeEmail, deliverChangeEmailEmail)
	connectAsync(constants.SigUserChangeEmail, deliverChangeEmailInbox)
	connectAsync(constants.SigUserChangeEmailDone, deliverChangeEmailDoneEmail)
	connectAsync(constants.SigUserChangeEmailDone, deliverChangeEmailDoneInbox)
	logger.Info("auth mail Sig listeners registered")
}

func deliverWelcomeEmail(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	username := displayName(user)
	mailer := notify.NewMailer(db, user.ID, user.LastLoginIP)
	if err := mailer.SendWelcomeEmail(user.Username, username, siteURL()+"/login"); err != nil {
		logger.Warn("auth notify: welcome email failed",
			zap.Uint("userId", user.ID), zap.String("email", user.Username), zap.Error(err))
	}
}

func deliverWelcomeInbox(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	mailer := notify.NewMailer(db, user.ID, user.LastLoginIP)
	if err := mailer.SendInbox(notify.TmplWelcome, map[string]any{
		"Username": displayName(user), "VerifyURL": siteURL() + "/login",
	}); err != nil {
		logger.Warn("auth notify: welcome inbox failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverVerificationEmail(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	hash := nthString(params, 1)
	ip := nthString(params, 2)
	mailer := notify.NewMailer(db, user.ID, ip)
	if err := mailer.SendVerificationEmail(user.Username, displayName(user), actionURL("/auth/verify-email", "token", hash)); err != nil {
		logger.Warn("auth notify: verification email failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverVerificationInbox(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	mailer := notify.NewMailer(db, user.ID, nthString(params, 2))
	if err := mailer.SendInbox(notify.TmplEmailVerification, map[string]any{
		"Username": displayName(user),
	}); err != nil {
		logger.Warn("auth notify: verification inbox failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverPasswordResetEmail(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	token := nthString(params, 1)
	ip := nthString(params, 2)
	mailer := notify.NewMailer(db, user.ID, ip)
	if err := mailer.SendPasswordResetEmail(user.Username, displayName(user), actionURL("/reset-password", "token", token)); err != nil {
		logger.Warn("auth notify: password reset email failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverPasswordResetInbox(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	mailer := notify.NewMailer(db, user.ID, nthString(params, 2))
	if err := mailer.SendInbox(notify.TmplPasswordReset, map[string]any{
		"Username": displayName(user),
	}); err != nil {
		logger.Warn("auth notify: password reset inbox failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverNewDeviceLoginEmail(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	meta := buildLoginMeta(user, params)
	mailer := notify.NewMailer(db, user.ID, meta.ip)
	if err := mailer.SendNewDeviceLoginAlert(
		user.Username, displayName(user), meta.loginTime, meta.ip, meta.location,
		meta.deviceType, meta.osName, meta.browser, meta.suspicious, "", "",
	); err != nil {
		logger.Warn("auth notify: new device login email failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverNewDeviceLoginInbox(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	meta := buildLoginMeta(user, params)
	mailer := notify.NewMailer(db, user.ID, meta.ip)
	if err := mailer.SendInbox(notify.TmplNewDeviceLogin, map[string]any{
		"Username":          displayName(user),
		"LoginTime":         meta.loginTime,
		"IPAddress":         meta.ip,
		"Location":          meta.location,
		"DeviceType":        meta.deviceType,
		"OS":                meta.osName,
		"Browser":           meta.browser,
		"DeviceLabel":       notifyFormatLoginDeviceLabel(meta.deviceType, meta.osName, meta.browser),
		"IsSuspicious":      meta.suspicious,
		"SecurityURL":       "",
		"ChangePasswordURL": "",
	}); err != nil {
		logger.Warn("auth notify: new device login inbox failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverLoginEmail(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	ip := resolveClientIP(user, params)
	mailer := notify.NewMailer(db, user.ID, ip)
	if err := mailer.SendLoginNotice(
		user.Username, displayName(user), time.Now().Format("2006-01-02 15:04:05"), ip,
	); err != nil {
		logger.Warn("auth notify: login email failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverLoginInbox(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	ip := resolveClientIP(user, params)
	loginTime := time.Now().Format("2006-01-02 15:04:05")
	mailer := notify.NewMailer(db, user.ID, ip)
	if err := mailer.SendInbox(notify.TmplLogin, map[string]any{
		"Username": displayName(user), "LoginTime": loginTime, "IPAddress": ip,
	}); err != nil {
		logger.Warn("auth notify: login inbox failed",
			zap.Uint("userId", user.ID), zap.Error(err))
		return
	}
	logger.Info("auth notify: login inbox sent", zap.Uint("userId", user.ID))
}

func deliverLogoutEmail(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	ip := resolveClientIP(user, params)
	mailer := notify.NewMailer(db, user.ID, ip)
	if err := mailer.SendLogoutNotice(
		user.Username, displayName(user), time.Now().Format("2006-01-02 15:04:05"), ip,
	); err != nil {
		logger.Warn("auth notify: logout email failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverLogoutInbox(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	ip := resolveClientIP(user, params)
	logoutTime := time.Now().Format("2006-01-02 15:04:05")
	mailer := notify.NewMailer(db, user.ID, ip)
	if err := mailer.SendInbox(notify.TmplLogout, map[string]any{
		"Username": displayName(user), "LogoutTime": logoutTime, "IPAddress": ip,
	}); err != nil {
		logger.Warn("auth notify: logout inbox failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverChangeEmailEmail(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	hash := nthString(params, 1)
	ip := nthString(params, 2)
	newEmail := nthString(params, 4)
	if strings.TrimSpace(newEmail) == "" {
		newEmail = user.Username
	}
	mailer := notify.NewMailer(db, user.ID, ip)
	if err := mailer.SendChangeEmailVerification(
		user.Username, displayName(user), newEmail,
		actionURL("/auth/change-email", "token", hash),
	); err != nil {
		logger.Warn("auth notify: change email verification failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverChangeEmailInbox(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	newEmail := nthString(params, 4)
	if strings.TrimSpace(newEmail) == "" {
		newEmail = user.Username
	}
	mailer := notify.NewMailer(db, user.ID, nthString(params, 2))
	if err := mailer.SendInbox(notify.TmplChangeEmail, map[string]any{
		"Username": displayName(user), "NewEmail": newEmail,
	}); err != nil {
		logger.Warn("auth notify: change email inbox failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverChangeEmailDoneEmail(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	oldEmail := nthString(params, 1)
	newEmail := nthString(params, 2)
	mailer := notify.NewMailer(db, user.ID, user.LastLoginIP)
	if err := mailer.SendChangeEmailDoneNotice(
		user.Username, displayName(user), oldEmail, newEmail,
	); err != nil {
		logger.Warn("auth notify: change email done email failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func deliverChangeEmailDoneInbox(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	mailer := notify.NewMailer(db, user.ID, user.LastLoginIP)
	if err := mailer.SendInbox(notify.TmplChangeEmailDone, map[string]any{
		"Username": displayName(user),
		"OldEmail": nthString(params, 1),
		"NewEmail": nthString(params, 2),
	}); err != nil {
		logger.Warn("auth notify: change email done inbox failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func resolveClientIP(user *models.User, params []any) string {
	if ip := clientIPFromGin(params); ip != "" {
		return ip
	}
	if user != nil && strings.TrimSpace(user.LastLoginIP) != "" {
		return user.LastLoginIP
	}
	return ""
}

func clientIPFromGin(params []any) string {
	for _, p := range params {
		if c, ok := p.(*gin.Context); ok && c != nil {
			return c.ClientIP()
		}
	}
	return ""
}

type loginEventMeta struct {
	loginTime, ip, location, deviceType, osName, browser string
	suspicious                                           bool
}

func buildLoginMeta(user *models.User, params []any) loginEventMeta {
	meta := loginEventMeta{
		loginTime: time.Now().Format("2006-01-02 15:04:05"),
		ip:        user.LastLoginIP,
	}
	if info, ok := nthMap(params, 1); ok {
		if v, ok := info["loginTime"].(string); ok && v != "" {
			meta.loginTime = v
		}
		if v, ok := info["clientIP"].(string); ok && v != "" {
			meta.ip = v
		}
		if v, ok := info["location"].(string); ok {
			meta.location = v
		}
		if v, ok := info["deviceType"].(string); ok {
			meta.deviceType = v
		}
		if v, ok := info["os"].(string); ok {
			meta.osName = v
		}
		if v, ok := info["browser"].(string); ok {
			meta.browser = v
		}
		if v, ok := info["isSuspicious"].(bool); ok {
			meta.suspicious = v
		}
	}
	return meta
}

func notifyFormatLoginDeviceLabel(deviceType, os, browser string) string {
	label := strings.TrimSpace(deviceType)
	switch strings.ToLower(label) {
	case "desktop":
		label = "桌面端"
	case "mobile":
		label = "移动端"
	case "":
		label = "未知设备"
	}
	if os = strings.TrimSpace(os); os != "" {
		label += " · " + os
	}
	if browser = strings.TrimSpace(browser); browser != "" {
		label += " · " + browser
	}
	return label
}

func siteURL() string {
	if config.GlobalConfig == nil {
		return ""
	}
	return strings.TrimRight(config.GlobalConfig.Server.URL, "/")
}

func actionURL(path, queryKey, queryVal string) string {
	base := siteURL()
	if queryVal == "" {
		return base + path
	}
	sep := "?"
	if strings.Contains(path, "?") {
		sep = "&"
	}
	return base + path + sep + queryKey + "=" + queryVal
}

func displayName(user *models.User) string {
	if user.DisplayName != "" {
		return user.DisplayName
	}
	return user.Username
}

func firstUser(params []any) (*models.User, bool) {
	for _, p := range params {
		if u, ok := p.(*models.User); ok && u != nil {
			return u, true
		}
	}
	return nil, false
}

func nthString(params []any, i int) string {
	if i < 0 || i >= len(params) {
		return ""
	}
	switch v := params[i].(type) {
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	default:
		return fmt.Sprint(v)
	}
}

func nthMap(params []any, i int) (map[string]any, bool) {
	if i < 0 || i >= len(params) {
		return nil, false
	}
	switch v := params[i].(type) {
	case map[string]any:
		return v, true
	default:
		return nil, false
	}
}
