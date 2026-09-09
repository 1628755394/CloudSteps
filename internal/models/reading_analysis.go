package models

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"gorm.io/gorm"
)

// ReadingSentenceComponent is one labeled span inside a sentence (e.g. 主语 / 谓语).
type ReadingSentenceComponent struct {
	Label string `json:"label"`
	Text  string `json:"text"`
}

// ReadingKeyPhrase is a notable phrase with a short teaching explanation.
type ReadingKeyPhrase struct {
	Text        string `json:"text"`
	Explanation string `json:"explanation"`
}

// ReadingSentenceAnalysis is one sentence's translation, syntax, and key phrases.
type ReadingSentenceAnalysis struct {
	Sentence    string                     `json:"sentence"`
	Translation string                     `json:"translation"`
	Components  []ReadingSentenceComponent `json:"components"`
	KeyPhrases  []ReadingKeyPhrase         `json:"keyPhrases"`
}

// AnalysisChatFunc is the LLM seam used by Ensure*Analysis (injectable in tests).
type AnalysisChatFunc func(ctx context.Context, systemPrompt, userPrompt string) (string, error)

var (
	ErrAnalysisChatRequired = errors.New("analysis chat required")
	ErrAnalysisParse        = errors.New("analysis parse failed")
)

const (
	maxAnalysisSentences = 40
	maxComponentsPerSent = 8
	maxKeyPhrasesPerSent = 4
	analysisBatchSize    = 5
)

const readingAnalysisSystemPrompt = `你是英语阅读精读助教。对给定的编号英文句子做精读解析。
要求：
1. 只输出 JSON 数组，不要 markdown 或其它文字。格式：
[{"sentence":"英文原句","translation":"中文翻译","components":[{"label":"主语","text":"..."},{"label":"谓语","text":"..."}],"keyPhrases":[{"text":"短语","explanation":"一句中文讲解"}]}]
2. 数组长度必须与输入句子数一致，顺序一致；sentence 用输入原文。
3. components 用中文 label（主语/谓语/宾语/定语/状语等），简单句只标核心成分即可。
4. keyPhrases 每句 0-2 个，explanation 用中文且尽量短。`

// AnalysisJSONReady reports whether sentence analysis cache has any stored payload (including empty []).
func AnalysisJSONReady(raw string) bool {
	return strings.TrimSpace(raw) != ""
}

// ParseReadingAnalysisJSON parses a cached analysis payload. Empty input → nil, not ready.
func ParseReadingAnalysisJSON(raw string) ([]ReadingSentenceAnalysis, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, nil
	}
	var items []ReadingSentenceAnalysis
	if err := json.Unmarshal([]byte(s), &items); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAnalysisParse, err)
	}
	return sanitizeAnalysisItems(items), nil
}

func sanitizeAnalysisItems(in []ReadingSentenceAnalysis) []ReadingSentenceAnalysis {
	out := make([]ReadingSentenceAnalysis, 0, len(in))
	for _, item := range in {
		if len(out) >= maxAnalysisSentences {
			break
		}
		sentence := strings.TrimSpace(item.Sentence)
		if sentence == "" {
			continue
		}
		translation := strings.TrimSpace(item.Translation)
		comps := make([]ReadingSentenceComponent, 0, len(item.Components))
		for _, c := range item.Components {
			if len(comps) >= maxComponentsPerSent {
				break
			}
			label := strings.TrimSpace(c.Label)
			text := strings.TrimSpace(c.Text)
			if label == "" || text == "" {
				continue
			}
			comps = append(comps, ReadingSentenceComponent{Label: label, Text: text})
		}
		phrases := make([]ReadingKeyPhrase, 0, len(item.KeyPhrases))
		for _, p := range item.KeyPhrases {
			if len(phrases) >= maxKeyPhrasesPerSent {
				break
			}
			text := strings.TrimSpace(p.Text)
			exp := strings.TrimSpace(p.Explanation)
			if text == "" {
				continue
			}
			phrases = append(phrases, ReadingKeyPhrase{Text: text, Explanation: exp})
		}
		out = append(out, ReadingSentenceAnalysis{
			Sentence:    sentence,
			Translation: translation,
			Components:  comps,
			KeyPhrases:  phrases,
		})
	}
	return out
}

