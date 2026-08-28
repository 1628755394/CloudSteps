package models

import (
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"gorm.io/gorm"
)

const (
	UserWordStatusPending   = "pending"
	UserWordStatusAdopted   = "adopted"
	UserWordStatusDismissed = "dismissed"

	UserWordWordMaxRunes     = 128
	UserWordPhoneticMaxRunes = 128
	UserWordPOSMaxRunes      = 50
	UserWordTextMaxRunes     = 8000
	UserWordExampleMaxRunes  = 2000
	UserWordNotesMaxRunes    = 500
)

var (
	ErrUserWordEmpty   = errors.New("user word overlay is empty")
	ErrUserWordTooLong = errors.New("user word field is too long")
	ErrUserWordMissing = errors.New("user word not found")
)

// UserWord is a per-user overlay of a Word. Display prefers these fields
// when present; the canonical Word row is not mutated until an admin adopts it.
type UserWord struct {
	BaseModel
	UserID          uint   `json:"userId" gorm:"uniqueIndex:uidx_user_word_overlay;not null"`
	WordID          uint   `json:"wordId" gorm:"uniqueIndex:uidx_user_word_overlay;index;not null"`
	WordBookID      uint   `json:"wordBookId" gorm:"index;not null"`
	Word            string `json:"word" gorm:"size:128"`
	Phonetic        string `json:"phonetic" gorm:"size:128"`
	PhoneticUS      string `json:"phoneticUs" gorm:"size:128"`
	PhoneticUK      string `json:"phoneticUk" gorm:"size:128"`
	Translation      string `json:"translation" gorm:"type:text"`
	TranslationShort string `json:"translationShort" gorm:"type:text"`
	PartOfSpeech    string `json:"partOfSpeech" gorm:"size:50"`
	Definition      string `json:"definition" gorm:"type:text"`
	ExampleSentence string `json:"exampleSentence" gorm:"type:text"`
	Notes           string `json:"notes" gorm:"type:text"`
	Status          string `json:"status" gorm:"size:16;index;not null;default:pending"`
}

func (UserWord) TableName() string { return constants.TABLE_USER_WORDS }

// UserWordFields is the editable overlay snapshot sent by the learner.
type UserWordFields struct {
	Word            string `json:"word"`
	Phonetic        string `json:"phonetic"`
	PhoneticUS      string `json:"phoneticUs"`
	PhoneticUK      string `json:"phoneticUk"`
	Translation      string `json:"translation"`
	TranslationShort string `json:"translationShort"`
	PartOfSpeech    string `json:"partOfSpeech"`
	Definition      string `json:"definition"`
	ExampleSentence string `json:"exampleSentence"`
	Notes           string `json:"notes"`
}

