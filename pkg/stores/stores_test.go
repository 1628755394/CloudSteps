package stores

import (
	"testing"

	"github.com/LingByte/ling-base/common"
)

func TestBucketNameFor_localEmpty(t *testing.T) {
	if got := BucketNameFor(KindLocal); got != "" {
		t.Fatalf("local bucket = %q, want empty", got)
	}
}

func TestBucketNameFor_qiniuEnv(t *testing.T) {
	t.Setenv("QINIU_BUCKET", "ling-words")
	common.PurgeEnvCacheForTest()
	if got := BucketNameFor(KindQiNiu); got != "ling-words" {
		t.Fatalf("qiniu bucket = %q", got)
	}
}
