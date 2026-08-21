package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

const (
	mailProviderSMTP      = "smtp"
	mailProviderSendCloud = "sendcloud"
)

type mailChannelConfig struct {
	Provider string `json:"provider"`
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int64  `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	APIUser  string `json:"api_user"`
	APIKey   string `json:"api_key"`
	From     string `json:"from"`
	FromName string `json:"from_name,omitempty"`
}

const (
	NotificationChannelTypeEmail = "email"
)

// NotificationChannel is a configurable notification outlet (email).
type NotificationChannel struct {
	BaseModel
	Type       string `json:"type" gorm:"size:32;not null;uniqueIndex:idx_notify_type_code;index:idx_notify_ch_type_sort,priority:1;comment:渠道类型"`
	Code       string `json:"code,omitempty" gorm:"size:64;not null;uniqueIndex:idx_notify_type_code;comment:渠道编码"`
	Name       string `json:"name" gorm:"size:128;not null;comment:显示名称"`
	SortOrder  int    `json:"sortOrder" gorm:"not null;default:0;index:idx_notify_ch_type_sort,priority:2;comment:排序权重"`
	Enabled    bool   `json:"enabled" gorm:"not null;default:true;index;comment:是否启用"`
	Remark     string `json:"remark,omitempty" gorm:"size:255;comment:备注"`
	ConfigJSON string `json:"configJson,omitempty" gorm:"type:text;comment:渠道配置 JSON"`
}

func (NotificationChannel) TableName() string { return "notification_channels" }

type EmailChannelFormView struct {
	Driver             string `json:"driver"`
	SMTPHost           string `json:"smtpHost"`
	SMTPPort           int64  `json:"smtpPort"`
	SMTPUsername       string `json:"smtpUsername"`
	SMTPFrom           string `json:"smtpFrom"`
	FromDisplayName    string `json:"fromDisplayName"`
	SMTPPasswordSet    bool   `json:"smtpPasswordSet"`
	SendcloudAPIUser   string `json:"sendcloudApiUser"`
	SendcloudAPIKeySet bool   `json:"sendcloudApiKeySet"`
	SendcloudFrom      string `json:"sendcloudFrom"`
}

func activeChannel(db *gorm.DB) *gorm.DB {
	return db.Where("is_deleted = ?", SoftDeleteStatusActive)
}

func ListNotificationChannels(db *gorm.DB, channelType string, page, pageSize int) ([]NotificationChannel, int64, error) {
	if db == nil {
		return nil, 0, errors.New("nil db")
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	q := activeChannel(db.Model(&NotificationChannel{}))
	if t := strings.TrimSpace(channelType); t != "" {
		q = q.Where("type = ?", t)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []NotificationChannel
	err := q.Order("type ASC, sort_order ASC, id ASC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

func GetNotificationChannel(db *gorm.DB, id uint) (*NotificationChannel, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	var row NotificationChannel
	if err := activeChannel(db).First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func BuildEmailChannelConfigJSON(driver, name string, smtpHost string, smtpPort int64, smtpUser, smtpPassword, smtpFrom, fromDisplayName string, scUser, scKey, scFrom string) (string, error) {
	driver = strings.ToLower(strings.TrimSpace(driver))
	cfg := mailChannelConfig{Name: strings.TrimSpace(name), FromName: strings.TrimSpace(fromDisplayName)}
	switch driver {
	case mailProviderSMTP:
		if strings.TrimSpace(smtpHost) == "" || smtpPort <= 0 || strings.TrimSpace(smtpFrom) == "" {
			return "", errors.New("SMTP 需要 host、port、发件地址")
		}
		cfg.Provider = mailProviderSMTP
		cfg.Host = strings.TrimSpace(smtpHost)
		cfg.Port = smtpPort
		cfg.Username = strings.TrimSpace(smtpUser)
		cfg.Password = smtpPassword
		cfg.From = strings.TrimSpace(smtpFrom)
	case mailProviderSendCloud:
		if strings.TrimSpace(scUser) == "" || strings.TrimSpace(scKey) == "" || strings.TrimSpace(scFrom) == "" {
			return "", errors.New("SendCloud 需要 api_user、api_key、发件地址")
		}
		cfg.Provider = mailProviderSendCloud
		cfg.APIUser = strings.TrimSpace(scUser)
		cfg.APIKey = strings.TrimSpace(scKey)
		cfg.From = strings.TrimSpace(scFrom)
	default:
		return "", fmt.Errorf("不支持的邮件驱动: %s", driver)
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func DecodeEmailChannelForm(configJSON string) (*EmailChannelFormView, error) {
	var cfg mailChannelConfig
	if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
		return nil, err
	}
	v := &EmailChannelFormView{}
	switch strings.ToLower(strings.TrimSpace(cfg.Provider)) {
	case mailProviderSendCloud:
		v.Driver = mailProviderSendCloud
		v.SendcloudAPIUser = cfg.APIUser
		v.SendcloudFrom = cfg.From
		v.SendcloudAPIKeySet = cfg.APIKey != ""
		v.FromDisplayName = cfg.FromName
	case mailProviderSMTP, "":
		v.Driver = mailProviderSMTP
		v.SMTPHost = cfg.Host
		v.SMTPPort = cfg.Port
		v.SMTPUsername = cfg.Username
		v.SMTPFrom = cfg.From
		v.SMTPPasswordSet = cfg.Password != ""
		v.FromDisplayName = cfg.FromName
	default:
		v.Driver = strings.ToLower(strings.TrimSpace(cfg.Provider))
	}
	return v, nil
}

func MergeEmailSecretsOnUpdate(oldJSON, newJSON string) (string, error) {
	var oldC, newC mailChannelConfig
	if err := json.Unmarshal([]byte(oldJSON), &oldC); err != nil {
		return newJSON, err
	}
	if err := json.Unmarshal([]byte(newJSON), &newC); err != nil {
		return newJSON, err
	}
	if strings.ToLower(newC.Provider) == mailProviderSMTP && newC.Password == "" && oldC.Password != "" {
		newC.Password = oldC.Password
	}
	if strings.ToLower(newC.Provider) == mailProviderSendCloud && newC.APIKey == "" && oldC.APIKey != "" {
		newC.APIKey = oldC.APIKey
	}
	if strings.TrimSpace(newC.FromName) == "" && strings.TrimSpace(oldC.FromName) != "" {
		newC.FromName = oldC.FromName
	}
	out, err := json.Marshal(newC)
	if err != nil {
		return newJSON, err
	}
	return string(out), nil
}
