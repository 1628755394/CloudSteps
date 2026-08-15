// Copyright (c) 2026 LingByte
// SPDX-License-Identifier: MIT

package stores

import (
	"time"

	lbstores "github.com/LingByte/ling-base/stores"
)

// Re-export the private-upload helpers from ling-base so existing
// CloudSteps callers keep working without changing imports.

// TTL bounds for signed URLs / direct-upload credentials.
const (
	DefaultSignedURLTTL    = lbstores.DefaultSignedURLTTL
	DefaultDirectUploadTTL = lbstores.DefaultDirectUploadTTL
	MaxPresignTTL          = lbstores.MaxPresignTTL
)

// ErrDirectUploadUnsupported is re-exported from ling-base.
var ErrDirectUploadUnsupported = lbstores.ErrDirectUploadUnsupported

// PrivateURLSigner is re-exported from ling-base.
type PrivateURLSigner = lbstores.PrivateURLSigner

// DirectUploadPresigner is re-exported from ling-base.
type DirectUploadPresigner = lbstores.DirectUploadPresigner

// DirectUpload is re-exported from ling-base.
type DirectUpload = lbstores.DirectUpload

// SignedURL returns an expiring access URL for key.
func SignedURL(s Store, key string, expires time.Duration) (string, error) {
	return lbstores.SignedURL(s, key, expires)
}

// PresignUpload issues client direct-upload credentials for key.
func PresignUpload(s Store, key, contentType string, expires time.Duration) (*DirectUpload, error) {
	return lbstores.PresignUpload(s, key, contentType, expires)
}
