package models

import "time"

// VocabTestQuestion 词汇量测试题
type VocabTestQuestion struct {
	BaseModel
	Word            string `json:"word" gorm:"size:128;not null;index;comment:测试单词"`
	Options         string `json:"options" gorm:"type:text;comment:选项 JSON数组（4个中文释义）"`
	CorrectAnswer   string `json:"correctAnswer" gorm:"size:256;not null;comment:正确答案"`
	Level           string `json:"level" gorm:"size:10;index;index:idx_level_difficulty;comment:对应等级 A1-C1"`
	DifficultyScore int    `json:"difficultyScore" gorm:"default:1;index:idx_level_difficulty;comment:难度分值 用于自适应"`
	AudioURL        string `json:"audioUrl" gorm:"size:512;comment:发音音频URL"`
}

func (VocabTestQuestion) TableName() string { return "vocab_test_questions" }

// VocabTestRecord 词汇量测试记录
type VocabTestRecord struct {
	BaseModel
	UserID         uint       `json:"userId" gorm:"index;not null;comment:提交人（老师代测时为老师）"`
	StudentID      uint       `json:"studentId" gorm:"index;comment:绑定学员；0 表示提交人自己"`
	EstimatedLevel string     `json:"estimatedLevel" gorm:"size:10;comment:测出等级 A1-C1"`
	EstimatedVocab int        `json:"estimatedVocab" gorm:"comment:估算词汇量"`
	Answers        string     `json:"answers" gorm:"type:text;comment:答题详情快照 JSON"`
	QuestionCount  int        `json:"questionCount" gorm:"comment:答题总数"`
	CorrectCount   int        `json:"correctCount" gorm:"comment:答对数量"`
	IsLatest       bool       `json:"isLatest" gorm:"default:false;index;comment:是否最新测试结果"`
	CompletedAt    *time.Time `json:"completedAt" gorm:"comment:完成时间"`
}

// VocabTestOwnerID 该记录归属的学员：老师代测用 StudentID，学员自测用 UserID。
func (r VocabTestRecord) VocabTestOwnerID() uint {
	if r.StudentID > 0 {
		return r.StudentID
	}
	return r.UserID
}

func (VocabTestRecord) TableName() string { return "vocab_test_records" }
