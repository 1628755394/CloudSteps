// Copyright (c) 2026 LingByte. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0

package stores

import (
	"net/url"
	"strings"
)

// RecordingObjectKeyFromURL extracts an object-store key from a stored
// recording_url (public URL, /uploads/... path, or bare key).
// Returns "" when the value cannot be mapped to a deletable key.
func RecordingObjectKeyFromURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	// Bare object key (recordings/{tenant}/{date}/{file}).
	if strings.HasPrefix(raw, "recordings/") {
		return strings.TrimPrefix(raw, "/")
	}
	// Local uploads relative path.
	if i := strings.Index(raw, "/uploads/"); i >= 0 {
		return strings.TrimPrefix(raw[i+len("/uploads/"):], "/")
	}
	if i := strings.Index(raw, "uploads/"); i >= 0 {
		return strings.TrimPrefix(raw[i+len("uploads/"):], "/")
	}
	// Absolute http(s) URL — take path after host and strip uploads prefix.
	if strings.HasPrefix(strings.ToLower(raw), "http://") || strings.HasPrefix(strings.ToLower(raw), "https://") {
		u, err := url.Parse(raw)
		if err != nil || u.Path == "" {
			return ""
		}
		path := strings.TrimPrefix(u.Path, "/")
		if i := strings.Index(path, "recordings/"); i >= 0 {
			return path[i:]
		}
		if i := strings.Index(path, "uploads/"); i >= 0 {
			return strings.TrimPrefix(path[i+len("uploads/"):], "/")
		}
		// CDN may serve the object key as the full path.
		if strings.Contains(path, "/") && !strings.Contains(path, "..") {
			return path
		}
		return ""
	}
	// Relative path without scheme.
	if !strings.HasPrefix(raw, "/") && !strings.Contains(raw, "://") {
		return strings.TrimPrefix(raw, "./")
	}
	return ""
}

// DeleteRecordingURL removes a recording from the default object store (or
// local file for data/ paths). Best-effort: returns nil when URL is empty.
func DeleteRecordingURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	if key := RecordingObjectKeyFromURL(raw); key != "" {
		return Default().Delete(key)
	}
	return nil
}
