package voice

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/ling-base/common"
	"github.com/LingByte/ling-base/logger"
	"github.com/LingByte/lingllm/realtime"
	_ "github.com/LingByte/lingllm/realtime/aliyunomni"
	_ "github.com/LingByte/lingllm/realtime/volcdialogue"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SessionContext holds per-connection scenario dialogue state.
type SessionContext struct {
	SessionID          uint
	UserID             uint
	SystemPrompt       string
	CurrentExpressions string   // 用户当前的微表情数据
	ExpressionHistory  []string // 表情历史记录
	OnTurn             func(role, content string, hasCorrection, hasPronunciation bool)
	mu                 sync.RWMutex // 保护并发访问
}

var pendingDeviceID atomic.Value // string, set per incoming WS before upgrade

// SetPendingDeviceID marks the next WS connection's device-id (xiaozhi calls NewAgent before OnSessionStart).
func SetPendingDeviceID(deviceID string) {
	pendingDeviceID.Store(strings.TrimSpace(deviceID))
}

// RealtimeFactory creates lingllm realtime agents for scenario dialogue.
type RealtimeFactory struct {
	db                *gorm.DB
	sessions          sync.Map // sessionID(uint) -> *SessionContext
	callMap           sync.Map // callID(string) -> sessionID(uint)
	expressionHandler *ExpressionHandler
}

func NewRealtimeFactory(db *gorm.DB) *RealtimeFactory {
	return &RealtimeFactory{
		db:                db,
		expressionHandler: NewExpressionHandler(),
	}
}

// RegisterSession stores session context for WS attach.
func (f *RealtimeFactory) RegisterSession(ctx *SessionContext) {
	f.sessions.Store(ctx.SessionID, ctx)
}

// BindCall associates a xiaozhi callID with a session.
func (f *RealtimeFactory) BindCall(callID string, sessionID uint) {
	f.callMap.Store(callID, sessionID)

	// 注册会话到表情处理器
	if v, ok := f.sessions.Load(sessionID); ok {
		if sessionCtx, ok2 := v.(*SessionContext); ok2 {
			f.expressionHandler.RegisterSession(callID, sessionCtx)
		}
	}
}

// UnregisterSession removes session context after WS teardown.
func (f *RealtimeFactory) UnregisterSession(sessionID uint) {
	f.sessions.Delete(sessionID)
}

// UnregisterCall removes call mapping and session context.
func (f *RealtimeFactory) UnregisterCall(callID string) {
	if v, ok := f.callMap.Load(callID); ok {
		f.sessions.Delete(v.(uint))
		f.callMap.Delete(callID)
	}

	// 从表情处理器中注销会话
	f.expressionHandler.UnregisterSession(callID)
}

// GetSessionByCallID 通过 callID 获取会话
func (f *RealtimeFactory) GetSessionByCallID(callID string) *SessionContext {
	if v, ok := f.callMap.Load(callID); ok {
		if sessionID, ok2 := v.(uint); ok2 {
			if sessionCtx, ok3 := f.sessions.Load(sessionID); ok3 {
				return sessionCtx.(*SessionContext)
			}
		}
	}
	return nil
}

// NewAgent implements xiaozhi.RealtimeAgentFactory.
func (f *RealtimeFactory) NewAgent(ctx context.Context, callID string, onEvent func(realtime.Event)) (realtime.Agent, int, int, error) {
	sessionCtx := f.resolveSession(callID)
	if sessionCtx == nil {
		if v := pendingDeviceID.Load(); v != nil {
			if deviceID, ok := v.(string); ok && deviceID != "" {
				if _, sessionID, ok2 := ParseDeviceSessionID(deviceID); ok2 {
					if ctxVal, ok3 := f.sessions.Load(sessionID); ok3 {
						sessionCtx = ctxVal.(*SessionContext)
						f.BindCall(callID, sessionID)
					}
				}
			}
		}
	}
	systemPrompt := defaultSystemPrompt()
	if sessionCtx != nil && sessionCtx.SystemPrompt != "" {
		systemPrompt = sessionCtx.SystemPrompt
	}

	// 根据用户的微表情调整系统提示
	if sessionCtx != nil {
		expressions := sessionCtx.GetCurrentExpressions()
		if expressions != "" {
			systemPrompt = buildSystemPromptWithExpression(systemPrompt, expressions)
		}
	}

	ready := CheckReady()
	if !ready.Ready {
		setLastInitError(ready.Hint)
		return nil, 0, 0, fmt.Errorf("%s", ready.Hint)
	}

	cfg, err := LoadRealtimeConfig()
	if err != nil {
		return nil, 0, 0, err
	}

	inSR := int(common.GetIntEnvWithDefault("REALTIME_INPUT_SR", 16000))
	outSR := int(common.GetIntEnvWithDefault("REALTIME_OUTPUT_SR", 24000))
	voice := strings.TrimSpace(common.GetEnv("REALTIME_VOICE"))
	if voice == "" {
		voice = "Cherry"
	}

	var turnUser strings.Builder
	var turnAssistant strings.Builder

	agent, err := realtime.NewAgentFromCredential(cfg, realtime.Options{
		SystemPrompt:     systemPrompt,
		Voice:            voice,
		InputSampleRate:  inSR,
		OutputSampleRate: outSR,
		OnEvent: func(ev realtime.Event) {
			if sessionCtx != nil {
				f.handleSessionEvent(sessionCtx, ev, &turnUser, &turnAssistant)
			}
			if onEvent != nil {
				onEvent(ev)
			}
		},
	})
	if err != nil {
		logger.Lg.Error("realtime NewAgentFromCredential failed", zap.Error(err))
		setLastInitError(err.Error())
		return nil, 0, 0, err
	}
	if err := agent.Start(ctx); err != nil {
		logger.Lg.Error("realtime agent Start failed", zap.Error(err))
		setLastInitError(err.Error())
		return nil, 0, 0, err
	}
	setLastInitError("")
	return agent, inSR, outSR, nil
}

