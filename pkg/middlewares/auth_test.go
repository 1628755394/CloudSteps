package middlewares

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/constants"
	"github.com/LingByte/CloudStepsGo/internal/models"
	lbconstants "github.com/LingByte/ling-base/common/constants"
	lbresponse "github.com/LingByte/ling-base/common/response"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ===== CurrentUser =====

func TestCurrentUser_FromContextCache(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	u := &models.User{Username: "cached"}
	c.Set(constants.UserField, u)
	assert.Same(t, u, CurrentUser(c))
}

func TestCurrentUser_ContextValueNotUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(sessions.Sessions(SessionField(), cookie.NewStore([]byte("x"))))
	r.GET("/", func(c *gin.Context) {
		// non-*models.User value stored under UserField -> falls through to session
		c.Set(constants.UserField, "not-a-user")
		// no session user -> returns nil
		assert.Nil(t, CurrentUser(c))
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCurrentUser_SessionNilUserID(t *testing.T) {
	db := newTestDB(t)
	r := newEngineWithDB(t, db)
	r.GET("/", func(c *gin.Context) {
		assert.Nil(t, CurrentUser(c))
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCurrentUser_SessionUserIDNotUint(t *testing.T) {
	db := newTestDB(t)
	r := newEngineWithDB(t, db)
	r.GET("/", func(c *gin.Context) {
		sess := sessions.Default(c)
		sess.Set(constants.UserField, "not-uint")
		_ = sess.Save()
		// re-read in same request after save
		assert.Nil(t, CurrentUser(c))
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCurrentUser_NoDBInContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(sessions.Sessions(SessionField(), cookie.NewStore([]byte("x"))))
	r.GET("/", func(c *gin.Context) {
		sess := sessions.Default(c)
		sess.Set(constants.UserField, uint(1))
		require.NoError(t, sess.Save())
		// no DB set in context -> CurrentUser returns nil
		assert.Nil(t, CurrentUser(c))
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCurrentUser_DBWrongType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(sessions.Sessions(SessionField(), cookie.NewStore([]byte("x"))))
	r.Use(func(c *gin.Context) {
		c.Set(lbconstants.DbField, "not-a-db")
		c.Next()
	})
	r.GET("/", func(c *gin.Context) {
		sess := sessions.Default(c)
		sess.Set(constants.UserField, uint(1))
		_ = sess.Save()
		assert.Nil(t, CurrentUser(c))
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCurrentUser_GetUserByUIDError(t *testing.T) {
	db := newTestDB(t)
	r := newEngineWithDB(t, db)
	r.GET("/", func(c *gin.Context) {
		sess := sessions.Default(c)
		sess.Set(constants.UserField, uint(9999)) // non-existent
		_ = sess.Save()
		assert.Nil(t, CurrentUser(c))
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCurrentUser_SuccessFromSession(t *testing.T) {
	db := newTestDB(t)
	u := seedUser(t, db, "alice", models.RoleTeacher)
	r := newEngineWithDB(t, db)

	var captured *models.User
	r.GET("/", func(c *gin.Context) {
		sess := sessions.Default(c)
		sess.Set(constants.UserField, u.ID)
		require.NoError(t, sess.Save())
		got := CurrentUser(c)
		require.NotNil(t, got)
		captured = got
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	require.NotNil(t, captured)
	assert.Equal(t, u.ID, captured.ID)
}

// ===== Required =====

func TestRequired_CurrentUserPresent(t *testing.T) {
	db := newTestDB(t)
	r := newEngineWithDB(t, db)
	called := false
	r.GET("/", Required, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	// Pre-set user via a middleware before Required.
	r2 := gin.New()
	r2.Use(sessions.Sessions(SessionField(), cookie.NewStore([]byte("x"))))
	r2.Use(func(c *gin.Context) {
		c.Set(lbconstants.DbField, db)
		c.Set(constants.UserField, &models.User{Username: "x"})
		c.Next()
	})
	r2.GET("/", Required, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	r2.ServeHTTP(w, req)
	assert.True(t, called)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequired_GlobalNil(t *testing.T) {
	withGlobalConfig(t, nil)
	db := newTestDB(t)
	r := newEngineWithDB(t, db)
	r.GET("/", Required, func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	// FailI18n writes HTTP 200 with business error envelope
	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.NotEmpty(t, body)
}

func TestRequired_NoToken(t *testing.T) {
	withGlobalConfig(t, &configs.Config{Auth: configs.AuthConfig{Header: "Authorization"}})
	db := newTestDB(t)
	r := newEngineWithDB(t, db)
	r.GET("/", Required, func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.NotEmpty(t, body)
}

func TestRequired_InvalidToken(t *testing.T) {
	withGlobalConfig(t, &configs.Config{Auth: configs.AuthConfig{Header: "Authorization"}})
	db := newTestDB(t)
	r := newEngineWithDB(t, db)
	r.GET("/", Required, func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/?token=bad-token", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequired_ValidToken(t *testing.T) {
	withGlobalConfig(t, &configs.Config{Auth: configs.AuthConfig{Header: "Authorization"}})
	db := newTestDB(t)
	u := seedUser(t, db, "bob", models.RoleTeacher)
	r := newEngineWithDB(t, db)
	called := false
	r.GET("/", Required, func(c *gin.Context) {
		called = true
		got, exists := c.Get(constants.UserField)
		require.True(t, exists)
		require.NotNil(t, got)
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", constants.AUTHORIZATION_PREFIX+validTokenFor(t, u))
	r.ServeHTTP(w, req)
	assert.True(t, called)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequired_TokenFromQuery(t *testing.T) {
	withGlobalConfig(t, &configs.Config{Auth: configs.AuthConfig{Header: "Authorization"}})
	db := newTestDB(t)
	u := seedUser(t, db, "carol", models.RoleStudent)
	r := newEngineWithDB(t, db)
	called := false
	r.GET("/", Required, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/?token="+validTokenFor(t, u), nil)
	r.ServeHTTP(w, req)
	assert.True(t, called)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequired_TokenWithBearerPrefixStripped(t *testing.T) {
	withGlobalConfig(t, &configs.Config{Auth: configs.AuthConfig{Header: "Authorization"}})
	db := newTestDB(t)
	u := seedUser(t, db, "dave", models.RoleAdmin)
	r := newEngineWithDB(t, db)
	called := false
	r.GET("/", Required, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	tok := validTokenFor(t, u)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(w, req)
	assert.True(t, called)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequired_UserNotAllowedLogin(t *testing.T) {
	withGlobalConfig(t, &configs.Config{Auth: configs.AuthConfig{Header: "Authorization"}})
	db := newTestDB(t)
	u := seedUser(t, db, "banned", models.RoleTeacher)
	// soft-delete the user so CheckUserAllowLogin fails
	require.NoError(t, db.Model(&models.User{}).Where("id = ?", u.ID).Update("deleted_at", "2020-01-01").Error)

	r := newEngineWithDB(t, db)
	called := false
	r.GET("/", Required, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", constants.AUTHORIZATION_PREFIX+validTokenFor(t, u))
	r.ServeHTTP(w, req)
	assert.False(t, called)
	// AbortWithStatusJSON writes HTTP 200
	assert.Equal(t, http.StatusOK, w.Code)
}

// ===== AdminRequired =====

func TestAdminRequired_Admin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(constants.UserField, &models.User{Role: models.RoleAdmin})
		c.Next()
	})
	called := false
	r.GET("/", AdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.True(t, called)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminRequired_NonAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(constants.UserField, &models.User{Role: models.RoleTeacher})
		c.Next()
	})
	called := false
	r.GET("/", AdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.False(t, called)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminRequired_NilUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(sessions.Sessions(SessionField(), cookie.NewStore([]byte("x"))))
	called := false
	r.GET("/", AdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.False(t, called)
	assert.Equal(t, http.StatusOK, w.Code)
}

// ===== TeacherOrAdminRequired =====

func TestTeacherOrAdminRequired_Teacher(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(constants.UserField, &models.User{Role: models.RoleTeacher})
		c.Next()
	})
	called := false
	r.GET("/", TeacherOrAdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.True(t, called)
}

func TestTeacherOrAdminRequired_Admin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(constants.UserField, &models.User{Role: models.RoleAdmin})
		c.Next()
	})
	called := false
	r.GET("/", TeacherOrAdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.True(t, called)
}

func TestTeacherOrAdminRequired_Student(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(constants.UserField, &models.User{Role: models.RoleStudent})
		c.Next()
	})
	called := false
	r.GET("/", TeacherOrAdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.False(t, called)
}

func TestTeacherOrAdminRequired_NilUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(sessions.Sessions(SessionField(), cookie.NewStore([]byte("x"))))
	called := false
	r.GET("/", TeacherOrAdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.False(t, called)
}

// ===== StudentOrAdminRequired =====

func TestStudentOrAdminRequired_Student(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(constants.UserField, &models.User{Role: models.RoleStudent})
		c.Next()
	})
	called := false
	r.GET("/", StudentOrAdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.True(t, called)
}

func TestStudentOrAdminRequired_Admin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(constants.UserField, &models.User{Role: models.RoleAdmin})
		c.Next()
	})
	called := false
	r.GET("/", StudentOrAdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.True(t, called)
}

func TestStudentOrAdminRequired_Teacher(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(constants.UserField, &models.User{Role: models.RoleTeacher})
		c.Next()
	})
	called := false
	r.GET("/", StudentOrAdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.False(t, called)
}

func TestStudentOrAdminRequired_NilUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(sessions.Sessions(SessionField(), cookie.NewStore([]byte("x"))))
	called := false
	r.GET("/", StudentOrAdminRequired, func(c *gin.Context) {
		called = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)
	assert.False(t, called)
}

// ===== AbortForbiddenI18n / ErrI18n =====

func TestAbortForbiddenI18n(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	AbortForbiddenI18n(c, "some.key")
	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestErrI18n(t *testing.T) {
	err := ErrI18n(lbresponse.CodeForbidden, "auth.admin_required")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "admin_required")
}

func TestErrUnauthorized(t *testing.T) {
	assert.EqualError(t, ErrUnauthorized, "unauthorized")
}
