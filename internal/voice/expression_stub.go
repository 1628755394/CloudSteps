package voice

// ExpressionHandler is a no-op stub (micro-expression feature intentionally disabled).
type ExpressionHandler struct{}

func NewExpressionHandler() *ExpressionHandler { return &ExpressionHandler{} }

func (h *ExpressionHandler) RegisterSession(callID string, sessionCtx *SessionContext) {}

func (h *ExpressionHandler) UnregisterSession(callID string) {}