var lastInitError atomic.Value

func setLastInitError(msg string) {
	lastInitError.Store(msg)
}

// GetLastInitError returns the latest realtime init failure message.
func GetLastInitError() string {
	if v := lastInitError.Load(); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func (f *RealtimeFactory) resolveSession(callID string) *SessionContext {
	if v, ok := f.callMap.Load(callID); ok {
		if ctx, ok2 := f.sessions.Load(v.(uint)); ok2 {
			return ctx.(*SessionContext)
		}
	}
	return nil
}

func (f *RealtimeFactory) handleSessionEvent(ctx *SessionContext, ev realtime.Event, turnUser, turnAssistant *strings.Builder) {
	switch ev.Type {
	case realtime.EventUserTranscript:
		if !ev.Final {
			return
		}
		text := NormalizeTurnContent(ev.Text)
		if text == "" {
			return
		}
		turnUser.Reset()
		turnUser.WriteString(text)
		if ctx.OnTurn != nil {
			ctx.OnTurn("user", text, false, false)
		}
	case realtime.EventAssistantText:
		// Deltas only accumulate; Final carries the full transcript (do NOT append Final onto deltas).
		if !ev.Final {
			if ev.Text != "" {
				turnAssistant.WriteString(ev.Text)
			}
			return
		}
		text := strings.TrimSpace(ev.Text)
		if text == "" {
			text = strings.TrimSpace(turnAssistant.String())
		}
		turnAssistant.Reset()
		text = NormalizeTurnContent(text)
		if text == "" || ctx.OnTurn == nil {
			return
		}
		ctx.OnTurn("assistant", text, hasExplicitCorrection(text) || hasImplicitCorrection(text), hasPronunciationHint(text))
	case realtime.EventAssistantTurnEnd:
		// Final transcript already persisted in EventAssistantText; only flush leftovers.
		text := NormalizeTurnContent(turnAssistant.String())
		turnAssistant.Reset()
		if text != "" && ctx.OnTurn != nil {
			ctx.OnTurn("assistant", text, hasExplicitCorrection(text) || hasImplicitCorrection(text), hasPronunciationHint(text))
		}
	case realtime.EventSessionOpen:
		if ctx.SessionID > 0 {
			now := time.Now().UTC()
			_ = f.db.Model(&models.ScenarioDialogueSession{}).
				Where("id = ? AND status = ?", ctx.SessionID, models.ScenarioSessionStatusPending).
				Updates(map[string]any{
					"status":     models.ScenarioSessionStatusActive,
					"started_at": now,
				}).Error
			_ = f.db.Model(&models.ScenarioDialogueSession{}).
				Where("id = ? AND status = ? AND started_at IS NULL", ctx.SessionID, models.ScenarioSessionStatusActive).
				Update("started_at", now).Error
		}
	}
}

// UpdateExpressions 更新用户的微表情数据
func (sc *SessionContext) UpdateExpressions(expressions string) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	if expressions != sc.CurrentExpressions {
		sc.CurrentExpressions = expressions
		// 保留最近的 10 条表情记录
		sc.ExpressionHistory = append(sc.ExpressionHistory, expressions)
		if len(sc.ExpressionHistory) > 10 {
			sc.ExpressionHistory = sc.ExpressionHistory[1:]
		}
	}
}

