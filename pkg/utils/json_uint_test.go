package utils

import (
	"encoding/json"
	"testing"
)

func TestJSONUint_UnmarshalJSON(t *testing.T) {
	t.Parallel()

	var u JSONUint
	if err := json.Unmarshal([]byte(`1458589157183980032`), &u); err != nil {
		t.Fatalf("number: %v", err)
	}
	if u.Uint() != 1458589157183980032 {
		t.Fatalf("number got %d", u.Uint())
	}

	u = 0
	if err := json.Unmarshal([]byte(`"1458589157183980032"`), &u); err != nil {
		t.Fatalf("string: %v", err)
	}
	if u.Uint() != 1458589157183980032 {
		t.Fatalf("string got %d", u.Uint())
	}
}
