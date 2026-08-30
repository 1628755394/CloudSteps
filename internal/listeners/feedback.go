package listeners

import (
	"github.com/LingByte/CloudStepsGo/internal/constants"
	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/notify"
	"github.com/LingByte/ling-base/common"
	"github.com/LingByte/ling-base/common/logger"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// InitFeedbackListeners wires admin ticket replies to an inbox ping (not the reply itself).
func InitFeedbackListeners(db *gorm.DB) {
	if db == nil {
		return
	}
	common.Sig().Connect(constants.SigFeedbackAdminReplied, func(_ any, params ...any) {
		workDB := db
		workParams := params
		if n := len(params); n > 0 {
			if passed, ok := params[n-1].(*gorm.DB); ok {
				workDB = passed
				workParams = params[:n-1]
			}
		}
		go deliverFeedbackReplyInbox(workDB, workParams...)
	})
	logger.Info("feedback module listener is already")
}

func deliverFeedbackReplyInbox(db *gorm.DB, params ...any) {
	user, ok := firstUser(params)
	if !ok {
		return
	}
	reply, ok := firstFeedbackReply(params)
	if !ok {
		return
	}
	mailer := notify.NewMailer(db, user.ID, resolveClientIP(user, params))
	if err := mailer.SendInbox(notify.TmplFeedbackReply, map[string]any{
		"Username":     displayName(user),
		"Reply":        reply.Content,
		"ReplyPreview": models.PreviewFeedback(reply.Content, models.FeedbackPreviewMaxRunes),
	}); err != nil {
		logger.Warn("feedback notify: reply inbox failed",
			zap.Uint("userId", user.ID), zap.Error(err))
	}
}

func firstFeedbackReply(params []any) (*models.FeedbackReply, bool) {
	for _, p := range params {
		if r, ok := p.(*models.FeedbackReply); ok && r != nil {
			return r, true
		}
	}
	return nil, false
}
