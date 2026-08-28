package imagegen

import (
	"bytes"
	_ "embed"
	"fmt"
	"image"
	"image/color"
	"os"
	"strings"
	"sync"

	"github.com/LingByte/ling-base/common/imageutil"
)

//go:embed embed/logo.png
var embeddedLogoPNG []byte

const watermarkText = "解忧背词"
const watermarkFontName = "cover-watermark-cn"

var (
	watermarkFontOnce sync.Once
	watermarkFontReady bool
)

func initWatermarkFont() {
	watermarkFontOnce.Do(func() {
		candidates := []string{
			strings.TrimSpace(os.Getenv("COVER_WATERMARK_FONT")),
			"/System/Library/Fonts/PingFang.ttc",
			"/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
			"/Library/Fonts/Arial Unicode.ttf",
			"/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
			"/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
		}
		for _, path := range candidates {
			if path == "" {
				continue
			}
			lower := strings.ToLower(path)
			var err error
			if strings.HasSuffix(lower, ".ttc") {
				err = imageutil.LoadFontTTC(watermarkFontName, path, 0)
			} else {
				err = imageutil.LoadFont(watermarkFontName, path)
			}
			if err == nil {
				watermarkFontReady = true
				return
			}
		}
	})
}

func watermarkFont() string {
	initWatermarkFont()
	if watermarkFontReady {
		return watermarkFontName
	}
	return imageutil.FontGoRegular
}

func decodeLogo() (image.Image, error) {
	if len(embeddedLogoPNG) == 0 {
		return nil, fmt.Errorf("embedded logo missing")
	}
	logo, _, err := imageutil.Decode(bytes.NewReader(embeddedLogoPNG))
	return logo, err
}

// ApplyCoverWatermark overlays logo + brand text at bottom-right (ling-base/imageutil).
func ApplyCoverWatermark(imageData []byte, extHint string) ([]byte, string, error) {
	if len(imageData) == 0 {
		return nil, extHint, fmt.Errorf("empty image")
	}
	base, format, err := imageutil.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, extHint, fmt.Errorf("decode cover: %w", err)
	}
	logo, err := decodeLogo()
	if err != nil {
		return nil, extHint, err
	}

	out := imageutil.CompositeWatermarkBottomRight(base, imageutil.CompositeWatermarkOptions{
		Logo:       logo,
		Text:       watermarkText,
		Font:       watermarkFont(),
		FontSize:   15,
		TextColor:  color.White,
		Opacity:    0.82,
		Layout:     imageutil.LayoutLogoLeftTextRight,
		Spacing:    6,
		Padding:    10,
		LogoHeight: 22,
	})

	outFormat := format
	outExt := extHint
	if outExt == "" {
		outExt = ".png"
	}
	switch strings.ToLower(strings.TrimPrefix(outExt, ".")) {
	case "jpg", "jpeg":
		outFormat = imageutil.FormatJPEG
		outExt = ".jpg"
	default:
		outFormat = imageutil.FormatPNG
		outExt = ".png"
	}

	var buf bytes.Buffer
	quality := 92
	if outFormat == imageutil.FormatJPEG {
		if err := imageutil.Encode(&buf, out, outFormat, quality); err != nil {
			return nil, extHint, err
		}
	} else {
		if err := imageutil.Encode(&buf, out, outFormat, 0); err != nil {
			return nil, extHint, err
		}
	}
	return buf.Bytes(), outExt, nil
}
