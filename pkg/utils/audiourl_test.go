package utils

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

func TestRewritePronunciationSlots(t *testing.T) {
	a := "https://cdn.example/a.mp3"
	b := "https://cdn.example/b.mp3"
	c := "https://cdn.example/c.mp3"
	canon0 := "https://cdn.example/keep0.mp3"
	canon1 := "https://cdn.example/keep1.mp3"

	got := RewritePronunciationSlots(a+";"+b+";"+c, canon0, canon1)
	want := canon0 + ";" + canon1
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
	got = RewritePronunciationSlots(a, canon0, canon1)
	want = canon0 + ";" + canon1
	if got != want {
		t.Fatalf("single slot: got %q want %q", got, want)
	}
	if RewritePronunciationSlots("", "", "") != "" {
		t.Fatal("empty")
	}
}

func TestDropThirdSlot(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"", ""},
		{"/a.mp3", "/a.mp3"},
		{"/a.mp3;/b.mp3", "/a.mp3;/b.mp3"},
		{"/a.mp3;/b.mp3;/c.mp3", "/a.mp3;/b.mp3"},
		{"/a.mp3;;/c.mp3", "/a.mp3"},
		{"/a.mp3;/b.mp3;/c.mp3;/d.mp3", "/a.mp3;/b.mp3"},
	}
	for _, tt := range tests {
		got := DropThirdSlot(tt.in)
		if got != tt.want {
			t.Errorf("DropThirdSlot(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestHasThirdSlot(t *testing.T) {
	if !HasThirdSlot("/a;/b;/c") {
		t.Fatal("expected third slot")
	}
	if HasThirdSlot("/a;/b") {
		t.Fatal("expected no third slot")
	}
	if HasThirdSlot("/a;;") {
		t.Fatal("empty third should not count")
	}
}
