package customwordbook

import "testing"

func TestParseManualText(t *testing.T) {
	got := ParseManualText("apple\nBanana\napple\n你好\n123\ngo-to\n")
	if len(got) != 3 {
		t.Fatalf("want 3 words, got %d: %+v", len(got), got)
	}
	if got[0].Word != "apple" || got[1].Word != "Banana" || got[2].Word != "go-to" {
		t.Fatalf("unexpected order/words: %+v", got)
	}
}

func TestParseManualTextWithTranslation(t *testing.T) {
	got := ParseManualText("apple 苹果\nbook\t书")
	if len(got) != 2 {
		t.Fatalf("want 2, got %+v", got)
	}
	if got[0].Translation != "苹果" {
		t.Fatalf("apple translation: %q", got[0].Translation)
	}
	if got[1].Translation != "书" {
		t.Fatalf("book translation: %q", got[1].Translation)
	}
}

func TestParseCSVBytes(t *testing.T) {
	data := []byte("word,translation,phonetic\napple,苹果,/ˈæpl/\nBanana,香蕉,\n")
	got, err := ParseCSVBytes(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2, got %+v", got)
	}
	if got[0].Phonetic != "/ˈæpl/" {
		t.Fatalf("phonetic: %q", got[0].Phonetic)
	}
}
