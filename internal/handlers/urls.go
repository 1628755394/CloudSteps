package handlers

import (
	"net/http"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/internal/sysmetrics"
	"github.com/LingByte/CloudStepsGo/internal/voice"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/CloudStepsGo/pkg/middleware"
	"github.com/LingByte/ling-base/cache/lru"
	lbconfig "github.com/LingByte/ling-base/common/config"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handlers struct {
	db              *gorm.DB
	cache           *lru.Cache[string, any]
	configStore     *lbconfig.Store
	sysMetrics      *sysmetrics.Service
	realtimeFactory *voice.RealtimeFactory
}

func NewHandlers(db *gorm.DB, cache *lru.Cache[string, any], configStore *lbconfig.Store, metrics *sysmetrics.Service) *Handlers {
	return &Handlers{
		db:          db,
		cache:       cache,
		configStore: configStore,
		sysMetrics:  metrics,
	}
}

func (h *Handlers) Register(engine *gin.Engine) {
	r := engine.Group(config.GlobalConfig.Server.APIPrefix)

	// Register Global Singleton DB + Config Store
	r.Use(middleware.InjectDB(h.db))
	if h.configStore != nil {
		r.Use(func(c *gin.Context) {
			c.Set(constants.ConfigField, h.configStore)
			c.Next()
		})
	}
	if h.sysMetrics != nil {
		r.Use(h.sysMetrics.Middleware())
	}

	// Apply global middlewares (rate limiting, timeout, circuit breaker, operation log)
	middleware.ApplyGlobalMiddlewares(r)
	// Register Business Module Routes
	h.registerAuthRoutes(r)
	h.registerAdminUserRoutes(r)
	h.registerSecurityRoutes(r)
	h.registerWordBookRoutes(r)
	h.registerLearningRoutes(r)
	h.registerVocabTestRoutes(r)
	h.registerReadingRoutes(r)
	h.registerClozeRoutes(r)
	h.registerGrammarRoutes(r)
	h.registerNotificationRoutes(r)
	h.registerNotificationAdminRoutes(r)
	h.registerAnnouncementRoutes(r)
	h.registerStorageAdminRoutes(r)
	h.registerCoachingRoutes(r)
	h.registerFeedbackRoutes(r)
	h.registerFeedbackAdminRoutes(r)
	h.registerUserWordAdminRoutes(r)
	h.registerScenarioDialogueRoutes(r)
	h.registerTTSRoutes(r)
	h.registerMetricsRoutes(r)
}

func (h *Handlers) requireAdmin(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil || !user.IsAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "msg": "需要管理员权限"})
		c.Abort()
		return
	}
	c.Next()
}
