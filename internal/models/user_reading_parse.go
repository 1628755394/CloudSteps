package models

import (
	"fmt"
	"regexp"
	"strings"
)

// ParsedUserReadingPassage 文本/JSON 导入用的阅读理解结构
type ParsedUserReadingPassage struct {
	Title            string
	Level            string
	Summary          string
	Content          string
	EstimatedMinutes int
	Questions        []ParsedUserReadingQuestion
}

type ParsedUserReadingQuestion struct {
	Stem        string
	Options     []map[string]string
	Answer      string
	Explanation string
	SortOrder   int
}

const passageDelimiter = "===PASSAGE==="

var (
	reQuestionBlock = regexp.MustCompile(`(?i)\[QUESTION\s*(\d+)\]`)
	reFieldLine     = regexp.MustCompile(`(?i)^([\p{L}]+)\s*[:：]\s*(.*)$`)
)

// ParseUserReadingText 解析自定义阅读理解文本。
// 格式见 web 导入页模板；多篇以 ===PASSAGE=== 分隔。
func ParseUserReadingText(raw string) ([]ParsedUserReadingPassage, error) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return nil, fmt.Errorf("empty text")
	}

	blocks := strings.Split(text, passageDelimiter)
	out := make([]ParsedUserReadingPassage, 0, len(blocks))
	for _, block := range blocks {
		block = strings.TrimSpace(block)
		if block == "" {
			continue
		}
		p, err := parseOneUserReadingBlock(block)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no valid passage found")
	}
	return out, nil
}

func parseOneUserReadingBlock(block string) (ParsedUserReadingPassage, error) {
	// 分离正文区与题目区
	mainPart := block
	questionsPart := ""
	if idx := strings.Index(strings.ToUpper(block), "[QUESTIONS]"); idx >= 0 {
		mainPart = strings.TrimSpace(block[:idx])
		questionsPart = strings.TrimSpace(block[idx+len("[QUESTIONS]"):])
	} else if loc := reQuestionBlock.FindStringIndex(block); loc != nil {
		mainPart = strings.TrimSpace(block[:loc[0]])
		questionsPart = strings.TrimSpace(block[loc[0]:])
	}

	meta := map[string]string{}
	contentLines := []string{}
	inContent := false
	for _, line := range strings.Split(mainPart, "\n") {
		trimmed := strings.TrimSpace(line)
		if inContent {
			contentLines = append(contentLines, line)
			continue
		}
		if m := reFieldLine.FindStringSubmatch(trimmed); len(m) == 3 {
			key := strings.ToLower(strings.TrimSpace(m[1]))
			val := strings.TrimSpace(m[2])
			switch key {
			case "title", "标题":
				meta["title"] = val
			case "level", "难度", "等级":
				meta["level"] = val
			case "summary", "摘要":
				meta["summary"] = val
			case "content", "正文":
				inContent = true
				if val != "" {
					contentLines = append(contentLines, val)
				}
			default:
				contentLines = append(contentLines, line)
			}
			continue
		}
		if strings.EqualFold(trimmed, "Content:") || trimmed == "正文:" || trimmed == "正文：" {
			inContent = true
			continue
		}
		if trimmed != "" && meta["title"] != "" {
			contentLines = append(contentLines, line)
		}
	}

	title := meta["title"]
	if title == "" {
		return ParsedUserReadingPassage{}, fmt.Errorf("passage title is required")
	}
	content := strings.TrimSpace(strings.Join(contentLines, "\n"))
	if content == "" {
		return ParsedUserReadingPassage{}, fmt.Errorf("passage %q: content is required", title)
	}

	level := meta["level"]
	if level == "" {
		level = "初阶"
	}

	questions, err := parseUserReadingQuestions(questionsPart)
	if err != nil {
		return ParsedUserReadingPassage{}, fmt.Errorf("passage %q: %w", title, err)
	}
	if len(questions) == 0 {
		return ParsedUserReadingPassage{}, fmt.Errorf("passage %q: at least one question required", title)
	}

	return ParsedUserReadingPassage{
		Title:     title,
		Level:     level,
		Summary:   meta["summary"],
		Content:   content,
		Questions: questions,
	}, nil
}

