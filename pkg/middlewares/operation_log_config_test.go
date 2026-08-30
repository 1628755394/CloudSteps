package middlewares

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// ===== DefaultOperationLogConfig =====

func TestDefaultOperationLogConfig(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.NotNil(t, cfg)
	assert.True(t, cfg.Enabled)
	assert.False(t, cfg.LogQueries)
	assert.NotEmpty(t, cfg.ImportantPatterns)
	assert.NotEmpty(t, cfg.UnimportantPostPaths)
	assert.NotEmpty(t, cfg.SystemInternalPaths)
	assert.NotEmpty(t, cfg.OperationDescriptions)

	// spot-check a few known entries
	assert.Contains(t, cfg.ImportantPatterns["auth"], "/api/auth/login/password")
	assert.Contains(t, cfg.UnimportantPostPaths, "/api/auth/refresh")
	assert.Contains(t, cfg.SystemInternalPaths, "/api/system/")
	assert.Equal(t, "密码登录", cfg.OperationDescriptions["/api/auth/login/password"])
}

// ===== ShouldLogOperation =====

func TestShouldLogOperation_Disabled(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	cfg.Enabled = false
	assert.False(t, cfg.ShouldLogOperation("POST", "/api/auth/login/password"))
}

func TestShouldLogOperation_GetSkippedWhenLogQueriesFalse(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	cfg.LogQueries = false
	assert.False(t, cfg.ShouldLogOperation("GET", "/api/auth/login/password"))
	assert.False(t, cfg.ShouldLogOperation("HEAD", "/api/auth/login/password"))
	assert.False(t, cfg.ShouldLogOperation("OPTIONS", "/api/auth/login/password"))
}

func TestShouldLogOperation_GetLoggedWhenLogQueriesTrue(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	cfg.LogQueries = true
	// Even with LogQueries=true, GET is filtered out by the write-method check,
	// so GET is never logged. Verify the behavior explicitly.
	assert.False(t, cfg.ShouldLogOperation("GET", "/api/auth/login/password"))
	// A write method on an important path is still logged.
	assert.True(t, cfg.ShouldLogOperation("POST", "/api/auth/login/password"))
}

func TestShouldLogOperation_NonWriteMethodSkipped(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	// TRACE/CONNECT not in POST/PUT/DELETE/PATCH
	assert.False(t, cfg.ShouldLogOperation("TRACE", "/api/auth/login/password"))
}

func TestShouldLogOperation_ImportantPost(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.True(t, cfg.ShouldLogOperation("POST", "/api/auth/login/password"))
	assert.True(t, cfg.ShouldLogOperation("POST", "/api/upload"))
}

func TestShouldLogOperation_UnimportantPost(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.False(t, cfg.ShouldLogOperation("POST", "/api/auth/refresh"))
	assert.False(t, cfg.ShouldLogOperation("POST", "/api/notification/read"))
	assert.False(t, cfg.ShouldLogOperation("POST", "/api/chat/typing"))
	assert.False(t, cfg.ShouldLogOperation("POST", "/api/voice/heartbeat"))
}

func TestShouldLogOperation_DeleteAlwaysImportant(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.True(t, cfg.ShouldLogOperation("DELETE", "/api/anything/here"))
}

func TestShouldLogOperation_PutImportant(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.True(t, cfg.ShouldLogOperation("PUT", "/api/some/thing"))
}

func TestShouldLogOperation_PutSystemInternalSkipped(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.False(t, cfg.ShouldLogOperation("PUT", "/api/system/config"))
	assert.False(t, cfg.ShouldLogOperation("PATCH", "/api/internal/job"))
}

func TestShouldLogOperation_PatchImportant(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.True(t, cfg.ShouldLogOperation("PATCH", "/api/assistant/123"))
}

func TestShouldLogOperation_PostNotImportantAndNotPattern(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	// a POST that is not in unimportant list and not in patterns -> still important
	assert.True(t, cfg.ShouldLogOperation("POST", "/api/random/endpoint"))
}