func NormalizeUserWordFields(in UserWordFields) (UserWordFields, error) {
	out := UserWordFields{
		Word:            strings.TrimSpace(in.Word),
		Phonetic:        strings.TrimSpace(in.Phonetic),
		PhoneticUS:      strings.TrimSpace(in.PhoneticUS),
		PhoneticUK:      strings.TrimSpace(in.PhoneticUK),
		Translation:      strings.TrimSpace(in.Translation),
		TranslationShort: strings.TrimSpace(in.TranslationShort),
		PartOfSpeech:    strings.TrimSpace(in.PartOfSpeech),
		Definition:      strings.TrimSpace(in.Definition),
		ExampleSentence: strings.TrimSpace(in.ExampleSentence),
		Notes:           strings.TrimSpace(in.Notes),
	}
	if err := checkRuneLen(out.Word, UserWordWordMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if err := checkRuneLen(out.Phonetic, UserWordPhoneticMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if err := checkRuneLen(out.PhoneticUS, UserWordPhoneticMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if err := checkRuneLen(out.PhoneticUK, UserWordPhoneticMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if err := checkRuneLen(out.PartOfSpeech, UserWordPOSMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if err := checkRuneLen(out.Translation, UserWordTextMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if err := checkRuneLen(out.TranslationShort, UserWordTextMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if err := checkRuneLen(out.Definition, UserWordTextMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if err := checkRuneLen(out.ExampleSentence, UserWordExampleMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if err := checkRuneLen(out.Notes, UserWordNotesMaxRunes); err != nil {
		return UserWordFields{}, err
	}
	if !out.hasDisplay() {
		return UserWordFields{}, ErrUserWordEmpty
	}
	return out, nil
}

func (f UserWordFields) hasDisplay() bool {
	return f.Word != "" || f.Phonetic != "" || f.PhoneticUS != "" || f.PhoneticUK != "" ||
		f.Translation != "" || f.TranslationShort != "" || f.PartOfSpeech != "" || f.Definition != "" || f.ExampleSentence != ""
}

func checkRuneLen(s string, max int) error {
	if utf8.RuneCountInString(s) > max {
		return ErrUserWordTooLong
	}
	return nil
}

func (u *UserWord) applyFields(f UserWordFields) {
	u.Word = f.Word
	u.Phonetic = f.Phonetic
	u.PhoneticUS = f.PhoneticUS
	u.PhoneticUK = f.PhoneticUK
	u.Translation = f.Translation
	u.TranslationShort = f.TranslationShort
	u.PartOfSpeech = f.PartOfSpeech
	u.Definition = f.Definition
	u.ExampleSentence = f.ExampleSentence
	u.Notes = f.Notes
}

func (u *UserWord) ApplyToWord(w *Word) {
	if u == nil || w == nil {
		return
	}
	if u.Word != "" {
		w.Word = u.Word
	}
	if u.Phonetic != "" {
		w.Phonetic = u.Phonetic
	}
	if u.PhoneticUS != "" {
		w.PhoneticUS = u.PhoneticUS
	}
	if u.PhoneticUK != "" {
		w.PhoneticUK = u.PhoneticUK
	}
	if u.Translation != "" {
		w.Translation = u.Translation
	}
	if u.TranslationShort != "" {
		w.TranslationShort = u.TranslationShort
	}
	if u.PartOfSpeech != "" {
		w.PartOfSpeech = u.PartOfSpeech
	}
	if u.Definition != "" {
		w.Definition = u.Definition
	}
	if u.ExampleSentence != "" {
		w.ExampleSentence = u.ExampleSentence
	}
	w.Overridden = true
}

func (u *UserWord) ApplyToLite(w *WordLite) {
	if u == nil || w == nil {
		return
	}
	if u.Word != "" {
		w.Word = u.Word
	}
	if u.Phonetic != "" {
		w.Phonetic = u.Phonetic
	}
	if u.PhoneticUS != "" {
		w.PhoneticUS = u.PhoneticUS
	}
	if u.PhoneticUK != "" {
		w.PhoneticUK = u.PhoneticUK
	}
	if u.Translation != "" {
		w.Translation = u.Translation
	}
	if u.TranslationShort != "" {
		w.TranslationShort = u.TranslationShort
	}
	if u.PartOfSpeech != "" {
		w.PartOfSpeech = u.PartOfSpeech
	}
	if u.Definition != "" {
		w.Definition = u.Definition
	}
	w.Overridden = true
}

func (u *UserWord) CanonicalUpdates() map[string]any {
	if u == nil {
		return nil
	}
	m := map[string]any{}
	if u.Word != "" {
		m["word"] = u.Word
	}
	if u.Phonetic != "" {
		m["phonetic"] = u.Phonetic
	}
	if u.PhoneticUS != "" {
		m["phonetic_us"] = u.PhoneticUS
	}
	if u.PhoneticUK != "" {
		m["phonetic_uk"] = u.PhoneticUK
	}
	if u.Translation != "" {
		m["translation"] = u.Translation
	}
	if u.TranslationShort != "" {
		m["translation_short"] = u.TranslationShort
	}
	if u.PartOfSpeech != "" {
		m["part_of_speech"] = u.PartOfSpeech
	}
	if u.Definition != "" {
		m["definition"] = u.Definition
	}
	if u.ExampleSentence != "" {
		m["example_sentence"] = u.ExampleSentence
	}
	return m
}

func OverlayWordLites(db *gorm.DB, userID uint, words []WordLite) {
	if db == nil || userID == 0 || len(words) == 0 {
		return
	}
	ids := make([]uint, 0, len(words))
	seen := map[uint]struct{}{}
	for i := range words {
		id := words[i].ID
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return
	}
	var rows []UserWord
	if err := db.Where("user_id = ? AND word_id IN ? AND is_deleted = ?", userID, ids, SoftDeleteStatusActive).
		Find(&rows).Error; err != nil || len(rows) == 0 {
		return
	}
	byID := make(map[uint]UserWord, len(rows))
	for _, row := range rows {
		byID[row.WordID] = row
	}
	for i := range words {
		if ow, ok := byID[words[i].ID]; ok {
			ow.ApplyToLite(&words[i])
		}
	}
}

func OverlayWord(db *gorm.DB, userID uint, w *Word) {
	if db == nil || userID == 0 || w == nil || w.ID == 0 {
		return
	}
	var row UserWord
	if err := db.Where("user_id = ? AND word_id = ? AND is_deleted = ?", userID, w.ID, SoftDeleteStatusActive).
		First(&row).Error; err != nil {
		return
	}
	row.ApplyToWord(w)
}

func GetUserWord(db *gorm.DB, userID, wordID uint) (*UserWord, error) {
	var row UserWord
	if err := db.Where("user_id = ? AND word_id = ? AND is_deleted = ?", userID, wordID, SoftDeleteStatusActive).
		First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func UpsertUserWord(db *gorm.DB, userID uint, word *Word, fields UserWordFields, operator string) (*UserWord, error) {
	if word == nil || word.ID == 0 {
		return nil, ErrUserWordMissing
	}
	normalized, err := NormalizeUserWordFields(fields)
	if err != nil {
		return nil, err
	}
	var row UserWord
	err = db.Unscoped().Where("user_id = ? AND word_id = ?", userID, word.ID).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row = UserWord{
			UserID:     userID,
			WordID:     word.ID,
			WordBookID: word.WordBookID,
			Status:     UserWordStatusPending,
		}
		row.applyFields(normalized)
		row.SetCreateInfo(operator)
		if err := db.Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	if err != nil {
		return nil, err
	}
	row.IsDeleted = SoftDeleteStatusActive
	row.WordBookID = word.WordBookID
	row.Status = UserWordStatusPending
	row.applyFields(normalized)
	row.SetUpdateInfo(operator)
	if err := db.Save(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func DeleteUserWord(db *gorm.DB, userID, wordID uint, operator string) error {
	var row UserWord
	if err := db.Where("user_id = ? AND word_id = ? AND is_deleted = ?", userID, wordID, SoftDeleteStatusActive).
		First(&row).Error; err != nil {
		return err
	}
	return db.Model(&row).Updates(map[string]any{
		"is_deleted": SoftDeleteStatusDeleted,
		"update_by":  operator,
	}).Error
}

func AdoptUserWord(db *gorm.DB, row *UserWord, operator string) error {
	if row == nil || row.ID == 0 {
		return ErrUserWordMissing
	}
	vals := row.CanonicalUpdates()
	if len(vals) == 0 {
		return ErrUserWordEmpty
	}
	vals["update_by"] = operator
	if err := UpdateWord(db, row.WordID, vals); err != nil {
		return err
	}
	return db.Model(row).Updates(map[string]any{
		"status":    UserWordStatusAdopted,
		"update_by": operator,
	}).Error
}
