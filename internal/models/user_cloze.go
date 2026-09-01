package models

import (
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	common "github.com/LingByte/ling-base/common"
)

const (
	UserClozeStatusActive   = "active"
	UserClozeStatusArchived = "archived"

	UserClozeSourceManual = "manual"
	UserClozeSourceForm   = "form"
)

// UserClozePassage 用户自定义完形填空
type UserClozePassage struct {
	common.BaseModel
	UserID           uint   `json:"userId" gorm:"index;not null;comment:所属用户ID"`
	Title            string `json:"title" gorm:"size:256;not null;index;comment:标题"`
	Level            string `json:"level" gorm:"size:32;index;comment:难度 初阶/中阶/高阶"`
	Content          string `json:"content" gorm:"type:text;not null;comment:正文含 {{n}} 空位"`
	Summary          string `json:"summary" gorm:"size:512;comment:摘要"`
	Status           string `json:"status" gorm:"size:32;index;default:active;comment:状态 active/archived"`
	Source           string `json:"source" gorm:"size:32;default:form;comment:来源 form/manual"`
	BlankCount       int    `json:"blankCount" gorm:"default:0;comment:空位数"`
	EstimatedMinutes int    `json:"estimatedMinutes" gorm:"default:5;comment:预计分钟"`
	SortOrder        int    `json:"sortOrder" gorm:"default:0;index;comment:排序"`
}

func (UserClozePassage) TableName() string { return constants.TABLE_USER_CLOZE_PASSAGES }

// UserClozeBlank 用户自定义完形空位
type UserClozeBlank struct {
	common.BaseModel
	PassageID   uint   `json:"passageId" gorm:"index;not null;comment:文章ID"`
	BlankNo     int    `json:"blankNo" gorm:"index;not null;comment:空位编号"`
	Options     string `json:"options" gorm:"type:text;not null;comment:选项 JSON"`
	Answer      string `json:"answer" gorm:"size:8;not null;comment:正确答案 key"`
	Explanation string `json:"explanation" gorm:"type:text;comment:解析"`
}

func (UserClozeBlank) TableName() string { return constants.TABLE_USER_CLOZE_BLANKS }

// UserClozeRecord 用户自定义完形练习记录
type UserClozeRecord struct {
	common.BaseModel
	UserID       uint       `json:"userId" gorm:"index;not null;comment:用户ID"`
	PassageID    uint       `json:"passageId" gorm:"index;not null;comment:文章ID"`
	Answers      string     `json:"answers" gorm:"type:text;comment:答题快照 JSON"`
	BlankCount   int        `json:"blankCount" gorm:"comment:空位数"`
	CorrectCount int        `json:"correctCount" gorm:"comment:答对数量"`
	Score        int        `json:"score" gorm:"comment:得分百分比 0-100"`
	DurationSec  int        `json:"durationSec" gorm:"default:0;comment:用时秒"`
	IsLatest     bool       `json:"isLatest" gorm:"default:false;index;comment:该文章最新一次"`
	CompletedAt  *time.Time `json:"completedAt" gorm:"comment:完成时间"`
}

func (UserClozeRecord) TableName() string { return constants.TABLE_USER_CLOZE_RECORDS }
