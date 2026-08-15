// Package utils - misc utilities.
// CloudSteps-specific helpers (RandText, SafeCall, StructAsMap, etc.) remain here.
package utils

import (
	"encoding/base64"
	"errors"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/logger"
	"go.uber.org/zap"
)

var letterRunes = []rune("0123456789abcdefghijklmnopqrstuvwxyz")
var numberRunes = []rune("0123456789")

func init() {
	rand.Seed(time.Now().UnixNano())
}

func randRunes(n int, source []rune) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = source[rand.Intn(len(source))]
	}
	return string(b)
}

func RandText(n int) string {
	return randRunes(n, letterRunes)
}

func RandNumberText(n int) string {
	return randRunes(n, numberRunes)
}

func RandString(n int) string {
	return randRunes(n, letterRunes)
}

func SafeCall(f func() error, failHandle func(error)) error {
	defer func() {
		if err := recover(); err != nil {
			if failHandle != nil {
				eo, ok := err.(error)
				if !ok {
					es, ok := err.(string)
					if ok {
						eo = errors.New(es)
					} else {
						eo = errors.New("unknown error type")
					}
				}
				failHandle(eo)
			} else {
				logger.Error("panic", zap.Any("error", err))
			}
		}
	}()
	return f()
}

func StructAsMap(form any, fields []string) (vals map[string]any) {
	vals = make(map[string]any)
	v := reflect.ValueOf(form)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return vals
	}
	for i := 0; i < len(fields); i++ {
		k := v.FieldByName(fields[i])
		if !k.IsValid() || k.IsZero() {
			continue
		}
		if k.Kind() == reflect.Ptr {
			if !k.IsNil() {
				vals[fields[i]] = k.Elem().Interface()
			}
		} else {
			vals[fields[i]] = k.Interface()
		}
	}
	return vals
}

// GenerateSecureToken generate a fixed-length secure token
func GenerateSecureToken(length int) (string, error) {
	token := make([]byte, length)
	if _, err := rand.Read(token); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(token), nil
}

// WriteFile write file
func WriteFile(filename string, data []byte) error {
	dir := filepath.Dir(filename)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	return nil
}

// ReadFile read file
func ReadFile(filename string) ([]byte, error) {
	return os.ReadFile(filename)
}

// RemoveEmoji 移除字符串中的 emoji 字符
func RemoveEmoji(text string) string {
	var result []rune
	for _, r := range text {
		if (r >= 0x1F300 && r <= 0x1F9FF) ||
			(r >= 0x1F600 && r <= 0x1F64F) ||
			(r >= 0x1F680 && r <= 0x1F6FF) ||
			(r >= 0x2600 && r <= 0x26FF) ||
			(r >= 0x2700 && r <= 0x27BF) ||
			(r >= 0xFE00 && r <= 0xFE0F) ||
			(r >= 0x1F900 && r <= 0x1F9FF) ||
			(r >= 0x1F1E0 && r <= 0x1F1FF) {
			continue
		}
		result = append(result, r)
	}
	return string(result)
}

// RemoveEmojiFromJSON 从 JSON 字符串中移除 emoji
func RemoveEmojiFromJSON(jsonStr string) string {
	re := regexp.MustCompile(`("(?:[^"\\]|\\.)*")`)
	result := re.ReplaceAllStringFunc(jsonStr, func(match string) string {
		if len(match) > 2 {
			content := match[1 : len(match)-1]
			cleaned := RemoveEmoji(content)
			return `"` + cleaned + `"`
		}
		return match
	})
	return result
}

// ComputeSampleByteCount calculates bytes per millisecond for given audio parameters
func ComputeSampleByteCount(rate, depth, chans int) int {
	return (rate * depth * chans) / 8000
}

// NormalizeFramePeriod validates and normalizes frame period duration
func NormalizeFramePeriod(d string) time.Duration {
	parsed, err := time.ParseDuration(d)
	if err != nil {
		return 20 * time.Millisecond
	}
	if parsed == 0 {
		return 20 * time.Millisecond
	}

	if parsed < 10*time.Millisecond {
		return 20 * time.Millisecond
	}
	if parsed > 300*time.Millisecond {
		return 20 * time.Millisecond
	}
	return parsed
}

// Ensure strconv import is used (getMachineID was removed, but other code may use strconv).
var _ = strconv.Atoi
