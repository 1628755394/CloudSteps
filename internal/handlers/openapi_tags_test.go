package handlers

import "testing"

func TestModuleTagForPath(t *testing.T) {
	cases := map[string]string{
		"/health":                            "系统",
		"/api/version":                       "系统",
		"/api/auth/login/password":           "认证",
		"/api/users":                         "用户",
		"/api/wordbooks/custom":              "词库",
		"/api/words/{id}":                    "词库",
		"/api/learning/learned":              "学习",
		"/api/study/sessions":                "学习",
		"/api/review/queue":                  "学习",
		"/api/vocab/tests":                   "词汇测试",
		"/api/reading/passages":              "阅读",
		"/api/cloze/questions":               "完形填空",
		"/api/grammar/lessons":               "语法",
		"/api/notification/list":             "通知",
		"/api/admin/mail-logs":               "通知",
		"/api/announcements":                 "公告",
		"/api/admin/announcements":           "公告",
		"/api/teacher/checkin":               "签到",
		"/api/teacher/coaching/appointments": "陪练",
		"/api/student/coaching/sessions":     "陪练",
		"/api/coaching/admin":                "陪练",
		"/api/scenario-dialogue/start":       "情景对话",
		"/api/feedback":                      "反馈",
		"/api/admin/feedbacks":               "反馈",
		"/api/admin/tts/voices":              "语音",
		"/api/metrics/overview":              "指标",
		"/api/security/events":               "安全",
		"/api/admin/storage/files":           "管理后台",
		"/api/admin/user-words":              "管理后台",
	}
	for path, want := range cases {
		if got := moduleTagForPath(path); got != want {
			t.Errorf("moduleTagForPath(%q)=%q, want %q", path, got, want)
		}
	}
}