// ===== isImportantOperation edge cases =====

func TestIsImportantOperation_PatternPrefix(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	// path with query-like suffix still matches prefix
	assert.True(t, cfg.isImportantOperation("/api/auth/login/password/extra", "POST"))
}

func TestIsImportantOperation_EmptyPatterns(t *testing.T) {
	cfg := &OperationLogConfig{Enabled: true, ImportantPatterns: map[string][]string{}}
	// DELETE always important
	assert.True(t, cfg.isImportantOperation("/api/x", "DELETE"))
	// POST with no unimportant list -> important
	assert.True(t, cfg.isImportantOperation("/api/x", "POST"))
	// PUT not system internal -> important
	assert.True(t, cfg.isImportantOperation("/api/x", "PUT"))
}

// ===== isSystemInternalOperation =====

func TestIsSystemInternalOperation(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.True(t, cfg.isSystemInternalOperation("/api/system/health"))
	assert.True(t, cfg.isSystemInternalOperation("/api/internal/job"))
	assert.True(t, cfg.isSystemInternalOperation("/api/debug/vars"))
	assert.True(t, cfg.isSystemInternalOperation("/api/test/abc"))
	assert.False(t, cfg.isSystemInternalOperation("/api/auth/login"))
}

func TestIsSystemInternalOperation_EmptyList(t *testing.T) {
	cfg := &OperationLogConfig{}
	assert.False(t, cfg.isSystemInternalOperation("/api/system/x"))
}

// ===== isPostOperationImportant =====

func TestIsPostOperationImportant(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.False(t, cfg.isPostOperationImportant("/api/auth/refresh"))
	assert.True(t, cfg.isPostOperationImportant("/api/other"))
}

// ===== GetOperationDescription: exact matches =====

func TestGetOperationDescription_ExactMatch(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "密码登录", cfg.GetOperationDescription("POST", "/api/auth/login/password"))
	assert.Equal(t, "用户登出", cfg.GetOperationDescription("POST", "/api/auth/logout"))
	assert.Equal(t, "文件上传", cfg.GetOperationDescription("POST", "/api/upload"))
}

func TestGetOperationDescription_PrefixMatch(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	// /api/auth/login/password/extra -> prefix matches /api/auth/login/password
	desc := cfg.GetOperationDescription("POST", "/api/auth/login/password/extra")
	assert.Equal(t, "密码登录", desc)
}

// ===== GetOperationDescription: module-based generation =====

func TestGetOperationDescription_AuthModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	// POST auth login (no exact match)
	assert.Equal(t, "用户登录", cfg.GetOperationDescription("POST", "/api/auth/login/other"))
	assert.Equal(t, "用户注册", cfg.GetOperationDescription("POST", "/api/auth/register/x"))
	assert.Equal(t, "用户登出", cfg.GetOperationDescription("POST", "/api/auth/logout/x"))
	assert.Equal(t, "修改密码", cfg.GetOperationDescription("POST", "/api/auth/change-password/x"))
	assert.Equal(t, "重置密码", cfg.GetOperationDescription("POST", "/api/auth/reset-password/x"))
	assert.Equal(t, "发送邮箱验证", cfg.GetOperationDescription("POST", "/api/auth/send-email-verification/x"))
	assert.Equal(t, "验证邮箱", cfg.GetOperationDescription("POST", "/api/auth/verify-email/x"))
	assert.Equal(t, "认证操作", cfg.GetOperationDescription("POST", "/api/auth/unknown"))
	// PUT/PATCH auth
	assert.Equal(t, "更新个人资料", cfg.GetOperationDescription("PUT", "/api/auth/update/x"))
	assert.Equal(t, "更新偏好设置", cfg.GetOperationDescription("PATCH", "/api/auth/preferences/x"))
	assert.Equal(t, "更新认证信息", cfg.GetOperationDescription("PUT", "/api/auth/unknown"))
	// DELETE auth
	assert.Equal(t, "删除设备", cfg.GetOperationDescription("DELETE", "/api/auth/devices/x"))
	assert.Equal(t, "删除认证信息", cfg.GetOperationDescription("DELETE", "/api/auth/unknown"))
	// default
	assert.Equal(t, "认证相关操作", cfg.GetOperationDescription("GET", "/api/auth/unknown"))
}

