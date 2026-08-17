package audio

import "testing"

func TestDeduplicateSlots(t *testing.T) {
	base := "https://cdn.lingecho.com/audio/words/591f45825a6cb5084f958858dd0c240b6e23fa3ac409be09e82a0b8d232e313b"
	uk := base + "_uk.mp3"
	us := base + "_us.mp3"

	tests := []struct {
		in   string
		want string
	}{
		{"", ""},
		{uk, uk},
		{uk + ";" + us, uk},
		{uk + ";" + uk, uk},
		{"https://a.com/1.mp3;https://a.com/2.mp3", "https://a.com/1.mp3;https://a.com/2.mp3"},
		{"https://a.com/x.mp3;https://a.com/x.mp3;https://a.com/y.mp3", "https://a.com/x.mp3;;https://a.com/y.mp3"},
	}
	for _, tt := range tests {
		got := DeduplicateSlots(tt.in)
		if got != tt.want {
			t.Errorf("DeduplicateSlots(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}
