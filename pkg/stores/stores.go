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

	"github.com/LingByte/CloudStepsGo/pkg/utils"
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
	kind := utils.GetEnv("STORAGE_KIND")
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
			SecretID:   utils.GetEnv("COS_SECRET_ID"),
			SecretKey:  utils.GetEnv("COS_SECRET_KEY"),
			Region:     utils.GetEnv("COS_REGION"),
			BucketName: utils.GetEnv("COS_BUCKET_NAME"),
		})
	case KindMinio:
		return minio.New(minio.Config{
			Endpoint:  utils.GetEnv("MINIO_ENDPOINT"),
			AccessKey: utils.GetEnv("MINIO_ACCESS_KEY"),
			SecretKey: utils.GetEnv("MINIO_SECRET_KEY"),
			Bucket:    utils.GetEnv("MINIO_BUCKET"),
			UseSSL:    strings.EqualFold(strings.TrimSpace(utils.GetEnv("MINIO_USE_SSL")), "true"),
			BaseURL:   utils.GetEnv("MINIO_PUBLIC_BASE"),
		})
	case KindQiNiu:
		return kodo.New(kodo.Config{
			AccessKey:  utils.GetEnv("QINIU_ACCESS_KEY"),
			SecretKey:  utils.GetEnv("QINIU_SECRET_KEY"),
			BucketName: utils.GetEnv("QINIU_BUCKET"),
			Domain:     utils.GetEnv("QINIU_DOMAIN"),
			Private:    strings.EqualFold(utils.GetEnv("QINIU_PRIVATE"), "true"),
			Region:     utils.GetEnv("QINIU_REGION"),
		})
	case KindOss:
		return oss.New(oss.Config{
			AccessKeyID:     utils.GetEnv("OSS_ACCESS_KEY_ID"),
			AccessKeySecret: utils.GetEnv("OSS_ACCESS_KEY_SECRET"),
			Endpoint:        utils.GetEnv("OSS_ENDPOINT"),
			BucketName:      utils.GetEnv("OSS_BUCKET_NAME"),
		})
	case KinsS3:
		return s3.New(s3.Config{
			Region:          utils.GetEnv("S3_REGION"),
			AccessKeyID:     utils.GetEnv("S3_ACCESS_KEY_ID"),
			AccessKeySecret: utils.GetEnv("S3_SECRET_ACCESS_KEY"),
			BucketName:      utils.GetEnv("S3_BUCKET"),
			Endpoint:        utils.GetEnv("S3_ENDPOINT"),
			UsePathStyle:    strings.EqualFold(strings.TrimSpace(utils.GetEnv("S3_USE_PATH_STYLE")), "true"),
			Domain:          utils.GetEnv("S3_DOMAIN"),
		})
	case KindTos:
		return tos.New(tos.Config{
			Endpoint:        utils.GetEnv("TOS_ENDPOINT"),
			Region:          utils.GetEnv("TOS_REGION"),
			AccessKeyID:     utils.GetEnv("TOS_ACCESS_KEY_ID"),
			AccessKeySecret: utils.GetEnv("TOS_SECRET_ACCESS_KEY"),
			BucketName:      utils.GetEnv("TOS_BUCKET"),
			Domain:          utils.GetEnv("TOS_DOMAIN"),
		})
	case KindObs:
		return obs.New(obs.Config{
			Endpoint:        utils.GetEnv("OBS_ENDPOINT"),
			Region:          utils.GetEnv("OBS_REGION"),
			AccessKeyID:     utils.GetEnv("OBS_ACCESS_KEY_ID"),
			AccessKeySecret: utils.GetEnv("OBS_SECRET_ACCESS_KEY"),
			BucketName:      utils.GetEnv("OBS_BUCKET"),
			ProxyDomain:     strings.TrimSuffix(utils.GetEnv("OBS_PROXY_DOMAIN"), "/"),
		})
	case KindKs3:
		return ks3.New(ks3.Config{
			Endpoint:        utils.GetEnv("KS3_ENDPOINT"),
			Region:          utils.GetEnv("KS3_REGION"),
			AccessKeyID:     utils.GetEnv("KS3_ACCESS_KEY_ID"),
			AccessKeySecret: utils.GetEnv("KS3_SECRET_ACCESS_KEY"),
			BucketName:      utils.GetEnv("KS3_BUCKET"),
			Domain:          utils.GetEnv("KS3_DOMAIN"),
		})
	default:
		return local.New(local.Config{
			Root:       utils.GetEnv("UPLOAD_DIR"),
			NewDirPerm: 0755,
		})
	}
}

// Default returns a Store for DefaultStoreKind.
func Default() Store {
	return GetStore(DefaultStoreKind)
}