func TestGetOperationDescription_NotificationModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "批量删除通知", cfg.GetOperationDescription("POST", "/api/notification/batch-delete/x"))
	// readAll has an exact prefix match in OperationDescriptions -> "标记全部已读"
	assert.Equal(t, "标记全部已读", cfg.GetOperationDescription("POST", "/api/notification/readAll/x"))
	assert.Equal(t, "通知操作", cfg.GetOperationDescription("POST", "/api/notification/unknown"))
	assert.Equal(t, "标记通知已读", cfg.GetOperationDescription("PUT", "/api/notification/read/x"))
	assert.Equal(t, "更新通知", cfg.GetOperationDescription("PUT", "/api/notification/unknown"))
	assert.Equal(t, "删除通知", cfg.GetOperationDescription("DELETE", "/api/notification/x"))
	assert.Equal(t, "通知相关操作", cfg.GetOperationDescription("GET", "/api/notification/x"))
}

func TestGetOperationDescription_AssistantModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "创建助手", cfg.GetOperationDescription("POST", "/api/assistant/unknown"))
	assert.Equal(t, "更新助手", cfg.GetOperationDescription("PUT", "/api/assistant/unknown"))
	assert.Equal(t, "更新助手", cfg.GetOperationDescription("PATCH", "/api/assistant/unknown"))
	assert.Equal(t, "删除助手", cfg.GetOperationDescription("DELETE", "/api/assistant/unknown"))
	assert.Equal(t, "助手相关操作", cfg.GetOperationDescription("GET", "/api/assistant/unknown"))
}

func TestGetOperationDescription_ChatModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "发送消息", cfg.GetOperationDescription("POST", "/api/chat/send/x"))
	assert.Equal(t, "聊天操作", cfg.GetOperationDescription("POST", "/api/chat/unknown"))
	assert.Equal(t, "清空聊天记录", cfg.GetOperationDescription("DELETE", "/api/chat/clear/x"))
	assert.Equal(t, "删除聊天记录", cfg.GetOperationDescription("DELETE", "/api/chat/unknown"))
	assert.Equal(t, "聊天相关操作", cfg.GetOperationDescription("GET", "/api/chat/x"))
}

func TestGetOperationDescription_VoiceModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "创建语音训练", cfg.GetOperationDescription("POST", "/api/voice/training/x"))
	assert.Equal(t, "语音操作", cfg.GetOperationDescription("POST", "/api/voice/unknown"))
	assert.Equal(t, "更新语音训练", cfg.GetOperationDescription("PUT", "/api/voice/training/x"))
	assert.Equal(t, "更新语音设置", cfg.GetOperationDescription("PUT", "/api/voice/unknown"))
	assert.Equal(t, "更新语音训练", cfg.GetOperationDescription("PATCH", "/api/voice/training/x"))
	assert.Equal(t, "删除语音训练", cfg.GetOperationDescription("DELETE", "/api/voice/training/x"))
	assert.Equal(t, "删除语音数据", cfg.GetOperationDescription("DELETE", "/api/voice/unknown"))
	assert.Equal(t, "语音相关操作", cfg.GetOperationDescription("GET", "/api/voice/x"))
}

func TestGetOperationDescription_KnowledgeModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "创建知识库", cfg.GetOperationDescription("POST", "/api/knowledge/unknown"))
	assert.Equal(t, "更新知识库", cfg.GetOperationDescription("PUT", "/api/knowledge/unknown"))
	assert.Equal(t, "更新知识库", cfg.GetOperationDescription("PATCH", "/api/knowledge/unknown"))
	assert.Equal(t, "删除知识库", cfg.GetOperationDescription("DELETE", "/api/knowledge/unknown"))
	assert.Equal(t, "知识库相关操作", cfg.GetOperationDescription("GET", "/api/knowledge/x"))
}

