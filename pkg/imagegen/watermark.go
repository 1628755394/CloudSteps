package imagegen

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"strings"
	"sync"

	CloudSteps "github.com/LingByte/CloudStepsGo"
	"github.com/LingByte/ling-base/common/imageutil"
)

var (
	watermarkFontOnce  sync.Once
	watermarkFontReady bool
)

func initWatermarkFont() {
	watermarkFontOnce.Do(func() {
		if len(CloudSteps.EmbeddedWatermarkFont) == 0 {
			return
		}
		if err := imageutil.LoadFontBytes(CloudSteps.WatermarkFontName, CloudSteps.EmbeddedWatermarkFont); err != nil {
			return
		}
		watermarkFontReady = true
	})
}

func watermarkFont() string {
	initWatermarkFont()
	if watermarkFontReady {
		return CloudSteps.WatermarkFontName
	}
	return imageutil.FontGoRegular
}

func decodeLogo() (image.Image, error) {
	if len(CloudSteps.EmbeddedLogoPNG) == 0 {
		return nil, fmt.Errorf("embedded logo missing")
	}
	logo, _, err := imageutil.Decode(bytes.NewReader(CloudSteps.EmbeddedLogoPNG))
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
		Text:       CloudSteps.WatermarkText,
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