func MarshalReadingAnalysisJSON(items []ReadingSentenceAnalysis) (string, error) {
	clean := sanitizeAnalysisItems(items)
	if clean == nil {
		clean = []ReadingSentenceAnalysis{}
	}
	b, err := json.Marshal(clean)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// SplitReadingSentences splits passage content into English-ish sentences.
func SplitReadingSentences(content string) []string {
	normalized := strings.ReplaceAll(content, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")
	normalized = strings.TrimSpace(normalized)
	if normalized == "" {
		return nil
	}

	var sentences []string
	var b strings.Builder
	flush := func() {
		s := strings.TrimSpace(b.String())
		b.Reset()
		if s == "" {
			return
		}
		sentences = append(sentences, s)
	}

	runes := []rune(normalized)
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		if r == '\n' {
			// Paragraph break often starts a new sentence.
			if b.Len() > 0 {
				prev, _ := utf8.DecodeLastRuneInString(b.String())
				if prev == '.' || prev == '!' || prev == '?' || prev == '"' || prev == '\'' {
					flush()
					continue
				}
			}
			if b.Len() > 0 {
				b.WriteByte(' ')
			}
			continue
		}
		b.WriteRune(r)
		if r != '.' && r != '!' && r != '?' {
			continue
		}
		// Peek ahead: end of text or whitespace/newline → sentence boundary.
		if i+1 >= len(runes) {
			flush()
			continue
		}
		next := runes[i+1]
		if unicode.IsSpace(next) {
			flush()
			// Skip following spaces; loop will handle remaining.
			for i+1 < len(runes) && unicode.IsSpace(runes[i+1]) {
				i++
			}
		}
	}
	flush()

	if len(sentences) > maxAnalysisSentences {
		sentences = sentences[:maxAnalysisSentences]
	}
	return sentences
}

func BuildReadingAnalysisUserPrompt(title string, sentences []string) string {
	var b strings.Builder
	b.WriteString("标题：")
	b.WriteString(strings.TrimSpace(title))
	b.WriteString("\n\n句子：\n")
	for i, s := range sentences {
		fmt.Fprintf(&b, "%d. %s\n", i+1, s)
	}
	b.WriteString("\n请按顺序输出解析 JSON 数组。")
	return b.String()
}

func analysisIndexBySentence(items []ReadingSentenceAnalysis) map[string]ReadingSentenceAnalysis {
	out := make(map[string]ReadingSentenceAnalysis, len(items))
	for _, item := range items {
		key := strings.TrimSpace(item.Sentence)
		if key == "" {
			continue
		}
		out[key] = item
	}
	return out
}

func analysisCoversSentences(items []ReadingSentenceAnalysis, sentences []string) bool {
	if len(sentences) == 0 {
		return true
	}
	if len(items) < len(sentences) {
		return false
	}
	idx := analysisIndexBySentence(items)
	for _, s := range sentences {
		if _, ok := idx[s]; !ok {
			return false
		}
	}
	return true
}

// AnalysisCoversSentences reports whether cached items include every split sentence.
func AnalysisCoversSentences(items []ReadingSentenceAnalysis, sentences []string) bool {
	return analysisCoversSentences(items, sentences)
}

func orderAnalysisBySentences(items []ReadingSentenceAnalysis, sentences []string) []ReadingSentenceAnalysis {
	idx := analysisIndexBySentence(items)
	out := make([]ReadingSentenceAnalysis, 0, len(sentences))
	for _, s := range sentences {
		if item, ok := idx[s]; ok {
			item.Sentence = s
			out = append(out, item)
		}
	}
	return out
}

func analyzeSentenceBatch(
	ctx context.Context,
	title string,
	sentences []string,
	chat AnalysisChatFunc,
) ([]ReadingSentenceAnalysis, error) {
	if len(sentences) == 0 {
		return nil, nil
	}
	raw, err := chat(ctx, readingAnalysisSystemPrompt, BuildReadingAnalysisUserPrompt(title, sentences))
	if err != nil {
		return nil, err
	}
	payload := extractJSONArray(raw)
	parsed, err := ParseReadingAnalysisJSON(payload)
	if err != nil {
		return nil, err
	}
	out := make([]ReadingSentenceAnalysis, len(sentences))
	for i, s := range sentences {
		out[i] = ReadingSentenceAnalysis{Sentence: s}
		if i < len(parsed) {
			out[i].Translation = parsed[i].Translation
			out[i].Components = parsed[i].Components
			out[i].KeyPhrases = parsed[i].KeyPhrases
		}
	}
	return out, nil
}

func generateReadingAnalysis(
	ctx context.Context,
	title string,
	sentences []string,
	existing []ReadingSentenceAnalysis,
	chat AnalysisChatFunc,
	saveProgress func([]ReadingSentenceAnalysis) error,
) ([]ReadingSentenceAnalysis, error) {
	if chat == nil {
		return nil, ErrAnalysisChatRequired
	}
	if len(sentences) == 0 {
		return []ReadingSentenceAnalysis{}, nil
	}

	have := analysisIndexBySentence(existing)
	ordered := orderAnalysisBySentences(existing, sentences)

	var missing []string
	for _, s := range sentences {
		if _, ok := have[s]; !ok {
			missing = append(missing, s)
		}
	}
	if len(missing) == 0 {
		return ordered, nil
	}

	for i := 0; i < len(missing); i += analysisBatchSize {
		if err := ctx.Err(); err != nil {
			_ = saveProgress(orderAnalysisBySentences(mapValues(have), sentences))
			return nil, err
		}
		end := i + analysisBatchSize
		if end > len(missing) {
			end = len(missing)
		}
		batch, err := analyzeSentenceBatch(ctx, title, missing[i:end], chat)
		if err != nil {
			_ = saveProgress(orderAnalysisBySentences(mapValues(have), sentences))
			return nil, err
		}
		for _, item := range batch {
			have[item.Sentence] = item
		}
		ordered = orderAnalysisBySentences(mapValues(have), sentences)
		if err := saveProgress(ordered); err != nil {
			return nil, err
		}
	}

	return ordered, nil
}

func mapValues(m map[string]ReadingSentenceAnalysis) []ReadingSentenceAnalysis {
	out := make([]ReadingSentenceAnalysis, 0, len(m))
	for _, v := range m {
		out = append(out, v)
	}
	return out
}

func ensureAnalysisJSON(
	ctx context.Context,
	cached string,
	save func(json string) error,
	title, content string,
	chat AnalysisChatFunc,
) ([]ReadingSentenceAnalysis, error) {
	sentences := SplitReadingSentences(content)
	var existing []ReadingSentenceAnalysis
	if AnalysisJSONReady(cached) {
		parsed, err := ParseReadingAnalysisJSON(cached)
		if err != nil {
			return nil, err
		}
		if analysisCoversSentences(parsed, sentences) {
			if parsed == nil {
				parsed = []ReadingSentenceAnalysis{}
			}
			return orderAnalysisBySentences(parsed, sentences), nil
		}
		existing = parsed
	}

	saveProgress := func(items []ReadingSentenceAnalysis) error {
		encoded, err := MarshalReadingAnalysisJSON(items)
		if err != nil {
			return err
		}
		return save(encoded)
	}

	items, err := generateReadingAnalysis(ctx, title, sentences, existing, chat, saveProgress)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []ReadingSentenceAnalysis{}
	}
	// Final save (also covers empty-content → []).
	if err := saveProgress(items); err != nil {
		return nil, err
	}
	return items, nil
}

