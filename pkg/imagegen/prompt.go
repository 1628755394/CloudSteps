package imagegen

import (
	"encoding/json"
	"fmt"
	"strings"
)

// DefaultPromptTemplate is the admin-editable preset for wordbook covers.
const DefaultPromptTemplate = `Design an original English vocabulary wordbook cover thumbnail for a learning app.
The cover MUST include clear, readable text (Chinese and/or English) as the main focus:
- Top line (large): "{{t1}}"
- Bottom line (medium): "{{t2}}"
- Version or series tag (small badge): "{{tag}}"
- Category label: "{{cat}}" · CEFR level "{{level}}"
- Wordbook name reference: "{{name}}"
Layout: modern flat illustration, soft gradient background, subtle geometric shapes and education motifs (book, lightbulb, globe) around the typography — do not let decorations obscure the text.
Typography: bold, high contrast, legible at small thumbnail size; balanced composition like a clean app icon cover.
Do not imitate real publisher or textbook covers; no third-party logos; copyright-safe original artwork.
Mood: friendly, bright, professional.`

type coverMetaFields struct {
	Tag string `json:"tag"`
	T1  string `json:"t1"`
	T2  string `json:"t2"`
	Cat string `json:"cat"`
}

func parseCoverMeta(description string) coverMetaFields {
	raw := strings.TrimSpace(description)
	if raw == "" || !strings.HasPrefix(raw, "{") {
		return coverMetaFields{}
	}
	var m coverMetaFields
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return coverMetaFields{}
	}
	m.Tag = strings.TrimSpace(m.Tag)
	m.T1 = strings.TrimSpace(m.T1)
	m.T2 = strings.TrimSpace(m.T2)
	m.Cat = strings.TrimSpace(m.Cat)
	return m
}

// BuildPrompt fills the template with wordbook metadata.
func BuildPrompt(template, name, level, description string) string {
	t := strings.TrimSpace(template)
	if t == "" {
		t = DefaultPromptTemplate
	}
	meta := parseCoverMeta(description)
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
