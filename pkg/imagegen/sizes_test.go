package imagegen_test

import (
	"testing"

	"github.com/LingByte/CloudStepsGo/pkg/imagegen"
)

func TestNormalizeCoverSize(t *testing.T) {
	if got := imagegen.NormalizeCoverSize(""); got != imagegen.DefaultCoverSize {
		t.Fatalf("empty: got %s", got)
	}
	if got := imagegen.NormalizeCoverSize("1024x1024"); got != imagegen.DefaultCoverSize {
		t.Fatalf("square: got %s", got)
	}
	if got := imagegen.NormalizeCoverSize("1280x720"); got != "1280x720" {
		t.Fatalf("1280x720: got %s", got)
	}
	if got := imagegen.NormalizeCoverSize("invalid"); got != imagegen.DefaultCoverSize {
		t.Fatalf("invalid: got %s", got)
	}
}
