package models

import "testing"

func TestFormatTranslationShort(t *testing.T) {
	raw := `["adj. incorrect 不正确的；有误的", "n. mistake 错误；过失"]`
	got := FormatTranslationShort(raw)
	want := "adj. 不正确的；n. 错误"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestFormatTranslationShortPlain(t *testing.T) {
	got := FormatTranslationShort("苹果；梨")
	if got != "苹果；梨" {
		t.Fatalf("got %q", got)
	}
}
