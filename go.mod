module github.com/LingByte/CloudStepsGo

go 1.26.2

require (
	github.com/LingByte/ling-base v0.18.0
	github.com/LingByte/ling-base/bootstrap v0.1.1
	github.com/LingByte/ling-base/cache v0.1.0
	github.com/LingByte/ling-base/captcha v0.2.3
	github.com/LingByte/ling-base/common v0.3.1
	github.com/LingByte/ling-base/common/config v0.1.1
	github.com/LingByte/ling-base/common/constants v0.1.1
	github.com/LingByte/ling-base/common/geoip v0.1.0
	github.com/LingByte/ling-base/common/imageutil v0.1.0
	github.com/LingByte/ling-base/common/logger v0.1.1
	github.com/LingByte/ling-base/common/random v0.1.0
	github.com/LingByte/ling-base/common/response/gin v0.1.1
	github.com/LingByte/ling-base/common/stats v0.3.0
	github.com/LingByte/ling-base/common/stats/gin v0.2.0
	github.com/LingByte/ling-base/common/stats/memory v0.3.0
	github.com/LingByte/ling-base/common/validate v0.1.0
	github.com/LingByte/ling-base/notification/email v0.1.0
	github.com/LingByte/ling-base/notification/inbox v0.1.0
	github.com/LingByte/ling-base/queue v0.1.0
	github.com/LingByte/ling-base/queue/memory v0.1.0
	github.com/LingByte/ling-base/relay v0.1.0
	github.com/LingByte/ling-base/stores v0.1.4
	github.com/LingByte/ling-base/stores/cos v0.1.4
	github.com/LingByte/ling-base/stores/kodo v0.1.5
	github.com/LingByte/ling-base/stores/ks3 v0.1.4
	github.com/LingByte/ling-base/stores/local v0.1.4
	github.com/LingByte/ling-base/stores/minio v0.1.4
	github.com/LingByte/ling-base/stores/obs v0.1.4
	github.com/LingByte/ling-base/stores/oss v0.1.4
	github.com/LingByte/ling-base/stores/s3 v0.1.4
	github.com/LingByte/ling-base/stores/tos v0.1.4
	github.com/LingByte/ling-base/voice/realtime v0.1.1
	github.com/LingByte/ling-base/voice/realtime/aliyunomni v0.1.1
	github.com/LingByte/ling-base/voice/realtime/volcdialogue v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/aliyun v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/aws v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/azure v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/baidu v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/coqui v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/elevenlabs v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/fishaudio v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/fishspeech v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/google v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/local v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/minimax v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/openai v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/qcloud v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/qiniu v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/volcengine v0.1.1
	github.com/LingByte/ling-base/voice/synthesizer/xunfei v0.1.1
	github.com/aws/aws-sdk-go-v2/service/polly v1.58.2
	github.com/gin-contrib/sessions v1.0.4
	github.com/gin-gonic/gin v1.12.0
	github.com/glebarez/sqlite v1.11.0
	github.com/gorilla/websocket v1.5.3
	github.com/mssola/user_agent v0.6.0
	github.com/robfig/cron/v3 v3.0.1
	github.com/stretchr/testify v1.12.0
	go.uber.org/zap v1.28.0
	golang.org/x/net v0.57.0
	gorm.io/driver/sqlite v1.6.0
	gorm.io/gorm v1.31.2
)

