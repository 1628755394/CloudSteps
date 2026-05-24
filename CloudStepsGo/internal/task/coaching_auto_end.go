package task

import (
	"github.com/LingByte/CloudStepsGo/internal/handlers"
	"github.com/LingByte/CloudStepsGo/pkg/logger"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// StartCoachingAutoEnd 每分钟检查并自动结束已超时陪练课
func StartCoachingAutoEnd(db *gorm.DB) {
	c := cron.New()
	_, err := c.AddFunc("* * * * *", func() {
		n, err := handlers.CoachingAutoEndOverdueSessions(db)
		if err != nil {
			logger.Error("coaching auto end failed", zap.Error(err))
			return
		}
		if n > 0 {
			logger.Info("coaching auto end completed", zap.Int("count", n))
		}
	})
	if err != nil {
		logger.Error("failed to add coaching auto end cron", zap.Error(err))
		return
	}
	c.Start()
	logger.Info("coaching auto end scheduler started (every minute)")
}
