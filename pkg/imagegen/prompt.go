package imagegen

import (
	"fmt"
	"strings"
)

// DefaultPromptTemplate is the admin-editable preset for wordbook covers.
const DefaultPromptTemplate = `Original flat illustration for an English vocabulary wordbook cover.
Book title theme: "{{name}}".
Level or exam category: "{{level}}".
Style: modern gradient, soft geometric shapes, education motif (book, lightbulb, globe), no text, no logos, no real publisher or textbook cover imitation, copyright-safe original artwork.
Mood: friendly, clean, suitable for a learning app thumbnail.`

// BuildPrompt fills the template with wordbook metadata.
func BuildPrompt(template, name, level, description string) string {
	t := strings.TrimSpace(template)
	if t == "" {
		t = DefaultPromptTemplate
	}
	extra := strings.TrimSpace(description)
	if extra != "" && len(extra) > 120 {
		extra = extra[:120] + "…"
	}
	repl := strings.NewReplacer(
		"{{name}}", strings.TrimSpace(name),
		"{{level}}", strings.TrimSpace(level),
		"{{description}}", extra,
	)
	out := repl.Replace(t)
	if extra != "" && !strings.Contains(t, "{{description}}") {
		out = fmt.Sprintf("%s Context: %s.", strings.TrimSpace(out), extra)
	}
	return strings.TrimSpace(out)
}
