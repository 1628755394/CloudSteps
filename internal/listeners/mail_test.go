package listeners

import (
	"testing"

	notify2 "github.com/LingByte/CloudStepsGo/pkg/notify"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestEnabledMailConfigs(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&notify2.NotificationChannel{}); err != nil {
		t.Fatal(err)
	}
	if _, err := EnabledMailConfigs(nil); err == nil {
		t.Fatal("expected nil db error")
	}
	if _, err := EnabledMailConfigs(db); err == nil {
		t.Fatal("expected no channels error")
	}
	raw, err := notify2.BuildEmailChannelConfigJSON("smtp", "primary", "smtp.example.com", 587, "u", "p", "from@example.com", "From", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	row := notify2.NotificationChannel{
		Type: notify2.NotificationChannelTypeEmail, Code: "E-1", Name: "primary",
		Enabled: true, ConfigJSON: raw,
	}
	if err := db.Create(&row).Error; err != nil {
		t.Fatal(err)
	}
	cfgs, err := EnabledMailConfigs(db)
	if err != nil || len(cfgs) != 1 || cfgs[0].Host != "smtp.example.com" {
		t.Fatalf("cfgs=%v err=%v", cfgs, err)
	}
}

func TestLoadEmailTemplate(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&notify2.MailTemplate{}); err != nil {
		t.Fatal(err)
	}
	tpl := &notify2.MailTemplate{
		Code: "welcome", Name: "欢迎", ChannelType: notify2.NotificationTemplateTypeEmail,
		Subject: "Hi {{.Username}}", Enabled: true,
	}
	notify2.ApplyMailTemplateHTMLDerivedFields(tpl, "<p>{{.Username}}</p>", "")
	if err := db.Create(tpl).Error; err != nil {
		t.Fatal(err)
	}
	loaded, err := loadEmailTemplate(db, "welcome", "")
	if err != nil || loaded.Subject != "Hi {{.Username}}" || loaded.HTMLBody != "<p>{{.Username}}</p>" {
		t.Fatalf("loaded=%+v err=%v", loaded, err)
	}
}

func TestLoadInboxTemplate(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&notify2.MailTemplate{}); err != nil {
		t.Fatal(err)
	}
	tpl := &notify2.MailTemplate{
		Code: "welcome", Name: "欢迎", ChannelType: notify2.NotificationTemplateTypeInbox,
		InboxTitle: "欢迎注册", InboxBody: "欢迎加入，{{.Username}}", Enabled: true,
	}
	notify2.ApplyInboxTemplateDerivedFields(tpl, "")
	if err := db.Create(tpl).Error; err != nil {
		t.Fatal(err)
	}
	loaded, err := loadInboxTemplate(db, "welcome", "")
	if err != nil || loaded.Title != "欢迎注册" || loaded.Body != "欢迎加入，{{.Username}}" {
		t.Fatalf("loaded=%+v err=%v", loaded, err)
	}
}