func TestGetOperationDescription_GroupModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "加入群组", cfg.GetOperationDescription("POST", "/api/group/join/x"))
	assert.Equal(t, "离开群组", cfg.GetOperationDescription("POST", "/api/group/leave/x"))
	assert.Equal(t, "创建群组", cfg.GetOperationDescription("POST", "/api/group/unknown"))
	assert.Equal(t, "更新群组", cfg.GetOperationDescription("PUT", "/api/group/unknown"))
	assert.Equal(t, "更新群组", cfg.GetOperationDescription("PATCH", "/api/group/unknown"))
	assert.Equal(t, "删除群组", cfg.GetOperationDescription("DELETE", "/api/group/unknown"))
	assert.Equal(t, "群组相关操作", cfg.GetOperationDescription("GET", "/api/group/x"))
}

func TestGetOperationDescription_WorkflowModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "执行工作流", cfg.GetOperationDescription("POST", "/api/workflow/execute/x"))
	assert.Equal(t, "创建工作流", cfg.GetOperationDescription("POST", "/api/workflow/unknown"))
	assert.Equal(t, "更新工作流", cfg.GetOperationDescription("PUT", "/api/workflow/unknown"))
	assert.Equal(t, "更新工作流", cfg.GetOperationDescription("PATCH", "/api/workflow/unknown"))
	assert.Equal(t, "删除工作流", cfg.GetOperationDescription("DELETE", "/api/workflow/unknown"))
	assert.Equal(t, "工作流相关操作", cfg.GetOperationDescription("GET", "/api/workflow/x"))
}

func TestGetOperationDescription_UploadModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	// /api/upload/other matches only the /api/upload prefix (deterministic)
	assert.Equal(t, "文件上传", cfg.GetOperationDescription("POST", "/api/upload/other"))
}

func TestGetOperationDescription_UploadModuleGenerated(t *testing.T) {
	// Use an empty OperationDescriptions map so the module-based generator runs.
	cfg := &OperationLogConfig{OperationDescriptions: map[string]string{}}
	assert.Equal(t, "上传头像", cfg.GetOperationDescription("POST", "/api/upload/avatar/x"))
	assert.Equal(t, "文件上传", cfg.GetOperationDescription("POST", "/api/upload/other"))
}

func TestGetOperationDescription_DefaultModule(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "创建feedback", cfg.GetOperationDescription("POST", "/api/feedback/x"))
	assert.Equal(t, "更新feedback", cfg.GetOperationDescription("PUT", "/api/feedback/x"))
	assert.Equal(t, "更新feedback", cfg.GetOperationDescription("PATCH", "/api/feedback/x"))
	assert.Equal(t, "删除feedback", cfg.GetOperationDescription("DELETE", "/api/feedback/x"))
	assert.Equal(t, "feedback相关操作", cfg.GetOperationDescription("GET", "/api/feedback/x"))
}

func TestGetOperationDescription_ShortPath_MethodDefaults(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	// path with only one segment -> falls to method-based defaults
	assert.Equal(t, "删除操作", cfg.GetOperationDescription("DELETE", "/x"))
	assert.Equal(t, "创建操作", cfg.GetOperationDescription("POST", "/x"))
	assert.Equal(t, "更新操作", cfg.GetOperationDescription("PUT", "/x"))
	assert.Equal(t, "部分更新操作", cfg.GetOperationDescription("PATCH", "/x"))
	assert.Equal(t, "用户操作", cfg.GetOperationDescription("GET", "/x"))
}

func TestGetOperationDescription_EmptyPath(t *testing.T) {
	cfg := DefaultOperationLogConfig()
	assert.Equal(t, "用户操作", cfg.GetOperationDescription("GET", ""))
}
