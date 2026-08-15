package tts

import (
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// EncodeWAV 将 PCM16LE mono 编码为完整 WAV 字节。
func EncodeWAV(pcm []byte, sampleRate int) ([]byte, error) {
	if len(pcm) == 0 {
		return nil, errors.New("PCM 数据为空")
	}
	if sampleRate <= 0 {
		sampleRate = DefaultSampleRate
	}
	dataLen := uint32(len(pcm))
	byteRate := uint32(sampleRate) * 2
	totalLen := 36 + dataLen

	buf := make([]byte, 0, 44+len(pcm))
	w := &binaryWriter{b: buf}
	w.bytes([]byte("RIFF"))
	w.u32(totalLen)
	w.bytes([]byte("WAVE"))
	w.bytes([]byte("fmt "))
	w.u32(16)
	w.u16(1) // PCM
	w.u16(1) // mono
	w.u32(uint32(sampleRate))
	w.u32(byteRate)
	w.u16(2)
	w.u16(16)
	w.bytes([]byte("data"))
	w.u32(dataLen)
	w.bytes(pcm)
	return w.b, nil
}

type binaryWriter struct{ b []byte }

func (w *binaryWriter) bytes(p []byte) { w.b = append(w.b, p...) }
func (w *binaryWriter) u16(v uint16) {
	var tmp [2]byte
	binary.LittleEndian.PutUint16(tmp[:], v)
	w.b = append(w.b, tmp[:]...)
}
func (w *binaryWriter) u32(v uint32) {
	var tmp [4]byte
	binary.LittleEndian.PutUint32(tmp[:], v)
	w.b = append(w.b, tmp[:]...)
}

// WriteAudioFile 根据后缀写出 .pcm / .wav / .mp3（mp3 需系统 ffmpeg）。
func WriteAudioFile(path string, pcm []byte, sampleRate int) error {
	if len(pcm) == 0 {
		return errors.New("PCM 数据为空")
	}
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".pcm":
		return os.WriteFile(path, pcm, 0o644)
	case ".wav":
		wav, err := EncodeWAV(pcm, sampleRate)
		if err != nil {
			return err
		}
		return os.WriteFile(path, wav, 0o644)
	case ".mp3":
		return writeMP3ViaFFmpeg(path, pcm, sampleRate)
	default:
		return fmt.Errorf("不支持的输出格式 %q（支持 .pcm/.wav/.mp3）", ext)
	}
}

func writeMP3ViaFFmpeg(path string, pcm []byte, sampleRate int) error {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return fmt.Errorf("未找到 ffmpeg，请先安装（brew install ffmpeg）：%w", err)
	}
	tmpWAV, err := os.CreateTemp("", "tts-*.wav")
	if err != nil {
		return err
	}
	tmpWAVPath := tmpWAV.Name()
	_ = tmpWAV.Close()
	defer os.Remove(tmpWAVPath)

	wav, err := EncodeWAV(pcm, sampleRate)
	if err != nil {
		return err
	}
	if err := os.WriteFile(tmpWAVPath, wav, 0o644); err != nil {
		return fmt.Errorf("写临时 wav: %w", err)
	}
	cmd := exec.Command("ffmpeg", "-y", "-i", tmpWAVPath, "-codec:a", "libmp3lame", "-b:a", "64k", path)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg 转码: %w", err)
	}
	return nil
}

// SanitizeFilename 将文本转为安全文件名片段。
func SanitizeFilename(s string, maxLen int) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "tts"
	}
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9',
			r >= 0x4e00 && r <= 0x9fff:
			b.WriteRune(r)
		case r == ' ' || r == '-':
			b.WriteRune('_')
		default:
			b.WriteRune('_')
		}
	}
	out := strings.Trim(b.String(), "_")
	if out == "" {
		out = "tts"
	}
	if maxLen > 0 && len([]rune(out)) > maxLen {
		out = string([]rune(out)[:maxLen])
	}
	return out
}
