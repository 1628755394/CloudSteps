package utils

import "strings"

// WordAudioSlotCount 词库单词音频槽位数：0=单词一遍，1=单词三遍（连读）。
const WordAudioSlotCount = 2

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

func SplitSlots(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	return strings.Split(raw, ";")
}

// ThirdSlotURL returns slot index 2 (legacy 英+中), or "" if absent.
func ThirdSlotURL(raw string) string {
	parts := SplitSlots(raw)
	if len(parts) < 3 {
		return ""
	}
	return strings.TrimSpace(parts[2])
}

// HasThirdSlot reports whether slot 2 has non-empty content.
func HasThirdSlot(raw string) bool {
	return ThirdSlotURL(raw) != ""
}

// DropThirdSlot keeps slots 0–1 and removes slot 2 onward.
func DropThirdSlot(raw string) string {
	parts := SplitSlots(raw)
	if len(parts) <= WordAudioSlotCount {
		return trimTrailingEmptySlots(parts)
	}
	return trimTrailingEmptySlots(parts[:WordAudioSlotCount])
}

func trimTrailingEmptySlots(parts []string) string {
	for len(parts) > 0 && strings.TrimSpace(parts[len(parts)-1]) == "" {
		parts = parts[:len(parts)-1]
	}
	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, ";")
}

// RewritePronunciationSlots replaces slots 0 and 1 (word / triple-word TTS)
// with shared URLs. Slots from index 2 onward are dropped.
func RewritePronunciationSlots(raw, slot0, slot1 string) string {
	parts := SplitSlots(raw)
	slot0 = strings.TrimSpace(slot0)
	slot1 = strings.TrimSpace(slot1)
	if slot0 != "" {
		if len(parts) == 0 {
			parts = []string{slot0}
		} else {
			parts[0] = slot0
		}
	}
	if slot1 != "" {
		for len(parts) < 2 {
			parts = append(parts, "")
		}
		parts[1] = slot1
	}
	if len(parts) > WordAudioSlotCount {
		parts = parts[:WordAudioSlotCount]
	}
	return trimTrailingEmptySlots(parts)
}
