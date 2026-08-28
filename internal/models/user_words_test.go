package models

import "testing"

func TestNormalizeUserWordFields(t *testing.T) {
	if _, err := NormalizeUserWordFields(UserWordFields{}); err != ErrUserWordEmpty {
		t.Fatalf("empty: got %v", err)
	}
	got, err := NormalizeUserWordFields(UserWordFields{
		Word:        "  apple  ",
		Translation: "  苹果  ",
		Notes:       "  拼写不对  ",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Word != "apple" || got.Translation != "苹果" || got.Notes != "拼写不对" {
		t.Fatalf("got %+v", got)
	}
	tooLong := make([]rune, UserWordWordMaxRunes+1)
	for i := range tooLong {
		tooLong[i] = 'a'
	}
	if _, err := NormalizeUserWordFields(UserWordFields{Word: string(tooLong)}); err != ErrUserWordTooLong {
		t.Fatalf("too long: got %v", err)
	}
}

func TestUserWordApplyAndCanonicalUpdates(t *testing.T) {
	ow := UserWord{
		Word:            "colour",
		PhoneticUK:      "/ˈkʌlə/",
		Translation:     "颜色",
		ExampleSentence: "What colour is it?",
	}
	w := Word{Word: "color", Phonetic: "/ˈkʌlər/", Translation: "色彩", Definition: "a hue"}
	ow.ApplyToWord(&w)
	if w.Word != "colour" || w.Translation != "颜色" || w.Definition != "a hue" || !w.Overridden {
		t.Fatalf("word %+v", w)
	}
	if w.ExampleSentence != "What colour is it?" {
		t.Fatalf("example %q", w.ExampleSentence)
	}
	lite := WordLite{Word: "color", Translation: "色彩", Definition: "a hue"}
	ow.ApplyToLite(&lite)
	if lite.Word != "colour" || lite.Translation != "颜色" || lite.Definition != "a hue" || !lite.Overridden {
		t.Fatalf("lite %+v", lite)
	}
	upd := ow.CanonicalUpdates()
	if upd["word"] != "colour" || upd["phonetic_uk"] != "/ˈkʌlə/" || upd["translation"] != "颜色" {
		t.Fatalf("updates %+v", upd)
	}
	if _, ok := upd["definition"]; ok {
		t.Fatal("empty definition should not be copied")
	}
}
