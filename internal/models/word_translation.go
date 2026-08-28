package models

import (
	"encoding/json"
	"regexp"
	"strings"
)

var (
	posLineRe = regexp.MustCompile(`^([a-zA-Z]+\.?)\s+(.+)$`)
	englishRe = regexp.MustCompile(`[a-zA-Z][a-zA-Z\s\-']*`)
	zhSplitRe = regexp.MustCompile(`[；;，,]`)
)

// FormatTranslationShort 从完整释义生成简译（与 web/src/utils/wordFormat.ts 一致）。
func FormatTranslationShort(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	items := parseTranslationItems(raw)
	if len(items) == 0 {
		return ""
	}

	parts := make([]string, 0, len(items))
	for _, item := range items {
		parts = append(parts, shortenTranslationItem(item))
	}
	return strings.Join(parts, "；")
}

func parseTranslationItems(raw string) []string {
	var arr []string
	if err := json.Unmarshal([]byte(raw), &arr); err == nil {
		out := make([]string, 0, len(arr))
		for _, x := range arr {
			s := strings.TrimSpace(x)
			if s != "" {
				out = append(out, s)
			}
		}
		if len(out) > 0 {
			return out
		}
	}
	return splitTranslationItems(raw)
}

func splitTranslationItems(raw string) []string {
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == '\n' || r == '；' || r == ';'
	})
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		s := strings.TrimSpace(p)
		if s != "" {
			out = append(out, s)
		}
	}
	if len(out) == 0 && strings.TrimSpace(raw) != "" {
		return []string{strings.TrimSpace(raw)}
	}
	return out
}

func shortenTranslationItem(item string) string {
	if m := posLineRe.FindStringSubmatch(item); len(m) == 3 {
		pos := strings.TrimSuffix(m[1], ".")
		rest := m[2]
		zh := englishRe.ReplaceAllString(rest, " ")
		zh = strings.ReplaceAll(zh, "，", "；")
		zh = strings.ReplaceAll(zh, ",", "；")
		zh = strings.ReplaceAll(zh, ";", "；")
		zh = strings.Join(strings.Fields(zh), " ")
		zh = strings.Trim(zh, "；")
		source := zh
		if source == "" {
			source = rest
		}
		first := firstZhSegment(source)
		return pos + ". " + first
	}
	return firstZhSegment(item)
}

func firstZhSegment(s string) string {
	parts := zhSplitRe.Split(s, -1)
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t != "" {
			return t
		}
	}
	return strings.TrimSpace(s)
}
