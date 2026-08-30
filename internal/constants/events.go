package constants

// ──────────────────────────────────────────────────────────────────────
// 事件信号常量集中定义
//
// 所有模块的业务事件统一在此声明，使用 common.Sig().Emit / Connect 收发。
// 命名规则： Sig<模块><动作> = "<模块>.<动作>"
// 注释格式： SigXxx: <参数类型列表>
// ──────────────────────────────────────────────────────────────────────

const (
	// ── 系统级 ──
	// SigInitSystemConfig: nil
	SigInitSystemConfig = "system.init"

	// ── 用户 / 认证 ──
	// SigUserLogin: user *User, c *gin.Context, db *gorm.DB, firstLoginToday bool
	SigUserLogin = "user.login"
	// SigUserLogout: user *User, c *gin.Context
	SigUserLogout = "user.logout"
	// SigUserCreate: user *User, c *gin.Context, db *gorm.DB
	SigUserCreate = "user.create"
	// SigUserVerifyEmail: user *User, hash, clientIp, userAgent string, db *gorm.DB
	SigUserVerifyEmail = "user.verifyemail"
	// SigUserResetPassword: user *User, hash, clientIp, userAgent string, db *gorm.DB
	SigUserResetPassword = "user.resetpassword"
	// SigUserChangeEmail: user *User, hash, clientIp, userAgent, newEmail string
	SigUserChangeEmail = "user.changeemail"
	// SigUserChangeEmailDone: user *User, oldEmail, newEmail string
	SigUserChangeEmailDone = "user.changeemaildone"
	// SigUserNewDeviceLogin: user *User, deviceInfo map[string]interface{}, db *gorm.DB
	SigUserNewDeviceLogin = "user.newdevicelogin"
	// SigUserDeactivate: user *User, c *gin.Context, db *gorm.DB
	SigUserDeactivate = "user.deactivate"
	// SigUserUpdate: user *User, c *gin.Context, db *gorm.DB
	SigUserUpdate = "user.update"
	// SigUserPasswordChange: user *User, c *gin.Context
	SigUserPasswordChange = "user.password_change"
	// SigUserAvatarUpdate: user *User, c *gin.Context
	SigUserAvatarUpdate = "user.avatar_update"

	// ── 反馈 / 工单 ──
	// SigFeedbackAdminReplied: user *User, ticket *FeedbackTicket, reply *FeedbackReply, c *gin.Context, db *gorm.DB
	SigFeedbackAdminReplied = "feedback.admin_replied"
	// SigFeedbackCreated: user *User, ticket *FeedbackTicket, c *gin.Context, db *gorm.DB
	SigFeedbackCreated = "feedback.created"
	// SigFeedbackClosed: user *User, ticket *FeedbackTicket, c *gin.Context, db *gorm.DB
	SigFeedbackClosed = "feedback.closed"
	// SigFeedbackReopened: user *User, ticket *FeedbackTicket, c *gin.Context, db *gorm.DB
	SigFeedbackReopened = "feedback.reopened"

	// ── 陪练 / 排课 ──
	// SigCoachingAppointmentCreated: teacher *User, student *User, appointment *CoachingAppointment, c *gin.Context
	SigCoachingAppointmentCreated = "coaching.appointment_created"
	// SigCoachingAppointmentUpdated: teacher *User, student *User, appointment *CoachingAppointment, c *gin.Context
	SigCoachingAppointmentUpdated = "coaching.appointment_updated"
	// SigCoachingAppointmentCancelled: teacher *User, student *User, appointment *CoachingAppointment, c *gin.Context
	SigCoachingAppointmentCancelled = "coaching.appointment_cancelled"
	// SigCoachingSessionStarted: teacher *User, student *User, appointment *CoachingAppointment, c *gin.Context
	SigCoachingSessionStarted = "coaching.session_started"
	// SigCoachingSessionEnded: teacher *User, student *User, appointment *CoachingAppointment, record *CoachingSessionRecord, c *gin.Context
	SigCoachingSessionEnded = "coaching.session_ended"
	// SigCoachingQuotaUpdated: teacher *User, student *User, quota *StudentTeacherCoachingQuota, c *gin.Context
	SigCoachingQuotaUpdated = "coaching.quota_updated"
	// SigCoachingStudentAdded: teacher *User, student *User, c *gin.Context
	SigCoachingStudentAdded = "coaching.student_added"
	// SigCoachingStudentRemoved: teacher *User, student *User, c *gin.Context
	SigCoachingStudentRemoved = "coaching.student_removed"

	// ── 词库 / 单词 ──
	// SigWordBookCreated: user *User, book *WordBook, c *gin.Context
	SigWordBookCreated = "wordbook.created"
	// SigWordBookUpdated: user *User, book *WordBook, c *gin.Context
	SigWordBookUpdated = "wordbook.updated"
	// SigWordBookDeleted: user *User, book *WordBook, c *gin.Context
	SigWordBookDeleted = "wordbook.deleted"
	// SigWordBookPublished: user *User, book *WordBook, c *gin.Context
	SigWordBookPublished = "wordbook.published"
	// SigWordBookUnpublished: user *User, book *WordBook, c *gin.Context
	SigWordBookUnpublished = "wordbook.unpublished"
	// SigWordBookCoverGenerated: user *User, book *WordBook, coverUrl string, c *gin.Context
	SigWordBookCoverGenerated = "wordbook.cover_generated"
	// SigWordBookAudioGenerated: user *User, book *WordBook, wordId uint, c *gin.Context
	SigWordBookAudioGenerated = "wordbook.audio_generated"
	// SigWordBookImported: user *User, book *WordBook, wordCount int, c *gin.Context
	SigWordBookImported = "wordbook.imported"

	// ── 学习 / 复习 ──
	// SigStudySessionStarted: user *User, session *StudySession, c *gin.Context
	SigStudySessionStarted = "study.session_started"
	// SigStudySessionEnded: user *User, session *StudySession, c *gin.Context
	SigStudySessionEnded = "study.session_ended"
	// SigWordLearned: user *User, word *Word, book *WordBook, c *gin.Context
	SigWordLearned = "study.word_learned"
	// SigWordReviewed: user *User, word *Word, correct bool, c *gin.Context
	SigWordReviewed = "study.word_reviewed"
	// SigReviewQueueUpdated: user *User, queueItems []ReviewQueue, c *gin.Context
	SigReviewQueueUpdated = "study.review_queue_updated"
	// SigScreeningCompleted: user *User, book *WordBook, result []UserWordState, c *gin.Context
	SigScreeningCompleted = "study.screening_completed"

	// ── 阅读 ──
	// SigReadingPassageCreated: user *User, passage *ReadingPassage, c *gin.Context
	SigReadingPassageCreated = "reading.passage_created"
	// SigReadingPassageUpdated: user *User, passage *ReadingPassage, c *gin.Context
	SigReadingPassageUpdated = "reading.passage_updated"
	// SigReadingRecordSubmitted: user *User, passage *ReadingPassage, record *ReadingRecord, c *gin.Context
	SigReadingRecordSubmitted = "reading.record_submitted"

	// ── 完形填空 ──
	// SigClozePassageCreated: user *User, passage *ClozePassage, c *gin.Context
	SigClozePassageCreated = "cloze.passage_created"
	// SigClozeRecordSubmitted: user *User, passage *ClozePassage, record *ClozeRecord, c *gin.Context
	SigClozeRecordSubmitted = "cloze.record_submitted"

	// ── 语法 ──
	// SigGrammarLessonCreated: user *User, lesson *GrammarLesson, c *gin.Context
	SigGrammarLessonCreated = "grammar.lesson_created"
	// SigGrammarRecordSubmitted: user *User, lesson *GrammarLesson, record *GrammarRecord, c *gin.Context
	SigGrammarRecordSubmitted = "grammar.record_submitted"

	// ── 情景对话 ──
	// SigScenarioSessionCreated: user *User, scenario *ScenarioDialogueScenario, session *ScenarioDialogueSession, c *gin.Context
	SigScenarioSessionCreated = "scenario.session_created"
	// SigScenarioSessionEnded: user *User, session *ScenarioDialogueSession, c *gin.Context
	SigScenarioSessionEnded = "scenario.session_ended"
	// SigScenarioTurnRecorded: user *User, session *ScenarioDialogueSession, turn *ScenarioDialogueTurn, c *gin.Context
	SigScenarioTurnRecorded = "scenario.turn_recorded"

	// ── 词汇量测试 ──
	// SigVocabTestStarted: user *User, c *gin.Context
	SigVocabTestStarted = "vocab_test.started"
	// SigVocabTestCompleted: user *User, record *VocabTestRecord, c *gin.Context
	SigVocabTestCompleted = "vocab_test.completed"

	// ── 公告 ──
	// SigAnnouncementPublished: announcement *Announcement, c *gin.Context
	SigAnnouncementPublished = "announcement.published"
	// SigAnnouncementUnpublished: announcement *Announcement, c *gin.Context
	SigAnnouncementUnpublished = "announcement.unpublished"
	// SigAnnouncementRead: user *User, announcement *Announcement, c *gin.Context
	SigAnnouncementRead = "announcement.read"

	// ── 教师签到 ──
	// SigTeacherCheckIn: teacher *User, checkIn *TeacherCheckIn, c *gin.Context
	SigTeacherCheckIn = "teacher.checkin"
	// SigTeacherCheckInReminder: teacher *User, c *gin.Context
	SigTeacherCheckInReminder = "teacher.checkin_reminder"

	// ── 通知 / 站内信 ──
	// SigNotificationSent: user *User, notification *notify.InternalNotification, c *gin.Context
	SigNotificationSent = "notification.sent"
	// SigNotificationRead: user *User, notificationId uint, c *gin.Context
	SigNotificationRead = "notification.read"
	// SigNotificationDeleted: user *User, notificationIds []uint, c *gin.Context
	SigNotificationDeleted = "notification.deleted"
	// SigNotificationChannelUpdated: channel *notify.NotificationChannel, c *gin.Context
	SigNotificationChannelUpdated = "notification.channel_updated"
	// SigMailTemplateUpdated: template *notify.MailTemplate, c *gin.Context
	SigMailTemplateUpdated = "notification.mail_template_updated"

	// ── 存储 ──
	// SigStorageUploadCompleted: user *User, key string, size int64, c *gin.Context
	SigStorageUploadCompleted = "storage.upload_completed"
	// SigStorageDeleted: user *User, keys []string, c *gin.Context
	SigStorageDeleted = "storage.deleted"

	// ── 系统指标 ──
	// SigSysMetricFlush: metrics []SysMetric
	SigSysMetricFlush = "sys_metric.flush"
	// SigSysMetricAlert: metric *SysMetric, threshold float64
	SigSysMetricAlert = "sys_metric.alert"
)
