package voice

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/llm"
	"github.com/LingByte/CloudStepsGo/pkg/logger"
	"go.uber.org/zap"
)

// ReviewDetail structured post-session analysis.
type ReviewDetail struct {
	TurnCount           int      `json:"turnCount"`
	UserWordCount       int      `json:"userWordCount"`
	EnglishRatio        float64  `json:"englishRatio"`
	WordsPerMinute      float64  `json:"wordsPerMinute"`
	AvgWordsPerTurn     float64  `json:"avgWordsPerTurn"`
	UniqueWordCount     int      `json:"uniqueWordCount"`
	ChineseCharCount    int      `json:"chineseCharCount"`
	ChineseTurnCount    int      `json:"chineseTurnCount"`
	ShortTurnCount      int      `json:"shortTurnCount"`
	ExplicitCorrections int      `json:"explicitCorrections"`
	ImplicitCorrections int      `json:"implicitCorrections"`
	FluencyScore        int      `json:"fluencyScore"`
	AccuracyScore       int      `json:"accuracyScore"`
	PronunciationScore  int      `json:"pronunciationScore"`
	VocabularyScore     int      `json:"vocabularyScore"`
	ParticipationScore  int      `json:"participationScore"`
	OverallScore        int      `json:"overallScore"`
	Highlights          []string `json:"highlights"`
	Issues              []string `json:"issues"`
	Suggestions         []string `json:"suggestions"`
	NextSteps           []string `json:"nextSteps"`
	AIAnalysis          string   `json:"aiAnalysis"`
}

// SessionMetrics aggregated scores for DB persistence.
type SessionMetrics struct {
	Fluency            int
	Accuracy           int
	Pronunciation      int
	Overall            int
	TurnCount          int
	UserWordCount      int
	CorrectionCount    int
	PronunciationHints int
	ReviewSummary      string
	Detail             ReviewDetail
	DedupedTurns       []models.ScenarioDialogueTurn
}

// AnalyzeSessionTurns deduplicates turns and produces metrics + review detail.
func AnalyzeSessionTurns(
	ctx context.Context,
	scenario *models.ScenarioDialogueScenario,
	turns []models.ScenarioDialogueTurn,
	durationSec int,
) SessionMetrics {
	deduped := DedupeTurns(turns)
	detail := buildReviewDetail(deduped, durationSec)
	detail.AIAnalysis = generateAIReview(ctx, scenario, deduped, detail)

	m := SessionMetrics{
		Fluency:            detail.FluencyScore,
		Accuracy:           detail.AccuracyScore,
		Pronunciation:      detail.PronunciationScore,
		Overall:            detail.OverallScore,
		TurnCount:          detail.TurnCount,
		UserWordCount:      detail.UserWordCount,
		CorrectionCount:    detail.ExplicitCorrections + detail.ImplicitCorrections,
		PronunciationHints: countPronunciationHints(deduped),
		Detail:             detail,
		DedupedTurns:       deduped,
	}
	m.ReviewSummary = buildReviewSummary(m.Detail)
	return m
}