// GetCurrentExpressions 获取当前表情数据
func (sc *SessionContext) GetCurrentExpressions() string {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return sc.CurrentExpressions
}

// buildSystemPromptWithExpression 根据表情数据调整系统提示
func buildSystemPromptWithExpression(basePrompt string, expressions string) string {
	if expressions == "" {
		return basePrompt
	}

	// 解析表情数据
	expList := strings.Split(expressions, ",")
	expMap := make(map[string]bool)
	for _, exp := range expList {
		expMap[strings.TrimSpace(exp)] = true
	}

	// 根据表情调整提示
	var adjustments []string

	// 检测用户情绪和状态
	if expMap["big_smile"] || expMap["smiling"] {
		adjustments = append(adjustments, "用户看起来很开心，保持积极和热情的语气。")
	}

	if expMap["frowning"] || expMap["frowning_deeply"] {
		adjustments = append(adjustments, "用户看起来有些不满或困惑，请更耐心地解释，避免过于复杂的表达。")
	}

	if expMap["eyes_wide_open"] || expMap["surprised"] {
		adjustments = append(adjustments, "用户看起来很惊讶，请确保你的回答清晰易懂，提供更多上下文。")
	}

	if expMap["eyes_looking_away"] {
		adjustments = append(adjustments, "用户看起来可能不太专注，请尝试提出问题来吸引他们的注意力，保持互动性。")
	}

	if expMap["jaw_clenched"] || expMap["face_tensed"] {
		adjustments = append(adjustments, "用户看起来很紧张，请用更温和、放松和鼓励的语气。")
	}

	if expMap["head_looking_down"] {
		adjustments = append(adjustments, "用户看起来在思考或有些害羞，请给他们更多时间和空间，不要催促。")
	}

	if expMap["eyes_squinted"] || expMap["eyes_closed"] {
		adjustments = append(adjustments, "用户看起来可能很疲劳，请简化内容，给予更多休息时间。")
	}

	if expMap["mouth_tightly_closed"] || expMap["mouth_closed"] {
		adjustments = append(adjustments, "用户看起来不太想说话，请给予更多开放式问题来鼓励他们表达。")
	}

	if expMap["head_turned_left"] || expMap["head_turned_right"] {
		adjustments = append(adjustments, "用户看起来有些分心，请尝试重新吸引他们的注意力。")
	}

	if expMap["lips_trembling"] {
		adjustments = append(adjustments, "用户看起来可能很紧张或害怕，请提供更多支持和鼓励。")
	}

	// 组合提示
	fullPrompt := basePrompt
	if len(adjustments) > 0 {
		fullPrompt += "\n\n[用户当前状态提示]\n" + strings.Join(adjustments, "\n")
	}

	return fullPrompt
}

func defaultSystemPrompt() string {
	prompt := strings.TrimSpace(common.GetEnv("REALTIME_SYSTEM_PROMPT"))
	if prompt != "" {
		return prompt
	}
	return "You are a helpful English conversation partner for Chinese learners. " +
		"Correct grammar inline with '✓ Better: ...' and pronunciation with '🔊 Pronunciation: ...'. " +
		"Keep replies short for voice conversation."
}

// ParseDeviceSessionID extracts session ID from device-id query: cs-{userId}-{sessionId}
func ParseDeviceSessionID(deviceID string) (userID, sessionID uint, ok bool) {
	deviceID = strings.TrimSpace(deviceID)
	if !strings.HasPrefix(deviceID, "cs-") {
		return 0, 0, false
	}
	parts := strings.Split(deviceID, "-")
	if len(parts) < 3 {
		return 0, 0, false
	}
	uid, err1 := strconv.ParseUint(parts[1], 10, 64)
	sid, err2 := strconv.ParseUint(parts[len(parts)-1], 10, 64)
	if err1 != nil || err2 != nil {
		return 0, 0, false
	}
	return uint(uid), uint(sid), true
}

// LogRealtimeConfig logs warnings if realtime is not configured.
func LogRealtimeConfig(lg *zap.Logger) {
	ready := CheckReady()
	if !ready.Ready {
		lg.Warn("realtime voice not configured — scenario dialogue will fail",
			zap.String("hint", ready.Hint),
			zap.String("example", `export REALTIME_API_KEY=sk-xxx  # 或 REALTIME_CONFIG_JSON='{"provider":"aliyun_omni","api_key":"sk-..."}'`))
	} else {
		lg.Info("realtime voice ready", zap.String("provider", ready.Provider))
	}
}
