// Package stores is a CloudSteps-specific factory that wires
// ling-base/stores backends to CloudSteps environment variables.
//
// The actual Store implementations live in ling-base/stores/* submodules.
// This package reads the CloudSteps env-var convention (e.g. COS_SECRET_ID,
// OSS_ACCESS_KEY_ID, …) and constructs the corresponding ling-base Config,
// then returns a ling-base stores.Store.
package stores

import (
	"strings"

	"github.com/LingByte/ling-base/common"
	lbstores "github.com/LingByte/ling-base/stores"
	"github.com/LingByte/ling-base/stores/cos"
	"github.com/LingByte/ling-base/stores/kodo"
	"github.com/LingByte/ling-base/stores/ks3"
	"github.com/LingByte/ling-base/stores/local"
	"github.com/LingByte/ling-base/stores/minio"
	"github.com/LingByte/ling-base/stores/obs"
	"github.com/LingByte/ling-base/stores/oss"
	"github.com/LingByte/ling-base/stores/s3"
	"github.com/LingByte/ling-base/stores/tos"
)

// Store is re-exported from ling-base so existing callers don't need to
// change their import paths.
type Store = lbstores.Store

// Kind constants mirror the old CloudSteps pkg/stores kinds so callers
// that pass a kind string (e.g. from STORAGE_KIND) keep working.
const (
	KindLocal = "local"
	KindCos   = "cos"   // tencent
	KindMinio = "minio" // minio/s3 compatible
	KindQiNiu = "qiniu"
	KindOss   = "oss"
	KinsS3    = "s3"
	KindTos   = "tos" // volcengine
	KindObs   = "obs" // huawei cloud
	KindKs3   = "ks3" // kingsoft cloud
)

// ErrInvalidPath is re-exported from ling-base.
var ErrInvalidPath = lbstores.ErrInvalidPath

// DefaultStoreKind is resolved once at init time from STORAGE_KIND.
var DefaultStoreKind = getDefaultStoreKind()

func getDefaultStoreKind() string {
	kind := common.GetEnv("STORAGE_KIND")
	if kind == "" {
		return KindLocal
	}
	switch kind {
	case KindLocal, KindCos, KindMinio, KindQiNiu, KindOss, KinsS3, KindTos, KindObs, KindKs3:
		return kind
	default:
		return KindLocal
	}
}

// GetStore constructs a ling-base Store for the given kind, reading
// configuration from CloudSteps environment variables.
func GetStore(kind string) Store {
	switch kind {
	case KindCos:
		return cos.New(cos.Config{
			SecretID:   common.GetEnv("COS_SECRET_ID"),
			SecretKey:  common.GetEnv("COS_SECRET_KEY"),
			Region:     common.GetEnv("COS_REGION"),
			BucketName: common.GetEnv("COS_BUCKET_NAME"),
		})
	case KindMinio:
		return minio.New(minio.Config{
			Endpoint:  common.GetEnv("MINIO_ENDPOINT"),
			AccessKey: common.GetEnv("MINIO_ACCESS_KEY"),
			SecretKey: common.GetEnv("MINIO_SECRET_KEY"),
			Bucket:    common.GetEnv("MINIO_BUCKET"),
			UseSSL:    strings.EqualFold(strings.TrimSpace(common.GetEnv("MINIO_USE_SSL")), "true"),
			BaseURL:   common.GetEnv("MINIO_PUBLIC_BASE"),
		})
	case KindQiNiu:
		return kodo.New(kodo.Config{
			AccessKey:  common.GetEnv("QINIU_ACCESS_KEY"),
			SecretKey:  common.GetEnv("QINIU_SECRET_KEY"),
			BucketName: common.GetEnv("QINIU_BUCKET"),
			Domain:     common.GetEnv("QINIU_DOMAIN"),
			Private:    strings.EqualFold(common.GetEnv("QINIU_PRIVATE"), "true"),
			Region:     common.GetEnv("QINIU_REGION"),
		})
	case KindOss:
		return oss.New(oss.Config{
			AccessKeyID:     common.GetEnv("OSS_ACCESS_KEY_ID"),
			AccessKeySecret: common.GetEnv("OSS_ACCESS_KEY_SECRET"),
			Endpoint:        common.GetEnv("OSS_ENDPOINT"),
			BucketName:      common.GetEnv("OSS_BUCKET_NAME"),
		})
	case KinsS3:
		return s3.New(s3.Config{
			Region:          common.GetEnv("S3_REGION"),
			AccessKeyID:     common.GetEnv("S3_ACCESS_KEY_ID"),
			AccessKeySecret: common.GetEnv("S3_SECRET_ACCESS_KEY"),
			BucketName:      common.GetEnv("S3_BUCKET"),
			Endpoint:        common.GetEnv("S3_ENDPOINT"),
			UsePathStyle:    strings.EqualFold(strings.TrimSpace(common.GetEnv("S3_USE_PATH_STYLE")), "true"),
			Domain:          common.GetEnv("S3_DOMAIN"),
		})
	case KindTos:
		return tos.New(tos.Config{
			Endpoint:        common.GetEnv("TOS_ENDPOINT"),
			Region:          common.GetEnv("TOS_REGION"),
			AccessKeyID:     common.GetEnv("TOS_ACCESS_KEY_ID"),
			AccessKeySecret: common.GetEnv("TOS_SECRET_ACCESS_KEY"),
			BucketName:      common.GetEnv("TOS_BUCKET"),
			Domain:          common.GetEnv("TOS_DOMAIN"),
		})
	case KindObs:
		return obs.New(obs.Config{
			Endpoint:        common.GetEnv("OBS_ENDPOINT"),
			Region:          common.GetEnv("OBS_REGION"),
			AccessKeyID:     common.GetEnv("OBS_ACCESS_KEY_ID"),
			AccessKeySecret: common.GetEnv("OBS_SECRET_ACCESS_KEY"),
			BucketName:      common.GetEnv("OBS_BUCKET"),
			ProxyDomain:     strings.TrimSuffix(common.GetEnv("OBS_PROXY_DOMAIN"), "/"),
		})
	case KindKs3:
		return ks3.New(ks3.Config{
			Endpoint:        common.GetEnv("KS3_ENDPOINT"),
			Region:          common.GetEnv("KS3_REGION"),
			AccessKeyID:     common.GetEnv("KS3_ACCESS_KEY_ID"),
			AccessKeySecret: common.GetEnv("KS3_SECRET_ACCESS_KEY"),
			BucketName:      common.GetEnv("KS3_BUCKET"),
			Domain:          common.GetEnv("KS3_DOMAIN"),
		})
	default:
		return local.New(local.Config{
			Root:       common.GetEnv("UPLOAD_DIR"),
			NewDirPerm: 0755,
		})
	}
}

// Default returns a Store for DefaultStoreKind.
func Default() Store {
	return GetStore(DefaultStoreKind)
}
