package utils

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

// GetDeviceID generates a device ID from User-Agent and IP address.
func GetDeviceID(userAgent, ipAddress string) string {
	data := fmt.Sprintf("%s:%s", userAgent, ipAddress)
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", hash[:16])
}

// ParseUserAgent parses a User-Agent string and returns device type, os, and browser.
func ParseUserAgent(userAgent string) (deviceType, os, browser string) {
	ua := strings.ToLower(userAgent)

	// 检测设备类型
	if strings.Contains(ua, "mobile") || strings.Contains(ua, "android") || strings.Contains(ua, "iphone") {
		deviceType = "mobile"
	} else if strings.Contains(ua, "tablet") || strings.Contains(ua, "ipad") {
		deviceType = "tablet"
	} else {
		deviceType = "desktop"
	}

	// 检测操作系统
	if strings.Contains(ua, "windows") {
		os = "Windows"
	} else if strings.Contains(ua, "mac") || strings.Contains(ua, "darwin") {
		os = "macOS"
	} else if strings.Contains(ua, "linux") {
		os = "Linux"
	} else if strings.Contains(ua, "android") {
		os = "Android"
	} else if strings.Contains(ua, "ios") || strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad") {
		os = "iOS"
	} else {
		os = "Unknown"
	}

	// 检测浏览器
	if strings.Contains(ua, "chrome") && !strings.Contains(ua, "edg") {
		browser = "Chrome"
	} else if strings.Contains(ua, "firefox") {
		browser = "Firefox"
	} else if strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome") {
		browser = "Safari"
	} else if strings.Contains(ua, "edg") {
		browser = "Edge"
	} else if strings.Contains(ua, "opera") {
		browser = "Opera"
	} else {
		browser = "Unknown"
	}

	return deviceType, os, browser
}
