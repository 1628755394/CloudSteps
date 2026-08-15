// Package stores is a CloudSteps-specific factory that wires
// ling-base/stores backends to CloudSteps environment variables.
//
// The actual Store implementations (local, cos, oss, minio, kodo, s3,
// tos, obs, ks3) live in ling-base/stores/* submodules. This package
// reads the CloudSteps env-var convention and constructs the
// corresponding ling-base Config, then returns a ling-base stores.Store.
//
// Usage:
//
//	// Use default store (from STORAGE_KIND env var)
//	store := stores.Default()
//	r, size, err := store.Read("some-key")
//
//	// Or get a specific backend
//	store := stores.GetStore(stores.KindS3)
package stores
