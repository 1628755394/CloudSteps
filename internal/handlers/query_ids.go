package handlers

import (
	"strconv"
	"strings"
)

// parseQueryUintID 解析 query/path 中的无符号 ID（支持雪花 ID 字符串）。
func parseQueryUintID(raw string) uint {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0
	}
	n, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0
	}
	return uint(n)
}
