// Copyright (c) 2026 LingByte. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0

package stores

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/LingByte/ling-base/common"
)

const maxMediaReadBytes = 8 << 20 // 8MB

// ReadMediaURL loads bytes for a stored media URL, object key, or /uploads path.
func ReadMediaURL(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("empty media url")
	}

	key := RecordingObjectKeyFromURL(raw)
	if key != "" {
		rc, _, err := Default().Read(key)
		if err == nil {
			defer rc.Close()
			data, readErr := io.ReadAll(io.LimitReader(rc, maxMediaReadBytes+1))
			if readErr != nil {
				return nil, readErr
			}
			if len(data) > maxMediaReadBytes {
				return nil, fmt.Errorf("media exceeds %d bytes", maxMediaReadBytes)
			}
			return data, nil
		}
	}

	abs := absoluteMediaURL(raw)
	if abs == "" {
		return nil, fmt.Errorf("cannot resolve media url")
	}
	lower := strings.ToLower(abs)
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		return nil, fmt.Errorf("cannot resolve media url")
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(abs)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("http %d fetching media", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxMediaReadBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxMediaReadBytes {
		return nil, fmt.Errorf("media exceeds %d bytes", maxMediaReadBytes)
	}
	return data, nil
}

func absoluteMediaURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	lower := strings.ToLower(raw)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return raw
	}
	if strings.HasPrefix(raw, "/") {
		base := strings.TrimRight(common.GetEnv("SERVER_URL"), "/")
		if base == "" {
			base = "http://127.0.0.1:7080"
		}
		return base + raw
	}
	pub := strings.TrimSpace(Default().PublicURL(raw))
	if pub == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(pub), "http://") || strings.HasPrefix(strings.ToLower(pub), "https://") {
		return pub
	}
	if strings.HasPrefix(pub, "/") {
		base := strings.TrimRight(common.GetEnv("SERVER_URL"), "/")
		if base == "" {
			base = "http://127.0.0.1:7080"
		}
		return base + pub
	}
	return pub
}
