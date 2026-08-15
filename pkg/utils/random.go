// Package utils - random string utilities re-exported from ling-base/common/random.
// The original implementation has been moved to github.com/LingByte/ling-base/common/random.
package utils

import "github.com/LingByte/ling-base/common/random"

// GenerateRandomString generates a random base64-URL-safe string of the given length.
// Delegated to ling-base's random.Base64URLString.
func GenerateRandomString(length int) string {
	return random.Base64URLString(length)
}
