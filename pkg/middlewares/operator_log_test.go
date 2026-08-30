package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"github.com/LingByte/CloudStepsGo/internal/models"
	lbconstants "github.com/LingByte/ling-base/common/constants"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ===== OperationLog model =====

func TestOperationLog_TableName(t *testing.T) {
	assert.Equal(t, "operation_logs", OperationLog{}.TableName())
}

// ===== CreateOperationLog =====

func TestCreateOperationLog_Success(t *testing.T) {
	db := newTestDB(t)
	err := CreateOperationLog(db, 1, "alice", "POST", "/api/x", "desc", "127.0.0.1",
		"ua", "referer", "Linux", "Chrome120", "macOS", "Local", "POST")
	require.NoError(t, err)

	var log OperationLog
	require.NoError(t, db.First(&log, 1).Error)
	assert.Equal(t, uint(1), log.UserID)
	assert.Equal(t, "alice", log.Username)
	assert.Equal(t, "POST", log.Action)
	assert.Equal(t, "/api/x", log.Target)
	assert.Equal(t, "desc", log.Details)
	assert.Equal(t, "127.0.0.1", log.IPAddress)
	assert.Equal(t, "ua", log.UserAgent)
	assert.Equal(t, "referer", log.Referer)
	assert.Equal(t, "Linux", log.Device)
	assert.Equal(t, "Chrome120", log.Browser)
	assert.Equal(t, "macOS", log.OperatingSystem)
	assert.Equal(t, "Local", log.Location)
	assert.Equal(t, "POST", log.RequestMethod)
	assert.False(t, log.CreatedAt.IsZero())
}

func TestCreateOperationLog_EmptyFields(t *testing.T) {
	db := newTestDB(t)
	err := CreateOperationLog(db, 0, "", "", "", "", "", "", "", "", "", "", "", "")
	require.NoError(t, err)

	var log OperationLog
	require.NoError(t, db.First(&log).Error)
	assert.Equal(t, uint(0), log.UserID)
}

// ===== getGeoLocation =====

func TestGetGeoLocation_LocalIP(t *testing.T) {
	loc := getGeoLocation("127.0.0.1")
	assert.Equal(t, "Local Network", loc.(string))
}

func TestGetGeoLocation_Loopback(t *testing.T) {
	loc := getGeoLocation("::1")
	// ::1 is loopback -> Local Network
	assert.Equal(t, "Local Network", loc.(string))
}

func TestGetGeoLocation_Empty(t *testing.T) {
	loc := getGeoLocation("")
	// empty IP -> likely error -> "Unknown"
	assert.NotNil(t, loc)
}

// ===== OperationLogMiddleware =====

func TestOperationLogMiddleware_NoUserSkips(t *testing.T) {
	db := newTestDB(t)
	r := newEngineWithDB(t, db)
	r.Use(OperationLogMiddleware())
	r.POST("/api/auth/login/password", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login/password", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// no log row should exist
	var count int64
	db.Model(&OperationLog{}).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestOperationLogMiddleware_UserNotUserModelSkips(t *testing.T) {
	db := newTestDB(t)
	r := newEngineWithDB(t, db)
	r.Use(OperationLogMiddleware())
	r.POST("/api/auth/login/password", func(c *gin.Context) {
		c.Set(constants.UserField, "not-a-user")
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login/password", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var count int64
	db.Model(&OperationLog{}).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestOperationLogMiddleware_GetRequestSkips(t *testing.T) {
	db := newTestDB(t)
	u := seedUser(t, db, "alice", models.RoleTeacher)
	r := newEngineWithDB(t, db)
	r.Use(OperationLogMiddleware())
	r.GET("/api/auth/login/password", func(c *gin.Context) {
		c.Set(constants.UserField, u)
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/login/password", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var count int64
	db.Model(&OperationLog{}).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestOperationLogMiddleware_RecordsImportantPost(t *testing.T) {
	db := newTestDB(t)
	u := seedUser(t, db, "alice", models.RoleTeacher)
	r := newEngineWithDB(t, db)
	r.Use(OperationLogMiddleware())
	r.POST("/api/auth/login/password", func(c *gin.Context) {
		c.Set(constants.UserField, u)
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login/password", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// the log is written asynchronously; wait briefly for it
	require.Eventually(t, func() bool {
		var count int64
		db.Model(&OperationLog{}).Count(&count)
		return count == 1
	}, 2*time.Second, 50*time.Millisecond)

	var log OperationLog
	require.NoError(t, db.First(&log).Error)
	assert.Equal(t, u.ID, log.UserID)
	assert.Equal(t, "alice", log.Username)
	assert.Equal(t, "POST", log.Action)
	assert.Equal(t, "/api/auth/login/password", log.Target)
}

func TestOperationLogMiddleware_AlreadyLoggedSkips(t *testing.T) {
	db := newTestDB(t)
	u := seedUser(t, db, "bob", models.RoleTeacher)
	r := newEngineWithDB(t, db)
	r.Use(OperationLogMiddleware())
	r.POST("/api/auth/login/password", func(c *gin.Context) {
		c.Set(constants.UserField, u)
		// mark as already logged
		MarkOperationLogged(c)
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login/password", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// give the async writer a moment (should NOT write anything)
	time.Sleep(100 * time.Millisecond)
	var count int64
	db.Model(&OperationLog{}).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestOperationLogMiddleware_NoDBInContextPanicsRecovered(t *testing.T) {
	// OperationLogMiddleware calls c.MustGet(lbconstants.DbField) which panics
	// if DB is not in context. Use gin's recovery to ensure the test doesn't crash.
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(OperationLogMiddleware())
	r.POST("/api/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/x", nil)
	r.ServeHTTP(w, req)
	// Recovery returns 500; the important thing is no test crash.
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ===== operationLogConfig global var =====

func TestOperationLogConfigGlobalVar(t *testing.T) {
	assert.NotNil(t, operationLogConfig)
	assert.True(t, operationLogConfig.Enabled)
}

// ===== Ensure DbField constant is the expected value =====

func TestDbFieldConstant(t *testing.T) {
	assert.Equal(t, "_ling_db", lbconstants.DbField)
}
