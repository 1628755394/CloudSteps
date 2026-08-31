package utils

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// JSONUint unmarshals JSON numbers or decimal strings (for JS snowflake IDs sent as strings).
type JSONUint uint

func (u *JSONUint) UnmarshalJSON(data []byte) error {
	if len(data) == 0 || string(data) == "null" {
		*u = 0
		return nil
	}
	var n uint64
	if err := json.Unmarshal(data, &n); err == nil {
		*u = JSONUint(n)
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	s = strings.TrimSpace(s)
	if s == "" {
		*u = 0
		return nil
	}
	parsed, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid uint json value %q: %w", s, err)
	}
	*u = JSONUint(parsed)
	return nil
}

func (u JSONUint) Uint() uint {
	return uint(u)
}