require (
	cloud.google.com/go v0.123.0 // indirect
	cloud.google.com/go/auth v0.23.0 // indirect
	cloud.google.com/go/auth/oauth2adapt v0.2.8 // indirect
	cloud.google.com/go/compute/metadata v0.9.0 // indirect
	cloud.google.com/go/longrunning v0.9.0 // indirect
	cloud.google.com/go/texttospeech v1.21.0 // indirect
	filippo.io/csrf v0.2.1 // indirect
	filippo.io/edwards25519 v1.1.0 // indirect
	github.com/BurntSushi/toml v1.6.0 // indirect
	github.com/LingByte/ling-base/common/circuitbreaker v0.1.0 // indirect
	github.com/LingByte/ling-base/common/idgen v0.1.0 // indirect
	github.com/LingByte/ling-base/common/logger/gin v0.1.0 // indirect
	github.com/LingByte/ling-base/common/pool v0.1.0 // indirect
	github.com/LingByte/ling-base/common/response v0.1.1 // indirect
	github.com/LingByte/ling-base/common/retry v0.1.0 // indirect
	github.com/LingByte/ling-base/constants v0.1.0 // indirect
	github.com/LingByte/ling-base/eventbus v0.1.0 // indirect
	github.com/LingByte/ling-base/eventbus/memory v0.1.0 // indirect
	github.com/LingByte/ling-base/notification v0.1.0 // indirect
	github.com/LingByte/ling-base/relay/relaykit v0.1.0 // indirect
	github.com/LingByte/ling-base/version v0.1.0 // indirect
	github.com/alex-ant/gomath v0.0.0-20160516115720-89013a210a82 // indirect
	github.com/alibabacloud-go/alibabacloud-gateway-spi v0.0.5 // indirect
	github.com/alibabacloud-go/cdn-20180510/v4 v4.3.0 // indirect
	github.com/alibabacloud-go/cms-20190101/v2 v2.0.3 // indirect
	github.com/alibabacloud-go/darabonba-openapi v0.2.1 // indirect
	github.com/alibabacloud-go/darabonba-openapi/v2 v2.2.4 // indirect
	github.com/alibabacloud-go/debug v1.0.1 // indirect
	github.com/alibabacloud-go/endpoint-util v1.1.0 // indirect
	github.com/alibabacloud-go/openapi-util v0.1.0 // indirect
	github.com/alibabacloud-go/tea v1.5.2 // indirect
	github.com/alibabacloud-go/tea-utils v1.4.3 // indirect
	github.com/alibabacloud-go/tea-utils/v2 v2.0.9 // indirect
	github.com/alibabacloud-go/tea-xml v1.1.3 // indirect
	github.com/aliyun/aliyun-oss-go-sdk v3.0.2+incompatible // indirect
	github.com/aliyun/credentials-go v1.4.5 // indirect
	github.com/aws/aws-sdk-go-v2 v1.43.6 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.18 // indirect
	github.com/aws/aws-sdk-go-v2/config v1.32.36 // indirect
	github.com/aws/aws-sdk-go-v2/credentials v1.19.35 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.36 // indirect
	github.com/aws/aws-sdk-go-v2/feature/s3/manager v1.22.41 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.37 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.37 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.4.37 // indirect
	github.com/aws/aws-sdk-go-v2/service/cloudwatch v1.66.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.16 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.9.28 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.36 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.19.36 // indirect
	github.com/aws/aws-sdk-go-v2/service/s3 v1.107.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/signin v1.5.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.33.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.38.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.45.5 // indirect
	github.com/aws/smithy-go v1.27.8 // indirect
	github.com/axiomhq/hyperloglog v0.2.3 // indirect
	github.com/br41n10/qiniu-stats-go-sdk v0.0.0-20240430141314-0ca6c82ce905 // indirect
	github.com/bytedance/gopkg v0.1.4 // indirect
	github.com/bytedance/sonic v1.15.0 // indirect
	github.com/bytedance/sonic/loader v0.5.0 // indirect
	github.com/carlmjohnson/requests v0.25.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/clbanning/mxj v1.8.4 // indirect
	github.com/clbanning/mxj/v2 v2.7.0 // indirect
	github.com/cloudwego/base64x v0.1.6 // indirect
	github.com/dgryski/go-metro v0.0.0-20180109044635-280f6062b5bc // indirect
	github.com/disintegration/imaging v1.6.2 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/emersion/go-imap/v2 v2.0.0-20251216103119-7ac47a9cfd9a // indirect
	github.com/emersion/go-message v0.18.2 // indirect
	github.com/emersion/go-sasl v0.0.0-20241020182733-b788ff22d5a6 // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/gabriel-vasile/mimetype v1.4.12 // indirect
	github.com/gin-contrib/sse v1.1.0 // indirect
	github.com/glebarez/go-sqlite v1.21.2 // indirect
	github.com/go-logr/logr v1.4.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.30.1 // indirect
	github.com/go-sql-driver/mysql v1.8.1 // indirect
	github.com/goccy/go-json v0.10.5 // indirect
	github.com/goccy/go-yaml v1.19.2 // indirect
	github.com/gofrs/flock v0.13.0 // indirect
	github.com/golang/freetype v0.0.0-20170609003504-e2365dfdc4a0 // indirect
	github.com/google/go-querystring v1.1.0 // indirect
	github.com/google/s2a-go v0.1.9 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.20 // indirect
	github.com/googleapis/gax-go/v2 v2.23.0 // indirect
	github.com/gorilla/context v1.1.2 // indirect
	github.com/gorilla/securecookie v1.1.2 // indirect
	github.com/gorilla/sessions v1.4.0 // indirect
	github.com/hashicorp/golang-lru/v2 v2.0.7 // indirect
	github.com/huaweicloud/huaweicloud-sdk-go-v3 v0.1.211 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.10.0 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	github.com/json-iterator/go v1.1.13-0.20220915233716-71ac16282d12 // indirect
	github.com/kamstrup/intmap v0.5.1 // indirect
	github.com/klauspost/compress v1.18.6 // indirect
	github.com/klauspost/cpuid/v2 v2.3.0 // indirect
	github.com/klauspost/crc32 v1.3.0 // indirect
	github.com/ks3sdklib/aws-sdk-go v1.12.0 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/mattn/go-isatty v0.0.22 // indirect
	github.com/mattn/go-sqlite3 v1.14.22 // indirect
	github.com/minio/crc64nvme v1.1.1 // indirect
	github.com/minio/md5-simd v1.1.2 // indirect
	github.com/minio/minio-go/v7 v7.2.1 // indirect
	github.com/mitchellh/mapstructure v1.5.0 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/mozillazg/go-httpheader v0.2.1 // indirect
	github.com/natefinch/lumberjack v2.0.0+incompatible // indirect
	github.com/pelletier/go-toml/v2 v2.3.1 // indirect
	github.com/philhofer/fwd v1.2.0 // indirect
	github.com/qiniu/go-sdk/v7 v7.27.0 // indirect
	github.com/quasoft/memstore v0.0.0-20191010062613-2bce066d2b0b // indirect
	github.com/quic-go/qpack v0.6.0 // indirect
	github.com/quic-go/quic-go v0.59.0 // indirect
	github.com/redis/go-redis/v9 v9.22.0 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/rs/xid v1.6.0 // indirect
	github.com/samber/lo v1.47.0 // indirect
	github.com/sirupsen/logrus v1.9.4 // indirect
	github.com/spf13/cast v1.10.0 // indirect
	github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/cdn v1.3.154 // indirect
	github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common v1.3.164 // indirect
	github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/monitor v1.3.164 // indirect
	github.com/tencentcloud/tencentcloud-speech-sdk-go v1.0.25 // indirect
	github.com/tencentyun/cos-go-sdk-v5 v0.7.75 // indirect
	github.com/tinylib/msgp v1.6.1 // indirect
	github.com/tjfoc/gmsm v1.4.1 // indirect
	github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
	github.com/ugorji/go/codec v1.3.1 // indirect
	github.com/volcengine/ve-tos-golang-sdk/v2 v2.9.8 // indirect
	github.com/volcengine/volc-sdk-golang v1.0.23 // indirect
	github.com/volcengine/volcengine-go-sdk v1.2.47 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	go.mongodb.org/mongo-driver v1.17.3 // indirect
	go.mongodb.org/mongo-driver/v2 v2.5.0 // indirect
	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.67.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.67.0 // indirect
	go.opentelemetry.io/otel v1.44.0 // indirect
	go.opentelemetry.io/otel/metric v1.44.0 // indirect
	go.opentelemetry.io/otel/trace v1.44.0 // indirect
	go.uber.org/atomic v1.11.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	go.yaml.in/yaml/v3 v3.0.4 // indirect
	golang.org/x/arch v0.22.0 // indirect
	golang.org/x/crypto v0.54.0 // indirect
	golang.org/x/image v0.45.0 // indirect
	golang.org/x/oauth2 v0.36.0 // indirect
	golang.org/x/sync v0.22.0 // indirect
	golang.org/x/sys v0.47.0 // indirect
	golang.org/x/text v0.41.0 // indirect
	golang.org/x/time v0.15.0 // indirect
	google.golang.org/api v0.293.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20260630182238-925bb5da69e7 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260807164820-c8921c73eeea // indirect
	google.golang.org/grpc v1.83.0 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
	gopkg.in/ini.v1 v1.67.2 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	gorm.io/driver/mysql v1.6.0 // indirect
	gorm.io/driver/postgres v1.6.2 // indirect
	modernc.org/fileutil v1.0.0 // indirect
	modernc.org/libc v1.22.5 // indirect
	modernc.org/mathutil v1.5.0 // indirect
	modernc.org/memory v1.5.0 // indirect
	modernc.org/sqlite v1.23.1 // indirect
)
