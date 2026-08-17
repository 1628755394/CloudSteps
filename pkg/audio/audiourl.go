package audio

import "strings"

// DedupKey 用于判断两段音频是否为同一资源（完全相同的 URL，或 ddjdc 同 hash 的 _uk/_us）。
func DedupKey(raw string) string {
	u := strings.TrimSpace(raw)
	if u == "" {
		return ""
	}
	lower := strings.ToLower(u)
	if i := strings.Index(lower, "?"); i >= 0 {
		lower = lower[:i]
	}
	for _, suffix := range []string{"_uk.mp3", "_us.mp3", "_uk.wav", "_us.wav", "_uk.m4a", "_us.m4a"} {
		if strings.HasSuffix(lower, suffix) {
			return lower[:len(lower)-len(suffix)]
		}
	}
	return lower
}

// DeduplicateSlots 保留分号槽位，去掉重复 URL（保留首次出现）。
// 末尾空槽会裁掉；中间空槽保留（TTS 第 2/3 段）。
func DeduplicateSlots(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parts := strings.Split(raw, ";")
	seen := make(map[string]struct{})
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t == "" {
			out = append(out, "")
			continue
		}
		key := DedupKey(t)
		if _, ok := seen[key]; ok {
			out = append(out, "")
			continue
		}
		seen[key] = struct{}{}
		out = append(out, t)
	}
	for len(out) > 0 && strings.TrimSpace(out[len(out)-1]) == "" {
		out = out[:len(out)-1]
	}
	return strings.Join(out, ";")
}
