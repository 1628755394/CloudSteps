package imagegen

import "strings"

// DefaultCoverSize is the default landscape size for wordbook covers (not square).
const DefaultCoverSize = "1792x1024"

// CoverSizeOption is a selectable image generation size.
type CoverSizeOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// CoverSizeOptions lists landscape-oriented sizes (no square).
var CoverSizeOptions = []CoverSizeOption{
	{Value: "1792x1024", Label: "1792×1024（宽屏，推荐）"},
	{Value: "1536x1024", Label: "1536×1024（横屏）"},
	{Value: "1280x720", Label: "1280×720（横屏）"},
}

// NormalizeCoverSize returns a supported landscape size; empty or square → default.
func NormalizeCoverSize(size string) string {
	size = strings.TrimSpace(strings.ToLower(size))
	if size == "" || size == "1024x1024" {
		return DefaultCoverSize
	}
	for _, opt := range CoverSizeOptions {
		if strings.ToLower(opt.Value) == size {
			return opt.Value
		}
	}
	return DefaultCoverSize
}
