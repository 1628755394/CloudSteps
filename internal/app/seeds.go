package app

import (
	"encoding/json"
	"errors"
	"strings"

	emailtemplates "github.com/LingByte/CloudStepsGo"
	"github.com/LingByte/CloudStepsGo/internal/configs"
	"github.com/LingByte/CloudStepsGo/internal/constants"
	"github.com/LingByte/CloudStepsGo/internal/models"
	notify2 "github.com/LingByte/CloudStepsGo/pkg/notify"
	lbconfig "github.com/LingByte/ling-base/common/config"
	"gorm.io/gorm"
)

type SeedService struct {
	DB *gorm.DB
}

func (s *SeedService) SeedAll() error {
	if err := s.seedConfigs(); err != nil {
		return err
	}
	if err := s.seedUsers(); err != nil {
		return err
	}
	if err := s.seedReadingPassages(); err != nil {
		return err
	}
	if err := s.seedClozePassages(); err != nil {
		return err
	}
	if err := s.seedClozePassagesExtra(); err != nil {
		return err
	}
	if err := s.seedGrammarLessons(); err != nil {
		return err
	}
	if err := s.seedScenarios(); err != nil {
		return err
	}
	return nil
}

func (s *SeedService) SeedNotificationDefaults() error {
	if err := s.seedNotificationTemplates(); err != nil {
		return err
	}
	return s.seedDefaultEmailChannel()
}

