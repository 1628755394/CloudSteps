package handlers

import (
	"net/http"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/internal/voice"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/middleware"
	"github.com/LingByte/CloudStepsGo/pkg/utils"
	"github.com/LingByte/lingllm/protocol/voice/xiaozhi"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handlers struct {
	db                *gorm.DB
	ipLocationService *utils.IPLocationService
	realtimeFactory   *voice.RealtimeFactory
	xiaozhiServer     *xiaozhi.Server
}

func NewHandlers(db *gorm.DB) *Handlers {
	return &Handlers{
		db: db,
	}
}

func (h *Handlers) Register(engine *gin.Engine) {
	r := engine.Group(config.GlobalConfig.Server.APIPrefix)

	// Register Global Singleton DB
	r.Use(middleware.InjectDB(h.db))

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
	h.registerCoachingRoutes(r)
	h.registerScenarioDialogueRoutes(r)
	h.registerTTSRoutes(r)
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
