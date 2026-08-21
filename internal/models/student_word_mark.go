package models

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const TABLE_STUDENT_WORD_MARKS = "student_word_marks"

// StudentWordMark 老师为学员标记的单词（上课收藏，便于课后复习）。
type StudentWordMark struct {
	BaseModel
	TeacherID  uint   `json:"teacherId" gorm:"not null;uniqueIndex:uk_teacher_student_word;index;comment:标记老师"`
	StudentID  uint   `json:"studentId" gorm:"not null;uniqueIndex:uk_teacher_student_word;index;comment:所属学员"`
	WordID     uint   `json:"wordId" gorm:"not null;uniqueIndex:uk_teacher_student_word;index;comment:单词ID"`
	WordBookID uint   `json:"wordBookId" gorm:"default:0;index;comment:来源词库(可选)"`
	Note       string `json:"note" gorm:"size:256;comment:备注"`
}

func (StudentWordMark) TableName() string { return TABLE_STUDENT_WORD_MARKS }

// UpsertStudentWordMark 标记单词；已存在则恢复软删并更新词库。
func UpsertStudentWordMark(db *gorm.DB, teacherID, studentID, wordID, wordBookID uint, note string) (*StudentWordMark, error) {
	if db == nil {
		return nil, errors.New("db is nil")
	}
	if teacherID == 0 || studentID == 0 || wordID == 0 {
		return nil, errors.New("invalid mark params")
	}
	row := StudentWordMark{
		TeacherID:  teacherID,
		StudentID:  studentID,
		WordID:     wordID,
		WordBookID: wordBookID,
		Note:       note,
	}
	err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "teacher_id"},
			{Name: "student_id"},
			{Name: "word_id"},
		},
		DoUpdates: clause.Assignments(map[string]any{
			"is_deleted":   SoftDeleteStatusActive,
			"word_book_id": wordBookID,
			"note":         note,
			"updated_at":   time.Now(),
		}),
	}).Create(&row).Error
	if err != nil {
		return nil, err
	}
	var out StudentWordMark
	if err := db.Where(
		"teacher_id = ? AND student_id = ? AND word_id = ? AND is_deleted = ?",
		teacherID, studentID, wordID, SoftDeleteStatusActive,
	).First(&out).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

// SoftDeleteStudentWordMark 取消标记。
func SoftDeleteStudentWordMark(db *gorm.DB, teacherID, studentID, wordID uint) error {
	if db == nil {
		return errors.New("db is nil")
	}
	res := db.Model(&StudentWordMark{}).
		Where(
			"teacher_id = ? AND student_id = ? AND word_id = ? AND is_deleted = ?",
			teacherID, studentID, wordID, SoftDeleteStatusActive,
		).
		Updates(map[string]any{
			"is_deleted": SoftDeleteStatusDeleted,
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ListActiveStudentWordMarkIDs 返回该师生对下已标记的 word_id（可按候选 id 过滤）。
func ListActiveStudentWordMarkIDs(db *gorm.DB, teacherID, studentID uint, filterWordIDs []uint) ([]uint, error) {
	if db == nil {
		return nil, errors.New("db is nil")
	}
	q := db.Model(&StudentWordMark{}).
		Where(
			"teacher_id = ? AND student_id = ? AND is_deleted = ?",
			teacherID, studentID, SoftDeleteStatusActive,
		)
	if len(filterWordIDs) > 0 {
		q = q.Where("word_id IN ?", filterWordIDs)
	}
	var ids []uint
	if err := q.Pluck("word_id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}