func (s *SeedService) seedNotificationTemplates() error {
	if s == nil || s.DB == nil {
		return nil
	}
	if s.DB.Dialector.Name() == "mysql" {
		for _, tbl := range []string{"mail_templates", "mail_logs", "notification_channels"} {
			_ = s.DB.Exec("ALTER TABLE " + tbl + " CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci").Error
		}
	}
	if err := notify2.SplitLegacyMailTemplates(s.DB); err != nil {
		return err
	}
	type tplDef struct {
		code, emailName, inboxName, subject, html, desc, inboxTitle, inboxBody string
	}
	siteName := "CloudSteps"
	if configs.Global != nil && configs.Global.Server.Name != "" {
		siteName = configs.Global.Server.Name
	}
	defs := []tplDef{
		{notify2.TmplWelcome, "欢迎邮件", "欢迎通知", "欢迎加入 " + siteName, emailtemplates.WelcomeHTML, "用户注册成功通知",
			"欢迎注册",
			"欢迎加入 " + siteName + "，{{.Username}}！请查收邮件完成邮箱验证，或前往登录页开始使用。"},
		{notify2.TmplVerification, "通用验证码", "验证码通知", "您的 " + siteName + " 验证码", emailtemplates.VerificationHTML, "通用 6 位验证码通知",
			"验证码",
			"您的验证码是 {{.Code}}，请在 10 分钟内完成验证。"},
		{notify2.TmplEmailVerification, "邮箱验证", "邮箱验证通知", "请验证您的邮箱地址", emailtemplates.EmailVerificationHTML, "注册后邮箱地址验证通知",
			"邮箱验证",
			"{{.Username}}，请查收邮件完成邮箱验证。如未收到邮件，可在登录页重新发送。"},
		{notify2.TmplPasswordReset, "密码重置", "密码重置通知", "密码重置请求", emailtemplates.PasswordResetHTML, "密码重置通知",
			"密码重置",
			"{{.Username}}，您已申请重置密码，请查收邮件完成操作。如非本人操作请忽略本消息。"},
		{notify2.TmplDeviceVerification, "设备验证码", "设备验证通知", "设备验证码", emailtemplates.DeviceVerificationHTML, "设备验证码通知",
			"设备验证",
			"{{.Username}}，您正在新设备上登录，验证码为 {{.Code}}（设备 ID：{{.DeviceID}}）。"},
		{notify2.TmplGroupInvitation, "组织邀请", "团队邀请通知", "您收到了来自 {{.InviterName}} 的组织邀请", emailtemplates.GroupInvitationHTML, "组织 / 团队邀请通知",
			"团队邀请",
			"{{.InviterName}} 邀请您加入「{{.GroupName}}」（{{.GroupType}}）。请查收邮件接受邀请。"},
		{notify2.TmplNewDeviceLogin, "新设备登录提醒", "登录安全通知", "{{if .IsSuspicious}}可疑登录警告{{else}}新设备登录提醒{{end}}", emailtemplates.NewDeviceLoginHTML, "新设备 / 异地登录提醒",
			"{{if .IsSuspicious}}可疑登录提醒{{else}}新设备登录提醒{{end}}",
			"{{if .IsSuspicious}}检测到可疑登录：{{else}}您的账号在新设备登录：{{end}}{{.LoginTime}}，设备 {{.DeviceLabel}}，IP {{.IPAddress}}{{if .Location}}（{{.Location}}）{{end}}。如非本人操作，请立即修改密码。"},
		{notify2.TmplLogin, "登录提醒", "登录通知", "账号登录提醒", emailtemplates.LoginHTML, "用户登录成功通知",
			"登录成功",
			"{{.Username}}，您的账号于 {{.LoginTime}} 登录（IP：{{.IPAddress}}）。如非本人操作请立即修改密码。"},
		{notify2.TmplLogout, "登出提醒", "登出通知", "账号登出提醒", emailtemplates.LogoutHTML, "用户登出通知",
			"已安全登出",
			"{{.Username}}，您的账号于 {{.LogoutTime}} 已登出（IP：{{.IPAddress}}）。"},
		{notify2.TmplChangeEmail, "更换邮箱验证", "更换邮箱通知", "请确认更换邮箱", emailtemplates.ChangeEmailHTML, "更换邮箱验证通知",
			"更换邮箱验证",
			"{{.Username}}，您正在将邮箱更换为 {{.NewEmail}}，请查收邮件完成确认。"},
		{notify2.TmplChangeEmailDone, "邮箱更换成功", "邮箱更换完成", "您的邮箱已更换", emailtemplates.ChangeEmailDoneHTML, "邮箱更换完成通知",
			"邮箱已更换",
			"{{.Username}}，您的账号邮箱已由 {{.OldEmail}} 更换为 {{.NewEmail}}。如非本人操作请立即联系管理员。"},
	}
	if err := upsertNotificationTemplate(s.DB, notify2.TmplFeedbackReply, "反馈回复通知", notify2.NotificationTemplateTypeInbox, "", "", "管理员在工单中回复后提醒用户去看完整对话",
		"您的反馈有了新回复",
		"{{.Username}}，管理员回复了你的反馈：{{.ReplyPreview}}。请前往「反馈给我们」查看完整对话。"); err != nil {
		return err
	}
	for _, d := range defs {
		if err := upsertNotificationTemplate(s.DB, d.code, d.emailName, notify2.NotificationTemplateTypeEmail, d.subject, d.html, d.desc, "", ""); err != nil {
			return err
		}
		if err := upsertNotificationTemplate(s.DB, d.code, d.inboxName, notify2.NotificationTemplateTypeInbox, "", "", d.desc, d.inboxTitle, d.inboxBody); err != nil {
			return err
		}
	}
	return nil
}

func upsertNotificationTemplate(db *gorm.DB, code, name, channelType, subject, html, desc, inboxTitle, inboxBody string) error {
	var existing notify2.MailTemplate
	err := db.Where("code = ? AND locale = ? AND channel_type = ?", code, "", channelType).First(&existing).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		tpl := &notify2.MailTemplate{
			Code:        code,
			Name:        name,
			ChannelType: channelType,
			Subject:     subject,
			Description: desc,
			InboxTitle:  inboxTitle,
			InboxBody:   inboxBody,
			Locale:      "",
			Enabled:     true,
		}
		if channelType == notify2.NotificationTemplateTypeEmail {
			notify2.ApplyMailTemplateHTMLDerivedFields(tpl, html, "")
		} else {
			notify2.ApplyInboxTemplateDerivedFields(tpl, "")
		}
		return db.Create(tpl).Error
	}
	existing.Name = name
	existing.ChannelType = channelType
	existing.Subject = subject
	existing.Description = desc
	existing.InboxTitle = inboxTitle
	existing.InboxBody = inboxBody
	existing.Locale = ""
	existing.Enabled = true
	existing.Restore("")
	if channelType == notify2.NotificationTemplateTypeEmail {
		notify2.ApplyMailTemplateHTMLDerivedFields(&existing, html, existing.Variables)
	} else {
		notify2.ApplyInboxTemplateDerivedFields(&existing, existing.Variables)
	}
	return db.Save(&existing).Error
}

