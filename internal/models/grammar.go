package models

import (
	"time"

	common "github.com/LingByte/ling-base/common"
)

const (
	GrammarStatusDraft     = "draft"
	GrammarStatusPublished = "published"
)

// GrammarLesson 语法解析课
type GrammarLesson struct {
	common.BaseModel
	Title            string `json:"title" gorm:"size:256;not null;index;comment:课标题"`
	Topic            string `json:"topic" gorm:"size:128;index;comment:语法主题"`
	Level            string `json:"level" gorm:"size:32;index;comment:难度 初阶/中阶/高阶"`
	Explanation      string `json:"explanation" gorm:"type:text;not null;comment:语法讲解"`
	Examples         string `json:"examples" gorm:"type:text;comment:例句 JSON [{en,zh}]"`
	Summary          string `json:"summary" gorm:"size:512;comment:摘要"`
	Status           string `json:"status" gorm:"size:32;index;default:draft;comment:draft/published"`
	EstimatedMinutes int    `json:"estimatedMinutes" gorm:"default:5;comment:预计分钟"`
	SortOrder        int    `json:"sortOrder" gorm:"default:0;index;comment:排序"`
}

func (GrammarLesson) TableName() string { return "grammar_lessons" }

// GrammarQuestion 语法练习题
type GrammarQuestion struct {
	common.BaseModel
	LessonID    uint   `json:"lessonId" gorm:"index;not null;comment:课ID"`
	Stem        string `json:"stem" gorm:"type:text;not null;comment:题干"`
	Options     string `json:"options" gorm:"type:text;not null;comment:选项 JSON [{key,text}]"`
	Answer      string `json:"answer" gorm:"size:8;not null;comment:正确答案 key"`
	Explanation string `json:"explanation" gorm:"type:text;comment:解析"`
	SortOrder   int    `json:"sortOrder" gorm:"default:0;index;comment:题序"`
}

func (GrammarQuestion) TableName() string { return "grammar_questions" }

// GrammarRecord 语法练习答题记录
type GrammarRecord struct {
	common.BaseModel
	UserID        uint       `json:"userId" gorm:"index;not null;comment:用户ID"`
	LessonID      uint       `json:"lessonId" gorm:"index;not null;comment:课ID"`
	Answers       string     `json:"answers" gorm:"type:text;comment:答题快照 JSON"`
	QuestionCount int        `json:"questionCount" gorm:"comment:题目数"`
	CorrectCount  int        `json:"correctCount" gorm:"comment:答对数量"`
	Score         int        `json:"score" gorm:"comment:得分百分比 0-100"`
	DurationSec   int        `json:"durationSec" gorm:"default:0;comment:用时秒"`
	IsLatest      bool       `json:"isLatest" gorm:"default:false;index;comment:该课最新一次"`
	CompletedAt   *time.Time `json:"completedAt" gorm:"comment:完成时间"`
}

func (GrammarRecord) TableName() string { return "grammar_records" }