// MarshalReviewDetail serializes detail to JSON for DB storage.
func MarshalReviewDetail(d ReviewDetail) string {
	b, err := json.Marshal(d)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// ParseReviewDetail deserializes stored JSON.
func ParseReviewDetail(raw string) ReviewDetail {
	var d ReviewDetail
	if raw == "" {
		return d
	}
	_ = json.Unmarshal([]byte(raw), &d)
	return d
}

// NormalizeTurnContent collapses duplicated assistant text from streaming.
func NormalizeTurnContent(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	n := len(s)
	if n >= 4 && n%2 == 0 {
		half := n / 2
		if s[:half] == s[half:] {
			return s[:half]
		}
	}
	return s
}

// DedupeTurns removes consecutive duplicate turns and normalizes content.
func DedupeTurns(turns []models.ScenarioDialogueTurn) []models.ScenarioDialogueTurn {
	if len(turns) == 0 {
		return turns
	}
	out := make([]models.ScenarioDialogueTurn, 0, len(turns))
	var prevKey string
	idx := 0
	for _, t := range turns {
		content := NormalizeTurnContent(t.Content)
		if content == "" {
			continue
		}
		key := t.Role + "|" + content
		if key == prevKey {
			continue
		}
		prevKey = key
		idx++
		t.Content = content
		t.TurnIndex = idx
		t.HasCorrection = t.Role == "assistant" && hasExplicitCorrection(content)
		t.HasPronunciation = t.Role == "assistant" && hasPronunciationHint(content)
		if t.Role == "assistant" && !t.HasCorrection {
			t.HasCorrection = hasImplicitCorrection(content)
		}
		out = append(out, t)
	}
	return out
}

func buildReviewDetail(turns []models.ScenarioDialogueTurn, durationSec int) ReviewDetail {
	d := ReviewDetail{
		Highlights:  []string{},
		Issues:      []string{},
		Suggestions: []string{},
		NextSteps:   []string{},
	}
	if durationSec < 1 {
		durationSec = 1
	}
	minutes := float64(durationSec) / 60.0

	var userTurns int
	var englishWords, chineseChars int
	uniqueWords := map[string]struct{}{}
	var shortTurns, chineseTurns int

	for _, t := range turns {
		if t.Role != "user" {
			if t.Role == "assistant" {
				if hasExplicitCorrection(t.Content) {
					d.ExplicitCorrections++
				} else if hasImplicitCorrection(t.Content) {
					d.ImplicitCorrections++
				}
			}
			continue
		}
		userTurns++
		cjk := countCJK(t.Content)
		chineseChars += cjk
		if cjk > 0 {
			chineseTurns++
		}
		words := tokenizeWords(t.Content)
		if len(words) <= 2 {
			shortTurns++
		}
		for _, w := range words {
			if isEnglishWord(w) {
				englishWords++
				uniqueWords[strings.ToLower(w)] = struct{}{}
			}
		}
	}

	d.TurnCount = userTurns
	d.UserWordCount = englishWords + chineseChars
	d.ChineseCharCount = chineseChars
	d.ChineseTurnCount = chineseTurns
	d.ShortTurnCount = shortTurns
	d.UniqueWordCount = len(uniqueWords)

	totalChars := englishWords + chineseChars
	if totalChars > 0 {
		d.EnglishRatio = float64(englishWords) / float64(totalChars)
	}
	if userTurns > 0 {
		d.AvgWordsPerTurn = float64(englishWords) / float64(userTurns)
	}
	if minutes > 0 {
		d.WordsPerMinute = float64(englishWords) / minutes
	}

	d.FluencyScore = scoreFluency(userTurns, englishWords, d.WordsPerMinute, shortTurns)
	d.AccuracyScore = scoreAccuracy(d.EnglishRatio, chineseTurns, userTurns, d.ImplicitCorrections+d.ExplicitCorrections)
	d.PronunciationScore = scorePronunciation(shortTurns, userTurns, d.EnglishRatio)
	d.VocabularyScore = scoreVocabulary(d.UniqueWordCount, userTurns)
	d.ParticipationScore = scoreParticipation(userTurns, durationSec)
	d.OverallScore = (d.FluencyScore + d.AccuracyScore + d.PronunciationScore + d.VocabularyScore + d.ParticipationScore) / 5

	d.Highlights, d.Issues, d.Suggestions, d.NextSteps = ruleBasedInsights(d, turns)
	return d
}

func scoreFluency(turns, words int, wpm float64, shortTurns int) int {
	if turns == 0 {
		return 0
	}
	s := 30 + turns*3
	if wpm >= 25 {
		s += 15
	} else if wpm >= 15 {
		s += 8
	}
	if words >= 40 {
		s += 10
	}
	s -= shortTurns * 4
	return clampScore(s)
}

func scoreAccuracy(englishRatio float64, chineseTurns, userTurns, corrections int) int {
	if userTurns == 0 {
		return 0
	}
	s := int(englishRatio * 70)
	s += 20
	s -= chineseTurns * 8
	s -= corrections * 6
	return clampScore(s)
}

func scorePronunciation(shortTurns, userTurns int, englishRatio float64) int {
	if userTurns == 0 {
		return 0
	}
	s := 50 + int(englishRatio*30)
	s -= shortTurns * 5
	return clampScore(s)
}

func scoreVocabulary(uniqueWords, userTurns int) int {
	if userTurns == 0 {
		return 0
	}
	s := 40 + uniqueWords*4
	if uniqueWords >= 15 {
		s += 10
	}
	return clampScore(s)
}

func scoreParticipation(turns, durationSec int) int {
	if turns == 0 {
		return 0
	}
	s := 30 + turns*4
	if durationSec >= 120 {
		s += 15
	} else if durationSec >= 60 {
		s += 8
	}
	return clampScore(s)
}

func clampScore(s int) int {
	if s < 0 {
		return 0
	}
	if s > 100 {
		return 100
	}
	return s
}

func ruleBasedInsights(d ReviewDetail, turns []models.ScenarioDialogueTurn) ([]string, []string, []string, []string) {
	var highlights, issues, suggestions, nextSteps []string

	if d.TurnCount >= 8 {
		highlights = append(highlights, fmt.Sprintf("完成了 %d 轮有效对话，参与度较好", d.TurnCount))
	}
	if d.EnglishRatio >= 0.7 {
		highlights = append(highlights, "大部分表达使用英语，场景沉浸感不错")
	}
	if d.UniqueWordCount >= 12 {
		highlights = append(highlights, fmt.Sprintf("使用了 %d 个不同英文词汇", d.UniqueWordCount))
	}

	if d.ChineseTurnCount > 0 {
		issues = append(issues, fmt.Sprintf("有 %d 轮使用了中文，建议尽量用英语表达", d.ChineseTurnCount))
	}
	if d.ShortTurnCount > d.TurnCount/2 && d.TurnCount > 0 {
		issues = append(issues, "较多短句或语气词（嗯、哦），完整句子练习不足")
	}
	if d.AvgWordsPerTurn < 4 {
		issues = append(issues, fmt.Sprintf("平均每轮仅 %.1f 个英文词，句子偏短", d.AvgWordsPerTurn))
	}
	if d.ImplicitCorrections+d.ExplicitCorrections > 0 {
		issues = append(issues, fmt.Sprintf("对话中出现 %d 处表达需纠正或澄清", d.ImplicitCorrections+d.ExplicitCorrections))
	}

	if d.EnglishRatio < 0.6 {
		suggestions = append(suggestions, "下次练习前默念 3 句场景开场白，全程坚持 English only")
	}
	if d.AvgWordsPerTurn < 5 {
		suggestions = append(suggestions, "尝试用完整句回答，如 \"I'd like a blue casual shirt, size M.\"")
	}
	if d.WordsPerMinute < 20 {
		suggestions = append(suggestions, "适当放慢语速，确保每个词发音清晰")
	}
	if d.ImplicitCorrections > 0 {
		suggestions = append(suggestions, "留意 AI 的纠错提示，重复正确说法 1-2 遍加深记忆")
	}

	nextSteps = append(nextSteps, "复习本次对话中的关键词：shirt, casual, size, relaxing")
	if d.AccuracyScore < 70 {
		nextSteps = append(nextSteps, "推荐再练「商场购物」场景 1 次，专注完整英文句子")
	} else {
		nextSteps = append(nextSteps, "可挑战更高难度场景，如「求职面试」")
	}
	nextSteps = append(nextSteps, "每天 5 分钟跟读 AI 回复，模仿语音语调")

	if len(highlights) == 0 && d.TurnCount > 0 {
		highlights = append(highlights, "已完成本次场景对话练习")
	}
	return highlights, issues, suggestions, nextSteps
}

func buildReviewSummary(d ReviewDetail) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("本次有效对话 %d 轮，英文词约 %d 个，语速 %.0f 词/分钟，英语占比 %.0f%%。",
		d.TurnCount, d.UserWordCount, d.WordsPerMinute, d.EnglishRatio*100))
	if len(d.Issues) > 0 {
		b.WriteString(" 主要问题：" + d.Issues[0])
	}
	if d.AIAnalysis != "" {
		b.WriteString(" " + trimFirstSentence(d.AIAnalysis, 120))
	}
	return strings.TrimSpace(b.String())
}