func parseUserReadingQuestions(part string) ([]ParsedUserReadingQuestion, error) {
	part = strings.TrimSpace(part)
	if part == "" {
		return nil, fmt.Errorf("questions section is empty")
	}

	blocks := reQuestionBlock.Split(part, -1)
	indexes := reQuestionBlock.FindAllStringSubmatch(part, -1)
	if len(indexes) == 0 {
		// 单题无 [QUESTION N] 标记
		q, err := parseOneUserReadingQuestion(part, 1)
		if err != nil {
			return nil, err
		}
		return []ParsedUserReadingQuestion{q}, nil
	}

	questions := make([]ParsedUserReadingQuestion, 0, len(indexes))
	for i, idxMatch := range indexes {
		body := ""
		if i+1 < len(blocks) {
			body = strings.TrimSpace(blocks[i+1])
		}
		sort := i + 1
		if len(idxMatch) > 1 {
			fmt.Sscanf(idxMatch[1], "%d", &sort)
		}
		q, err := parseOneUserReadingQuestion(body, sort)
		if err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}
	return questions, nil
}

func parseOneUserReadingQuestion(body string, sort int) (ParsedUserReadingQuestion, error) {
	stem := ""
	answer := ""
	explanation := ""
	opts := map[string]string{}

	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if m := reFieldLine.FindStringSubmatch(trimmed); len(m) == 3 {
			key := strings.ToLower(strings.TrimSpace(m[1]))
			val := strings.TrimSpace(m[2])
			switch key {
			case "stem", "题干", "question":
				stem = val
			case "answer", "答案":
				answer = strings.ToUpper(val)
			case "explanation", "解析":
				explanation = val
			}
			continue
		}
		if len(trimmed) >= 3 && trimmed[1] == ':' {
			key := strings.ToUpper(string(trimmed[0]))
			if key >= "A" && key <= "D" {
				opts[key] = strings.TrimSpace(trimmed[2:])
				continue
			}
		}
		if len([]rune(trimmed)) >= 2 && (trimmed[1] == '.' || strings.HasPrefix(trimmed, "A、") || strings.HasPrefix(trimmed, "B、") || strings.HasPrefix(trimmed, "C、") || strings.HasPrefix(trimmed, "D、")) {
			key := strings.ToUpper(string(trimmed[0]))
			if key >= "A" && key <= "D" {
				text := trimmed
				if idx := strings.IndexAny(trimmed, ".:"); idx >= 0 {
					text = strings.TrimSpace(trimmed[idx+1:])
				} else if len(trimmed) > 2 {
					text = strings.TrimSpace(trimmed[2:])
				}
				opts[key] = text
				continue
			}
		}
		if stem == "" && !strings.HasPrefix(strings.ToLower(trimmed), "answer") {
			stem = trimmed
		}
	}

	if stem == "" {
		return ParsedUserReadingQuestion{}, fmt.Errorf("question %d: stem is required", sort)
	}
	if len(opts) < 2 {
		return ParsedUserReadingQuestion{}, fmt.Errorf("question %d: at least 2 options required", sort)
	}
	if answer == "" {
		return ParsedUserReadingQuestion{}, fmt.Errorf("question %d: answer is required", sort)
	}
	if _, ok := opts[answer]; !ok {
		return ParsedUserReadingQuestion{}, fmt.Errorf("question %d: answer %s not in options", sort, answer)
	}

	ordered := make([]map[string]string, 0, 4)
	for _, k := range []string{"A", "B", "C", "D"} {
		if t, ok := opts[k]; ok {
			ordered = append(ordered, map[string]string{"key": k, "text": t})
		}
	}

	return ParsedUserReadingQuestion{
		Stem:        stem,
		Options:     ordered,
		Answer:      answer,
		Explanation: explanation,
		SortOrder:   sort,
	}, nil
}
