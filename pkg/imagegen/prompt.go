package imagegen

import (
	"encoding/json"
	"fmt"
	"strings"
)

// parseCoverMetaFields holds the structured metadata parsed from a wordbook
// description JSON. The admin frontend uses these fields to fill the prompt
// template before submitting the final prompt to the backend.
type CoverMetaFields struct {
	Tag string `json:"tag"`
	T1  string `json:"t1"`
	T2  string `json:"t2"`
	Cat string `json:"cat"`
}

// ParseCoverMeta extracts structured metadata from a wordbook description.
// If the description is empty or not a JSON object, zero values are returned.
func ParseCoverMeta(description string) CoverMetaFields {
	raw := strings.TrimSpace(description)
	if raw == "" || !strings.HasPrefix(raw, "{") {
		return CoverMetaFields{}
	}
	var m CoverMetaFields
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return CoverMetaFields{}
	}
	m.Tag = strings.TrimSpace(m.Tag)
	m.T1 = strings.TrimSpace(m.T1)
	m.T2 = strings.TrimSpace(m.T2)
	m.Cat = strings.TrimSpace(m.Cat)
	return m
}

// BuildPrompt fills a prompt template with wordbook metadata.
// The template is provided by the admin frontend; the backend does not
// hold a default template. If template is empty, the function returns
// an empty string — the caller must ensure a non-empty prompt is submitted.
func BuildPrompt(template, name, level, description string) string {
	t := strings.TrimSpace(template)
	if t == "" {
		return ""
	}
	meta := ParseCoverMeta(description)
	extra := strings.TrimSpace(description)
	if extra != "" && strings.HasPrefix(extra, "{") {
		extra = ""
	}
	if extra != "" && len(extra) > 120 {
		extra = extra[:120] + "…"
	}
	name = strings.TrimSpace(name)
	level = strings.TrimSpace(level)
	if meta.T1 == "" && name != "" {
		meta.T1 = name
	}
	if meta.T2 == "" && name != "" && meta.T1 != name {
		meta.T2 = name
	}
	repl := strings.NewReplacer(
		"{{name}}", name,
		"{{level}}", level,
		"{{description}}", extra,
		"{{tag}}", meta.Tag,
		"{{t1}}", meta.T1,
		"{{t2}}", meta.T2,
		"{{cat}}", meta.Cat,
	)
	out := repl.Replace(t)
	if extra != "" && !strings.Contains(t, "{{description}}") {
		out = fmt.Sprintf("%s Context: %s.", strings.TrimSpace(out), extra)
	}
	return strings.TrimSpace(out)
}
