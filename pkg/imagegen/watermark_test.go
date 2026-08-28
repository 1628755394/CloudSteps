package imagegen_test

import (
	"bytes"
	"image"
	"image/color"
	"testing"

	"github.com/LingByte/CloudStepsGo/pkg/imagegen"
	"github.com/LingByte/ling-base/common/imageutil"
)

func TestApplyCoverWatermark(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 200, 120))
	for y := 0; y < 120; y++ {
		for x := 0; x < 200; x++ {
			src.Set(x, y, color.RGBA{40, 120, 200, 255})
		}
	}
	var in bytes.Buffer
	if err := imageutil.Encode(&in, src, imageutil.FormatPNG, 0); err != nil {
		t.Fatal(err)
	}

	out, ext, err := imagegen.ApplyCoverWatermark(in.Bytes(), ".png")
	if err != nil {
		t.Fatal(err)
	}
	if len(out) <= len(in.Bytes()) {
		t.Fatalf("expected watermarked output, got %d bytes ext=%s", len(out), ext)
	}
}
