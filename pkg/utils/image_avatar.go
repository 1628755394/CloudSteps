package utils

import (
	"bytes"
	"fmt"
	"io"

	"github.com/LingByte/ling-base/common/imageutil"
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
// 底层使用 ling-base/common/imageutil。
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

	img, _, err := imageutil.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("无法解析图片，请上传 jpg/png/webp/gif")
	}

	w, h := imageutil.Dimensions(img)
	if w <= 0 || h <= 0 {
		return nil, fmt.Errorf("无效的图片尺寸")
	}
	if w > AvatarMaxSidePx || h > AvatarMaxSidePx {
		return nil, fmt.Errorf("图片尺寸过大（最长边不超过 %d 像素）", AvatarMaxSidePx)
	}

	data, err := imageutil.OptimizeForWeb(img, AvatarOutputSidePx, AvatarJPEGQuality)
	if err != nil {
		return nil, fmt.Errorf("图片压缩失败")
	}

	out, _, err := imageutil.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("图片压缩失败")
	}
	ow, oh := imageutil.Dimensions(out)

	return &AvatarProcessResult{
		Data:        data,
		ContentType: "image/jpeg",
		Ext:         ".jpg",
		Width:       ow,
		Height:      oh,
	}, nil
}
