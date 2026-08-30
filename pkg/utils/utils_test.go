package utils

import (
	"encoding/base64"
	"os"
	"reflect"
	"strings"
	"testing"
)

// ---------- randRunes / RandText / RandNumberText / RandString ----------

func TestRandRunesAndFriends(t *testing.T) {
	// Basic length assertion
	if got := RandText(16); len(got) != 16 {
		t.Fatalf("RandText length = %d, want 16", len(got))
	}
	if got := RandNumberText(8); len(got) != 8 {
		t.Fatalf("RandNumberText length = %d, want 8", len(got))
	}
	if got := RandString(12); len(got) != 12 {
		t.Fatalf("RandString length = %d, want 12", len(got))
	}

	// Number string should only contain digits
	num := RandNumberText(64)
	for i, c := range num {
		if c < '0' || c > '9' {
			t.Fatalf("RandNumberText contains non-digit at %d: %q", i, c)
		}
	}
}

// ---------- SafeCall ----------

func TestSafeCall_NoPanic(t *testing.T) {
	called := false
	err := SafeCall(func() error {
		called = true
		return nil
	}, func(error) {})
	if err != nil {
		t.Fatalf("SafeCall returned error: %v", err)
	}
	if !called {
		t.Fatalf("SafeCall did not call f()")
	}
}

func TestSafeCall_PanicError(t *testing.T) {
	var handled error
	_ = SafeCall(func() error {
		panic(assertErr("boom"))
	}, func(e error) {
		handled = e
	})
	if handled == nil || handled.Error() != "boom" {
		t.Fatalf("SafeCall did not handle error panic, got: %v", handled)
	}
}

func TestSafeCall_PanicString(t *testing.T) {
	var handled error
	_ = SafeCall(func() error {
		panic("oops")
	}, func(e error) {
		handled = e
	})
	if handled == nil || handled.Error() != "oops" {
		t.Fatalf("SafeCall did not convert string panic, got: %v", handled)
	}
}

func TestSafeCall_PanicUnknownType(t *testing.T) {
	var handled error
	_ = SafeCall(func() error {
		panic(struct{ X int }{X: 1})
	}, func(e error) {
		handled = e
	})
	if handled == nil || handled.Error() != "unknown error type" {
		t.Fatalf("SafeCall unknown-type panic => %v, want 'unknown error type'", handled)
	}
}

// Used to quickly construct types that implement error
type assertErr string

func (e assertErr) Error() string { return string(e) }

// ---------- StructAsMap ----------

func TestStructAsMap(t *testing.T) {
	type inner struct {
		A int
	}
	type demo struct {
		Name    string
		Age     int
		NotePtr *string
		InPtr   *inner
		ZeroStr string
		ZeroInt int
	}

	note := "hello"
	in := &inner{A: 7}

	// Non-struct
	if m := StructAsMap(123, []string{"X"}); len(m) != 0 {
		t.Fatalf("StructAsMap(non-struct) = %#v, want empty", m)
	}

	// Struct and pointer fields
	d := demo{
		Name:    "tom",
		Age:     18,
		NotePtr: &note,
		InPtr:   in,
	}
	// Select only some fields, including zero-value fields and non-existent fields
	fields := []string{"Name", "Age", "NotePtr", "InPtr", "ZeroStr", "ZeroInt", "NoSuch"}
	got := StructAsMap(d, fields)

	// Expected: zero-value and non-existent fields do not appear; pointer fields are dereferenced
	want := map[string]any{
		"Name":    "tom",
		"Age":     18,
		"NotePtr": "hello",
		"InPtr":   inner{A: 7},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("StructAsMap got %#v, want %#v", got, want)
	}

	// Pass in pointer struct
	got2 := StructAsMap(&d, []string{"Name"})
	if got2["Name"] != "tom" || len(got2) != 1 {
		t.Fatalf("StructAsMap(ptr) = %#v", got2)
	}
}

// ---------- GenerateSecureToken ----------

func TestGenerateSecureToken_URLSafeLength(t *testing.T) {
	for _, n := range []int{1, 2, 3, 4, 16, 31, 32, 33, 64} {
		tok, err := GenerateSecureToken(n)
		if err != nil {
			t.Fatalf("GenerateSecureToken(%d) error: %v", n, err)
		}
		// base64.URLEncoding length check
		wantLen := base64.URLEncoding.EncodedLen(n)
		if len(tok) != wantLen {
			t.Fatalf("token len = %d, want %d (n=%d)", len(tok), wantLen, n)
		}
		// URL-safe characters (no '+' '/')
		if strings.ContainsAny(tok, "+/") {
			t.Fatalf("token contains non-URL-safe characters: %q", tok)
		}
	}
}

// Note: Snowflake tests have been removed because the Snowflake implementation
// is now owned by ling-base/common/idgen. ling-base's own test suite covers
// the Snowflake algorithm.

// ---------- WriteFile / ReadFile ----------

func TestWriteFileAndReadFile(t *testing.T) {
	// Create temporary directory and filename
	tmpDir := os.TempDir()
	testFile := tmpDir + "/test_write_file.txt"
	testContent := []byte("Hello, World!")

	// Test writing to file
	err := WriteFile(testFile, testContent)
	if err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}

	// Test reading file
	content, err := ReadFile(testFile)
	if err != nil {
		t.Fatalf("ReadFile error: %v", err)
	}

	// Verify content
	if string(content) != string(testContent) {
		t.Fatalf("ReadFile content = %s, want %s", string(content), string(testContent))
	}

	// Clean up test file
	_ = os.Remove(testFile)
}

func TestWriteFileWithNestedPath(t *testing.T) {
	// Create nested directory path
	tmpDir := os.TempDir()
	nestedDir := tmpDir + "/test_nested_dir"
	testFile := nestedDir + "/nested/test_write_file.txt"
	testContent := []byte("Nested directory content")

	// Test writing to nested path file
	err := WriteFile(testFile, testContent)
	if err != nil {
		t.Fatalf("WriteFile with nested path error: %v", err)
	}

	// Test reading file
	content, err := ReadFile(testFile)
	if err != nil {
		t.Fatalf("ReadFile error: %v", err)
	}

	// Verify content
	if string(content) != string(testContent) {
		t.Fatalf("ReadFile content = %s, want %s", string(content), string(testContent))
	}

	// Clean up test file and directory
	_ = os.RemoveAll(nestedDir)
}

func TestReadFileNotExists(t *testing.T) {
	// Attempt to read non-existent file
	_, err := ReadFile("/path/does/not/exist.txt")
	if err == nil {
		t.Fatalf("ReadFile expected error for non-existent file")
	}
}

// ---------- RandText charset ----------

func TestRandTextCharset(t *testing.T) {
	result := RandText(10)
	if len(result) != 10 {
		t.Fatalf("RandText length = %d, want 10", len(result))
	}
	for _, r := range result {
		if (r < '0' || r > '9') && (r < 'a' || r > 'z') {
			t.Fatalf("RandText contains invalid character: %c", r)
		}
	}

	result = RandNumberText(5)
	if len(result) != 5 {
		t.Fatalf("RandNumberText length = %d, want 5", len(result))
	}
	for _, r := range result {
		if r < '0' || r > '9' {
			t.Fatalf("RandNumberText contains non-digit character: %c", r)
		}
	}

	if got := RandText(0); got != "" {
		t.Fatalf("RandText(0) = %q, want empty string", got)
	}
}
