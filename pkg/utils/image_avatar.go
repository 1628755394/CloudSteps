package utils

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	// AvatarMaxUploadBytes 原始上传上限（未处理前）
	AvatarMaxUploadBytes = 5 << 20 // 5MB
	// AvatarMaxSidePx 任一边超过此像素则拒绝（防超大图占内存）
	AvatarMaxSidePx = 4096
	// AvatarOutputSidePx 输出最长边
	AvatarOutputSidePx = 512
	// AvatarJPEGQuality 统一降质后的 JPEG 质量
	AvatarJPEGQuality = 75
)

// AvatarProcessResult 压缩后的头像数据
type AvatarProcessResult struct {
	Data        []byte
	ContentType string // image/jpeg
	Ext         string // .jpg
	Width       int
	Height      int
}

// ProcessAvatarImage 校验并压缩头像：拒绝过大文件/尺寸，统一缩放并以 JPEG 降质。
// 即使小图也会重新编码以降画质。
func ProcessAvatarImage(r io.Reader, declaredSize int64) (*AvatarProcessResult, error) {
	if declaredSize > AvatarMaxUploadBytes {
		return nil, fmt.Errorf("图片过大，请选择不超过 %dMB 的图片", AvatarMaxUploadBytes>>20)
	}

	limited := io.LimitReader(r, AvatarMaxUploadBytes+1)
	raw, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("读取图片失败")
	}
	if int64(len(raw)) > AvatarMaxUploadBytes {
		return nil, fmt.Errorf("图片过大，请选择不超过 %dMB 的图片", AvatarMaxUploadBytes>>20)
	}
	if len(raw) == 0 {
		return nil, fmt.Errorf("空文件")
	}

	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("无法解析图片，请上传 jpg/png/webp/gif")
	}

	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= 0 || h <= 0 {
		return nil, fmt.Errorf("无效的图片尺寸")
	}
	if w > AvatarMaxSidePx || h > AvatarMaxSidePx {
		return nil, fmt.Errorf("图片尺寸过大（最长边不超过 %d 像素）", AvatarMaxSidePx)
	}

	out := resizeToMaxSide(img, AvatarOutputSidePx)
	ob := out.Bounds()

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, out, &jpeg.Options{Quality: AvatarJPEGQuality}); err != nil {
		return nil, fmt.Errorf("图片压缩失败")
	}

	return &AvatarProcessResult{
		Data:        buf.Bytes(),
		ContentType: "image/jpeg",
		Ext:         ".jpg",
		Width:       ob.Dx(),
		Height:      ob.Dy(),
	}, nil
}

func resizeToMaxSide(src image.Image, maxSide int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	nw, nh := w, h
	if w > maxSide || h > maxSide {
		scale := float64(maxSide) / float64(w)
		if h > w {
			scale = float64(maxSide) / float64(h)
		}
		nw = int(float64(w)*scale + 0.5)
		nh = int(float64(h)*scale + 0.5)
		if nw < 1 {
			nw = 1
		}
		if nh < 1 {
			nh = 1
		}
	}

	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	// 白底，避免透明 PNG 转 JPEG 变黑
	draw.Draw(dst, dst.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	if nw == w && nh == h {
		draw.Draw(dst, dst.Bounds(), src, b.Min, draw.Over)
		return dst
	}
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst
}