// EnsureReadingPassageAnalysis returns cached sentence analysis or generates and stores it.
func EnsureReadingPassageAnalysis(
	ctx context.Context,
	db *gorm.DB,
	passageID uint,
	chat AnalysisChatFunc,
) ([]ReadingSentenceAnalysis, error) {
	if db == nil || passageID == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var passage ReadingPassage
	if err := db.First(&passage, passageID).Error; err != nil {
		return nil, err
	}
	return ensureAnalysisJSON(ctx, passage.AnalysisJSON, func(encoded string) error {
		return db.Model(&ReadingPassage{}).Where("id = ?", passage.ID).
			Update("analysis_json", encoded).Error
	}, passage.Title, passage.Content, chat)
}

// EnsureUserReadingPassageAnalysis returns cached sentence analysis or generates and stores it.
func EnsureUserReadingPassageAnalysis(
	ctx context.Context,
	db *gorm.DB,
	passageID, userID uint,
	chat AnalysisChatFunc,
) ([]ReadingSentenceAnalysis, error) {
	if db == nil || passageID == 0 || userID == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var passage UserReadingPassage
	if err := db.Where("id = ? AND user_id = ?", passageID, userID).First(&passage).Error; err != nil {
		return nil, err
	}
	return ensureAnalysisJSON(ctx, passage.AnalysisJSON, func(encoded string) error {
		return db.Model(&UserReadingPassage{}).Where("id = ?", passage.ID).
			Update("analysis_json", encoded).Error
	}, passage.Title, passage.Content, chat)
}

// ClearReadingPassageAnalysis invalidates cached sentence analysis (e.g. after content change).
func ClearReadingPassageAnalysis(db *gorm.DB, passageID uint) error {
	if db == nil || passageID == 0 {
		return nil
	}
	return db.Model(&ReadingPassage{}).Where("id = ?", passageID).
		Update("analysis_json", "").Error
}

// ClearUserReadingPassageAnalysis invalidates cached sentence analysis for a custom passage.
func ClearUserReadingPassageAnalysis(db *gorm.DB, passageID uint) error {
	if db == nil || passageID == 0 {
		return nil
	}
	return db.Model(&UserReadingPassage{}).Where("id = ?", passageID).
		Update("analysis_json", "").Error
}