func (s *SeedService) seedDefaultEmailChannel() error {
	if s == nil || s.DB == nil || configs.Global == nil {
		return nil
	}
	var n int64
	if err := s.DB.Model(&notify2.NotificationChannel{}).
		Where("type = ?", notify2.NotificationChannelTypeEmail).
		Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	mail := configs.Global.Services.Mail
	driver := strings.ToLower(strings.TrimSpace(mail.Provider))
	if driver == "" {
		return nil
	}
	cfgJSON, err := notify2.BuildEmailChannelConfigJSON(
		driver, "default",
		mail.Host, mail.Port, mail.Username, mail.Password, mail.From, "",
		mail.APIUser, mail.APIKey, mail.From,
	)
	if err != nil {
		return nil
	}
	row := notify2.NotificationChannel{
		Type:       notify2.NotificationChannelTypeEmail,
		Code:       "E-default",
		Name:       "默认邮件渠道",
		SortOrder:  0,
		Enabled:    true,
		Remark:     "从环境配置导入",
		ConfigJSON: cfgJSON,
	}
	return s.DB.Create(&row).Error
}

func (s *SeedService) seedScenarios() error {
	for _, sc := range models.DefaultScenarios {
		sc.Enabled = true
		var existing models.ScenarioDialogueScenario
		err := s.DB.Where("slug = ?", sc.Slug).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := s.DB.Create(&sc).Error; err != nil {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}
		_ = s.DB.Model(&existing).Updates(map[string]any{
			"icon":        sc.Icon,
			"prompt":      sc.Prompt,
			"ai_role":     sc.AIRole,
			"description": sc.Description,
			"name":        sc.Name,
		}).Error
	}
	return nil
}