func generateAIReview(ctx context.Context, scenario *models.ScenarioDialogueScenario, turns []models.ScenarioDialogueTurn, detail ReviewDetail) string {
	if config.GlobalConfig == nil || strings.TrimSpace(config.GlobalConfig.Services.LLM.APIKey) == "" {
		return ""
	}
	var transcript strings.Builder
	for _, t := range turns {
		role := "Student"
		if t.Role == "assistant" {
			role = "Coach"
		}
		transcript.WriteString(fmt.Sprintf("%s: %s\n", role, t.Content))
	}
	sceneName := "conversation"
	if scenario != nil {
		sceneName = scenario.Name
	}
	prompt := fmt.Sprintf(`你是一位英语口语教练。根据以下「%s」场景对话记录和量化数据，用中文写一段150字以内的复盘分析，并给出2条具体后续练习建议。要求客观、针对性强，不要说空话。

数据：轮次%d，英文词%d，英语占比%.0f%%，语速%.0f词/分，语法纠正%d处，中文表达%d轮。

对话记录：
%s`,
		sceneName, detail.TurnCount, detail.UserWordCount, detail.EnglishRatio*100,
		detail.WordsPerMinute, detail.ExplicitCorrections+detail.ImplicitCorrections,
		detail.ChineseTurnCount, transcript.String())

	apiKey := config.GlobalConfig.Services.LLM.APIKey
	baseURL := config.GlobalConfig.Services.LLM.BaseURL
	model := config.GlobalConfig.Services.LLM.Model
	if model == "" {
		model = "gpt-4o-mini"
	}
	provider, err := llm.NewLLMProvider(ctx, "openai", apiKey, baseURL, "你是专业的英语口语教练，输出简洁中文分析。")
	if err != nil {
		logger.Lg.Warn("scenario AI review: provider init failed", zap.Error(err))
		return ""
	}
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	text, err := provider.Query(prompt, model)
	if err != nil {
		logger.Lg.Warn("scenario AI review: query failed", zap.Error(err))
		return ""
	}
	return strings.TrimSpace(text)
}

