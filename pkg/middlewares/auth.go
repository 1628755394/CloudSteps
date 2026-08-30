// 鉴权中间件与当前用户（原 internal/auth）。
package middlewares

import (
	"errors"
	"net/http"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/constants"
	"github.com/LingByte/CloudStepsGo/internal/models"
	lbconstants "github.com/LingByte/ling-base/common/constants"
	lbresponse "github.com/LingByte/ling-base/common/response"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Required 登录校验：session 或 Authorization / token 哈希。
func Required(c *gin.Context) {
	if CurrentUser(c) != nil {
		c.Next()
		return
	}
	if configs.Global == nil {
		response.FailI18n(c, "auth.config_uninitialized", nil)
		c.Abort()
		return
	}
	token := c.GetHeader(configs.Global.Auth.Header)
	if token == "" {
		token = c.Query("token")
	}
	if token == "" {
		response.FailI18n(c, "auth.authorization_required", nil)
		c.Abort()
		return
	}
	db := c.MustGet(lbconstants.DbField).(*gorm.DB)
	token = strings.TrimPrefix(token, constants.AUTHORIZATION_PREFIX)
	user, err := models.DecodeHashToken(db, token, false)
	if err != nil {
		response.FailI18n(c, "auth.invalid_token", nil)
		c.Abort()
		return
	}
	if err := models.CheckUserAllowLogin(db, user); err != nil {
		response.AbortWithStatusJSON(c, http.StatusUnauthorized, err)
		return
	}
	c.Set(constants.UserField, user)
	c.Next()
}

// CurrentUser 从 context / session 解析当前用户。
func CurrentUser(c *gin.Context) *models.User {
	if cachedObj, exists := c.Get(constants.UserField); exists && cachedObj != nil {
		if u, ok := cachedObj.(*models.User); ok {
			return u
		}
	}
	session := sessions.Default(c)
	userId := session.Get(constants.UserField)
	if userId == nil {
		return nil
	}
	uid, ok := userId.(uint)
	if !ok {
		return nil
	}
	dbVal, exists := c.Get(lbconstants.DbField)
	if !exists {
		return nil
	}
	db, ok := dbVal.(*gorm.DB)
	if !ok {
		return nil
	}
	user, err := models.GetUserByUID(db, uid)
	if err != nil {
		return nil
	}
	c.Set(constants.UserField, user)
	return user
}

// AdminRequired 需管理员。
func AdminRequired(c *gin.Context) {
	user := CurrentUser(c)
	if user == nil || !user.IsAdmin() {
		response.FailI18n(c, "auth.admin_required", nil)
		c.Abort()
		return
	}
	c.Next()
}

// TeacherOrAdminRequired 需老师或管理员。
func TeacherOrAdminRequired(c *gin.Context) {
	user := CurrentUser(c)
	if user == nil || (!user.IsTeacher() && !user.IsAdmin()) {
		response.FailI18n(c, "auth.teacher_required", nil)
		c.Abort()
		return
	}
	c.Next()
}

// StudentOrAdminRequired 需学员或管理员。
func StudentOrAdminRequired(c *gin.Context) {
	user := CurrentUser(c)
	if user == nil || (!user.IsStudent() && !user.IsAdmin()) {
		response.FailI18n(c, "auth.student_required", nil)
		c.Abort()
		return
	}
	c.Next()
}

// AbortForbiddenI18n 便捷：禁止访问。
func AbortForbiddenI18n(c *gin.Context, key string) {
	_ = lbresponse.KeyForbidden
	response.FailI18n(c, key, nil)
	c.Abort()
}

// ErrI18n 构造可翻译业务错误（供 handlers 使用）。
func ErrI18n(code lbresponse.Code, key string) error {
	return lbresponse.NewI18n(code, key)
}

var (
	ErrUnauthorized = errors.New("unauthorized")
)