func (s *SeedService) seedUsers() error {
	defaultAdminUsername := "admin"
	defaultPassword := "demo123"

	return s.DB.Transaction(func(tx *gorm.DB) error {
		// 1) admin
		var count int64
		tx.Model(&models.User{}).Where("username = ?", defaultAdminUsername).Count(&count)
		if count == 0 {
			admin := models.User{
				Username:    "admin",
				Password:    models.HashPassword("admin123"),
				DisplayName: "Admin",
				Role:        models.RoleAdmin,
				Source:      "seed",
			}
			if err := tx.Create(&admin).Error; err != nil {
				return err
			}
		}

		// 2) teachers (role=teacher)
		teachers := []models.User{
			{Username: "teacher1", Password: models.HashPassword(defaultPassword), DisplayName: "Teacher 1", Role: models.RoleTeacher, Source: "seed"},
			{Username: "teacher2", Password: models.HashPassword(defaultPassword), DisplayName: "Teacher 2", Role: models.RoleTeacher, Source: "seed"},
			{Username: "teacher3", Password: models.HashPassword(defaultPassword), DisplayName: "Teacher 3", Role: models.RoleTeacher, Source: "seed"},
		}
		for _, u := range teachers {
			tx.Model(&models.User{}).Where("username = ?", u.Username).Count(&count)
			if count > 0 {
				continue
			}
			if err := tx.Create(&u).Error; err != nil {
				return err
			}
		}

		// 3) demo students (role=student)
		students := []models.User{
			{Username: "student1", Password: models.HashPassword(defaultPassword), DisplayName: "Student 1", Role: models.RoleStudent, Source: "seed"},
			{Username: "student2", Password: models.HashPassword(defaultPassword), DisplayName: "Student 2", Role: models.RoleStudent, Source: "seed"},
			{Username: "student3", Password: models.HashPassword(defaultPassword), DisplayName: "Student 3", Role: models.RoleStudent, Source: "seed"},
			{Username: "student4", Password: models.HashPassword(defaultPassword), DisplayName: "Student 4", Role: models.RoleStudent, Source: "seed"},
			{Username: "student5", Password: models.HashPassword(defaultPassword), DisplayName: "Student 5", Role: models.RoleStudent, Source: "seed"},
			{Username: "student6", Password: models.HashPassword(defaultPassword), DisplayName: "Student 6", Role: models.RoleStudent, Source: "seed"},
		}
		for _, u := range students {
			tx.Model(&models.User{}).Where("username = ?", u.Username).Count(&count)
			if count > 0 {
				continue
			}
			if err := tx.Create(&u).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *SeedService) seedConfigs() error {
	defaults := []lbconfig.ConfigItem{
		{Key: constants.KEY_SITE_NAME, Desc: "Site Name", Autoload: true, Public: true, Format: "text", Value: func() string {
			if configs.Global.Server.Name != "" {
				return configs.Global.Server.Name
			}
			return "QINIU SIP"
		}()},
		{Key: constants.KEY_SITE_DESCRIPTION, Desc: "Site Description", Autoload: true, Public: true, Format: "text", Value: func() string {
			if configs.Global.Server.Desc != "" {
				return configs.Global.Server.Desc
			}
			return "QINIU SIP"
		}()},
	}
	for _, cfg := range defaults {
		var existingConfig lbconfig.ConfigItem
		result := s.DB.Where("`key` = ?", cfg.Key).First(&existingConfig)

		if result.Error != nil {
			if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
				return result.Error
			}
			if err := s.DB.Create(&cfg).Error; err != nil {
				return err
			}
		} else {
			existingConfig.Value = cfg.Value
			existingConfig.Desc = cfg.Desc
			existingConfig.Autoload = cfg.Autoload
			existingConfig.Public = cfg.Public
			existingConfig.Format = cfg.Format
			if err := s.DB.Save(&existingConfig).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

type seedClozeBlank struct {
	BlankNo     int
	Options     []map[string]string
	Answer      string
	Explanation string
}

type seedClozePassage struct {
	Title            string
	Level            string
	Summary          string
	Content          string
	EstimatedMinutes int
	SortOrder        int
	Blanks           []seedClozeBlank
}

func (s *SeedService) seedClozePassages() error {
	passages := []seedClozePassage{
		{
			Title:            "A Day at School",
			Level:            "初阶",
			Summary:          "描述小明的一天校园生活。",
			EstimatedMinutes: 5,
			SortOrder:        1,
			Content: `Xiaoming gets up early every morning. He {{1}} breakfast at home and then goes to school by bus. In class, he listens to the teacher carefully and {{2}} notes.

At noon, he eats lunch with his friends in the dining hall. After school, he often {{3}} basketball on the playground. In the evening, he does his homework and {{4}} a short story before going to bed.`,
			Blanks: []seedClozeBlank{
				{
					BlankNo: 1,
					Options: []map[string]string{
						{"key": "A", "text": "has"},
						{"key": "B", "text": "have"},
						{"key": "C", "text": "having"},
						{"key": "D", "text": "had"},
					},
					Answer:      "A",
					Explanation: "主语 He 是第三人称单数，一般现在时用 has。",
				},
				{
					BlankNo: 2,
					Options: []map[string]string{
						{"key": "A", "text": "take"},
						{"key": "B", "text": "takes"},
						{"key": "C", "text": "taking"},
						{"key": "D", "text": "took"},
					},
					Answer:      "B",
					Explanation: "与 listens 并列，第三人称单数 takes notes。",
				},
				{
					BlankNo: 3,
					Options: []map[string]string{
						{"key": "A", "text": "play"},
						{"key": "B", "text": "plays"},
						{"key": "C", "text": "playing"},
						{"key": "D", "text": "played"},
					},
					Answer:      "B",
					Explanation: "often 提示一般现在时，he plays。",
				},
				{
					BlankNo: 4,
					Options: []map[string]string{
						{"key": "A", "text": "read"},
						{"key": "B", "text": "reads"},
						{"key": "C", "text": "reading"},
						{"key": "D", "text": "to read"},
					},
					Answer:      "B",
					Explanation: "与 does 并列，第三人称单数 reads。",
				},
			},
		},
		{
			Title:            "The Best Gift",
			Level:            "中阶",
			Summary:          "关于一份特别礼物的短文。",
			EstimatedMinutes: 6,
			SortOrder:        2,
			Content: `Last year, Anna wanted to buy a gift for her grandmother's birthday. She {{1}} many shops, but nothing seemed special enough. Then she remembered that her grandmother loved old family photos.

So Anna {{2}} some photos from different albums and made a small photo book. She wrote a short note under each picture. When her grandmother opened the gift, she {{3}} with tears in her eyes.

"This is the best gift I have ever {{4}}," she said. Anna realized that the most valuable presents are often made with love, not money.`,
			Blanks: []seedClozeBlank{
				{
					BlankNo: 1,
					Options: []map[string]string{
						{"key": "A", "text": "visited"},
						{"key": "B", "text": "visits"},
						{"key": "C", "text": "visiting"},
						{"key": "D", "text": "visit"},
					},
					Answer:      "A",
					Explanation: "Last year 提示过去时，visited。",
				},
				{
					BlankNo: 2,
					Options: []map[string]string{
						{"key": "A", "text": "collected"},
						{"key": "B", "text": "collects"},
						{"key": "C", "text": "collecting"},
						{"key": "D", "text": "collect"},
					},
					Answer:      "A",
					Explanation: "叙述过去发生的动作，用 collected。",
				},
				{
					BlankNo: 3,
					Options: []map[string]string{
						{"key": "A", "text": "smiles"},
						{"key": "B", "text": "smiled"},
						{"key": "C", "text": "smiling"},
						{"key": "D", "text": "smile"},
					},
					Answer:      "B",
					Explanation: "过去时上下文，smiled。",
				},
				{
					BlankNo: 4,
					Options: []map[string]string{
						{"key": "A", "text": "receive"},
						{"key": "B", "text": "receives"},
						{"key": "C", "text": "received"},
						{"key": "D", "text": "receiving"},
					},
					Answer:      "C",
					Explanation: "现在完成时 have/has + 过去分词，received。",
				},
			},
		},
		{
			Title:            "Protecting the Ocean",
			Level:            "高阶",
			Summary:          "关于海洋保护的短文填空。",
			EstimatedMinutes: 7,
			SortOrder:        3,
			Content: `Oceans cover most of our planet and {{1}} a huge variety of life. Yet plastic waste and overfishing are putting marine ecosystems {{2}} risk.

Scientists warn that if current practices continue, many fish populations may {{3}} dramatically within decades. Individuals can help by reducing single-use plastics and supporting policies that {{4}} sustainable fishing.

The ocean's health is closely {{5}} to our own future, so protecting it is not optional—it is necessary.`,
			Blanks: []seedClozeBlank{
				{
					BlankNo: 1,
					Options: []map[string]string{
						{"key": "A", "text": "support"},
						{"key": "B", "text": "supports"},
						{"key": "C", "text": "supporting"},
						{"key": "D", "text": "supported"},
					},
					Answer:      "A",
					Explanation: "主语 Oceans 是复数，一般现在时用 support。",
				},
				{
					BlankNo: 2,
					Options: []map[string]string{
						{"key": "A", "text": "in"},
						{"key": "B", "text": "at"},
						{"key": "C", "text": "on"},
						{"key": "D", "text": "for"},
					},
					Answer:      "B",
					Explanation: "固定搭配 put ... at risk。",
				},
				{
					BlankNo: 3,
					Options: []map[string]string{
						{"key": "A", "text": "decline"},
						{"key": "B", "text": "declines"},
						{"key": "C", "text": "declining"},
						{"key": "D", "text": "declined"},
					},
					Answer:      "A",
					Explanation: "情态动词 may 后接动词原形 decline。",
				},
				{
					BlankNo: 4,
					Options: []map[string]string{
						{"key": "A", "text": "encourage"},
						{"key": "B", "text": "encourages"},
						{"key": "C", "text": "encouraging"},
						{"key": "D", "text": "encouraged"},
					},
					Answer:      "A",
					Explanation: "定语从句 that 指 policies（复数），encourage。",
				},
				{
					BlankNo: 5,
					Options: []map[string]string{
						{"key": "A", "text": "link"},
						{"key": "B", "text": "linking"},
						{"key": "C", "text": "linked"},
						{"key": "D", "text": "links"},
					},
					Answer:      "C",
					Explanation: "be closely linked to 固定搭配。",
				},
			},
		},
	}

	return s.DB.Transaction(func(tx *gorm.DB) error {
		for _, p := range passages {
			var count int64
			tx.Model(&models.ClozePassage{}).
				Where("title = ?", p.Title).
				Count(&count)
			if count > 0 {
				continue
			}

			passage := models.ClozePassage{
				Title:            p.Title,
				Level:            p.Level,
				Content:          p.Content,
				Summary:          p.Summary,
				Status:           models.ClozeStatusPublished,
				BlankCount:       len(p.Blanks),
				EstimatedMinutes: p.EstimatedMinutes,
				SortOrder:        p.SortOrder,
			}
			passage.SetCreateInfo("seed")
			if err := tx.Create(&passage).Error; err != nil {
				return err
			}

			for _, b := range p.Blanks {
				opts, err := json.Marshal(b.Options)
				if err != nil {
					return err
				}
				bb := models.ClozeBlank{
					PassageID:   passage.ID,
					BlankNo:     b.BlankNo,
					Options:     string(opts),
					Answer:      b.Answer,
					Explanation: b.Explanation,
				}
				bb.SetCreateInfo("seed")
				if err := tx.Create(&bb).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

type seedGrammarQuestion struct {
	Stem        string
	Options     []map[string]string
	Answer      string
	Explanation string
}

type seedGrammarLesson struct {
	Title            string
	Topic            string
	Level            string
	Summary          string
	Explanation      string
	Examples         []map[string]string
	EstimatedMinutes int
	SortOrder        int
	Questions        []seedGrammarQuestion
}

func (s *SeedService) seedGrammarLessons() error {
	lessons := []seedGrammarLesson{
		{
			Title:            "一般现在时：习惯与事实",
			Topic:            "一般现在时",
			Level:            "初阶",
			Summary:          "表达经常发生的动作或客观事实。",
			EstimatedMinutes: 6,
			SortOrder:        1,
			Explanation: `一般现在时（Simple Present）常用来描述：
1）习惯、重复发生的动作（often / usually / every day）
2）客观事实或真理（The sun rises in the east.）

构成：
• 主语 + 动词原形（I/You/We/They work）
• 主语为第三人称单数时，动词加 -s/-es（He/She/It works）

否定：do/does + not + 动词原形
疑问：Do/Does + 主语 + 动词原形？`,
			Examples: []map[string]string{
				{"en": "She goes to school by bus every day.", "zh": "她每天坐公交上学。"},
				{"en": "Water boils at 100°C.", "zh": "水在 100°C 沸腾。"},
				{"en": "Do they play football on weekends?", "zh": "他们周末踢足球吗？"},
			},
			Questions: []seedGrammarQuestion{
				{
					Stem: "He _____ English every morning.",
					Options: []map[string]string{
						{"key": "A", "text": "study"},
						{"key": "B", "text": "studies"},
						{"key": "C", "text": "studying"},
						{"key": "D", "text": "studied"},
					},
					Answer:      "B",
					Explanation: "主语 He 是第三人称单数，一般现在时用 studies。",
				},
				{
					Stem: "_____ she like coffee?",
					Options: []map[string]string{
						{"key": "A", "text": "Do"},
						{"key": "B", "text": "Does"},
						{"key": "C", "text": "Is"},
						{"key": "D", "text": "Are"},
					},
					Answer:      "B",
					Explanation: "第三人称单数一般疑问句用 Does。",
				},
				{
					Stem: "They _____ live in Beijing.",
					Options: []map[string]string{
						{"key": "A", "text": "doesn't"},
						{"key": "B", "text": "don't"},
						{"key": "C", "text": "isn't"},
						{"key": "D", "text": "aren't"},
					},
					Answer:      "B",
					Explanation: "They 用 don't + 动词原形。",
				},
			},
		},
		{
			Title:            "现在进行时：正在发生",
			Topic:            "现在进行时",
			Level:            "初阶",
			Summary:          "表达此刻或现阶段正在进行的动作。",
			EstimatedMinutes: 6,
			SortOrder:        2,
			Explanation: `现在进行时（Present Continuous）表示：
1）说话时正在进行的动作（now / at the moment）
2）现阶段暂时性的安排

构成：am / is / are + 动词-ing

注意：部分动词（如 know, like, want）通常不用进行时。`,
			Examples: []map[string]string{
				{"en": "I am reading a book now.", "zh": "我现在正在看书。"},
				{"en": "Look! The kids are playing outside.", "zh": "看！孩子们在外面玩。"},
				{"en": "She isn't working this week.", "zh": "她这周不工作。"},
			},
			Questions: []seedGrammarQuestion{
				{
					Stem: "Listen! Someone _____ the piano.",
					Options: []map[string]string{
						{"key": "A", "text": "play"},
						{"key": "B", "text": "plays"},
						{"key": "C", "text": "is playing"},
						{"key": "D", "text": "played"},
					},
					Answer:      "C",
					Explanation: "Listen! 提示此刻正在发生，用现在进行时。",
				},
				{
					Stem: "They _____ TV at the moment.",
					Options: []map[string]string{
						{"key": "A", "text": "watch"},
						{"key": "B", "text": "are watching"},
						{"key": "C", "text": "watches"},
						{"key": "D", "text": "watched"},
					},
					Answer:      "B",
					Explanation: "at the moment 搭配现在进行时。",
				},
				{
					Stem: "Which sentence is correct?",
					Options: []map[string]string{
						{"key": "A", "text": "I am knowing the answer."},
						{"key": "B", "text": "I know the answer."},
						{"key": "C", "text": "I knowing the answer."},
						{"key": "D", "text": "I am know the answer."},
					},
					Answer:      "B",
					Explanation: "know 是状态动词，一般不用进行时。",
				},
			},
		},
		{
			Title:            "一般过去时：已完成的动作",
			Topic:            "一般过去时",
			Level:            "中阶",
			Summary:          "描述过去某个时间发生且已结束的动作。",
			EstimatedMinutes: 7,
			SortOrder:        3,
			Explanation: `一般过去时（Simple Past）用于描述过去发生的事情。

规则动词：动词 + -ed（work → worked）
不规则动词：需单独记忆（go → went, see → saw）

否定：did not (didn't) + 动词原形
疑问：Did + 主语 + 动词原形？`,
			Examples: []map[string]string{
				{"en": "I visited my grandparents last Sunday.", "zh": "上周日我去看望了祖父母。"},
				{"en": "She didn't finish her homework.", "zh": "她没有完成作业。"},
				{"en": "Did you see that movie?", "zh": "你看过那部电影吗？"},
			},
			Questions: []seedGrammarQuestion{
				{
					Stem: "They _____ to the park yesterday.",
					Options: []map[string]string{
						{"key": "A", "text": "go"},
						{"key": "B", "text": "goes"},
						{"key": "C", "text": "went"},
						{"key": "D", "text": "going"},
					},
					Answer:      "C",
					Explanation: "yesterday 提示过去时，go 的过去式是 went。",
				},
				{
					Stem: "He _____ not call me last night.",
					Options: []map[string]string{
						{"key": "A", "text": "do"},
						{"key": "B", "text": "does"},
						{"key": "C", "text": "did"},
						{"key": "D", "text": "is"},
					},
					Answer:      "C",
					Explanation: "过去时否定用 did not + 动词原形。",
				},
				{
					Stem: "_____ you finish the report?",
					Options: []map[string]string{
						{"key": "A", "text": "Do"},
						{"key": "B", "text": "Does"},
						{"key": "C", "text": "Did"},
						{"key": "D", "text": "Are"},
					},
					Answer:      "C",
					Explanation: "询问过去是否完成，用 Did。",
				},
				{
					Stem: "Choose the correct sentence.",
					Options: []map[string]string{
						{"key": "A", "text": "She didn't went home."},
						{"key": "B", "text": "She didn't go home."},
						{"key": "C", "text": "She not go home."},
						{"key": "D", "text": "She doesn't went home."},
					},
					Answer:      "B",
					Explanation: "didn't 后必须接动词原形 go。",
				},
			},
		},
		{
			Title:            "现在完成时：与现在相关的过去",
			Topic:            "现在完成时",
			Level:            "高阶",
			Summary:          "强调过去动作对现在的影响，或从过去持续到现在。",
			EstimatedMinutes: 8,
			SortOrder:        4,
			Explanation: `现在完成时（Present Perfect）构成：have/has + 过去分词。

常见用法：
1）过去发生、对现在仍有影响（I have lost my keys.）
2）从过去持续到现在（I have lived here for 5 years.）
3）经历（Have you ever been to Japan?）

信号词：already, yet, just, ever, never, for, since`,
			Examples: []map[string]string{
				{"en": "I have already finished my homework.", "zh": "我已经完成作业了。"},
				{"en": "She has lived in Shanghai since 2018.", "zh": "她从 2018 年起住在上海。"},
				{"en": "Have you ever tried sushi?", "zh": "你吃过寿司吗？"},
			},
			Questions: []seedGrammarQuestion{
				{
					Stem: "I _____ this book three times.",
					Options: []map[string]string{
						{"key": "A", "text": "read"},
						{"key": "B", "text": "have read"},
						{"key": "C", "text": "am reading"},
						{"key": "D", "text": "reads"},
					},
					Answer:      "B",
					Explanation: "表示经历/结果，用现在完成时 have read。",
				},
				{
					Stem: "She has worked here _____ 2020.",
					Options: []map[string]string{
						{"key": "A", "text": "for"},
						{"key": "B", "text": "since"},
						{"key": "C", "text": "in"},
						{"key": "D", "text": "at"},
					},
					Answer:      "B",
					Explanation: "since + 时间点（2020）。",
				},
				{
					Stem: "_____ you ever visited Paris?",
					Options: []map[string]string{
						{"key": "A", "text": "Do"},
						{"key": "B", "text": "Did"},
						{"key": "C", "text": "Have"},
						{"key": "D", "text": "Are"},
					},
					Answer:      "C",
					Explanation: "ever 常与现在完成时连用：Have you ever...?",
				},
				{
					Stem: "Which is correct?",
					Options: []map[string]string{
						{"key": "A", "text": "He has went to school."},
						{"key": "B", "text": "He have gone to school."},
						{"key": "C", "text": "He has gone to school."},
						{"key": "D", "text": "He has go to school."},
					},
					Answer:      "C",
					Explanation: "He has + 过去分词 gone。",
				},
			},
		},
	}

	return s.DB.Transaction(func(tx *gorm.DB) error {
		for _, l := range lessons {
			var count int64
			tx.Model(&models.GrammarLesson{}).
				Where("title = ?", l.Title).
				Count(&count)
			if count > 0 {
				continue
			}

			exJSON, err := json.Marshal(l.Examples)
			if err != nil {
				return err
			}

			lesson := models.GrammarLesson{
				Title:            l.Title,
				Topic:            l.Topic,
				Level:            l.Level,
				Explanation:      l.Explanation,
				Examples:         string(exJSON),
				Summary:          l.Summary,
				Status:           models.GrammarStatusPublished,
				EstimatedMinutes: l.EstimatedMinutes,
				SortOrder:        l.SortOrder,
			}
			lesson.SetCreateInfo("seed")
			if err := tx.Create(&lesson).Error; err != nil {
				return err
			}

			for i, q := range l.Questions {
				opts, err := json.Marshal(q.Options)
				if err != nil {
					return err
				}
				qq := models.GrammarQuestion{
					LessonID:    lesson.ID,
					Stem:        q.Stem,
					Options:     string(opts),
					Answer:      q.Answer,
					Explanation: q.Explanation,
					SortOrder:   i + 1,
				}
				qq.SetCreateInfo("seed")
				if err := tx.Create(&qq).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}