func hasExplicitCorrection(s string) bool {
	return strings.Contains(s, "Better:") || strings.Contains(s, "✓ Better:")
}

func hasPronunciationHint(s string) bool {
	lower := strings.ToLower(s)
	return strings.Contains(s, "Pronunciation:") || strings.Contains(s, "🔊 Pronunciation:") || strings.Contains(lower, "pronunciation")
}

func hasImplicitCorrection(s string) bool {
	lower := strings.ToLower(s)
	patterns := []string{
		"you might mean", "did you mean", "instead of", "you meant",
		"looks like you meant", "try ", "i think you",
	}
	for _, p := range patterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

func countExplicitCorrections(turns []models.ScenarioDialogueTurn) int {
	n := 0
	for _, t := range turns {
		if t.Role == "assistant" && hasExplicitCorrection(t.Content) {
			n++
		}
	}
	return n
}

func countPronunciationHints(turns []models.ScenarioDialogueTurn) int {
	n := 0
	for _, t := range turns {
		if t.Role == "assistant" && hasPronunciationHint(t.Content) {
			n++
		}
	}
	return n
}

func countCJK(s string) int {
	n := 0
	for _, r := range s {
		if unicode.Is(unicode.Han, r) {
			n++
		}
	}
	return n
}

func tokenizeWords(s string) []string {
	return strings.Fields(s)
}

func isEnglishWord(w string) bool {
	for _, r := range w {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || r == '\'' {
			continue
		}
		return false
	}
	return len(w) > 0
}

func trimFirstSentence(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
