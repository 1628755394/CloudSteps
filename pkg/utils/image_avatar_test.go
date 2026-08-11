package utils

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func TestProcessAvatarImage_RejectsTooLargeDeclaredSize(t *testing.T) {
	_, err := ProcessAvatarImage(bytes.NewReader([]byte{0xff, 0xd8}), AvatarMaxUploadBytes+1)
	if err == nil {
		t.Fatal("expected error for oversized declared size")
	}
}

func TestProcessAvatarImage_CompressesSmallPNG(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 120, 80))
	for y := 0; y < 80; y++ {
		for x := 0; x < 120; x++ {
			img.Set(x, y, color.RGBA{R: 80, G: 180, B: 160, A: 255})
		}
	}
	var src bytes.Buffer
	if err := png.Encode(&src, img); err != nil {
		t.Fatal(err)
	}

	out, err := ProcessAvatarImage(&src, int64(src.Len()))
	if err != nil {
		t.Fatal(err)
	}
	if out.ContentType != "image/jpeg" || out.Ext != ".jpg" {
		t.Fatalf("expected jpeg output, got %s %s", out.ContentType, out.Ext)
	}
	if out.Width != 120 || out.Height != 80 {
		t.Fatalf("unexpected size %dx%d", out.Width, out.Height)
	}
	if len(out.Data) == 0 {
		t.Fatal("empty output")
	}
	// 应能再次解码
	if _, err := jpeg.Decode(bytes.NewReader(out.Data)); err != nil {
		t.Fatalf("output not valid jpeg: %v", err)
	}
}

func TestProcessAvatarImage_ResizesLargeImage(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 2000, 1000))
	var src bytes.Buffer
	if err := png.Encode(&src, img); err != nil {
		t.Fatal(err)
	}
	out, err := ProcessAvatarImage(&src, int64(src.Len()))
	if err != nil {
		t.Fatal(err)
	}
	if out.Width > AvatarOutputSidePx || out.Height > AvatarOutputSidePx {
		t.Fatalf("expected max side %d, got %dx%d", AvatarOutputSidePx, out.Width, out.Height)
	}
	if out.Width != AvatarOutputSidePx {
		t.Fatalf("expected width %d, got %d", AvatarOutputSidePx, out.Width)
	}
}

func TestProcessAvatarImage_RejectsHugeDimensions(t *testing.T) {
	// 构造超限尺寸：不真的创建 5000x5000 像素（太慢/占内存），用伪造不可行；
	// 这里用略超限的 4100 边长小图验证拒绝逻辑。
	side := AvatarMaxSidePx + 1
	img := image.NewRGBA(image.Rect(0, 0, side, 10))
	var src bytes.Buffer
	if err := png.Encode(&src, img); err != nil {
		t.Fatal(err)
	}
	_, err := ProcessAvatarImage(&src, int64(src.Len()))
	if err == nil {
		t.Fatal("expected dimension rejection")
	}
}
