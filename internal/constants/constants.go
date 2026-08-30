package constants

const (
	USER_TABLE_NAME             = "users"
	USER_DEVICE_TABLE_NAME      = "user_devices"
	LOGIN_HISTORY_TABLE_NAME    = "login_histories"
	ACCOUNT_LOCK_TABLE_NAME     = "account_locks"
	CALL_RECORDING_TABLE_NAME   = "call_recordings"
	DEVICE_ERROR_LOG_TABLE_NAME = "device_error_logs"
	SYS_METRIC_TABLE_NAME       = "sys_metrics"
)

// DefaultUploadDir 本地存储默认上传目录
const DefaultUploadDir = "./data/uploads"

// Default Value: 1024
const ENV_CONFIG_CACHE_SIZE = "CONFIG_CACHE_SIZE"

// Default Value: 10s
const ENV_CONFIG_CACHE_EXPIRED = "CONFIG_CACHE_EXPIRED"

// Gin session field name
const ENV_SESSION_FIELD = "SESSION_FIELD"

// Session
const ENV_SESSION_SECRET = "SESSION_SECRET"
const ENV_SESSION_EXPIRE_DAYS = "SESSION_EXPIRE_DAYS"

// DB
const ENV_DB_DRIVER = "DB_DRIVER"
const ENV_DSN = "DSN"

const ConfigField = "_CloudStepsGo_config"
const UserField = "_CloudStepsGo_uid"
const GroupField = "_CloudStepsGo_gid"
const TzField = "_CloudStepsGo_tz"

const KEY_VERIFY_EMAIL_EXPIRED = "VERIFY_EMAIL_EXPIRED"
const KEY_AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
const KEY_SITE_NAME = "SITE_NAME"
const KEY_SITE_ADMIN = "SITE_ADMIN"
const KEY_SITE_URL = "SITE_URL"
const KEY_SITE_KEYWORDS = "SITE_KEYWORDS"
const KEY_SITE_DESCRIPTION = "SITE_DESCRIPTION"
const KEY_SITE_GA = "SITE_GA"
const KEY_SITE_LOGO_URL = "SITE_LOGO_URL"
const KEY_SITE_FAVICON_URL = "SITE_FAVICON_URL"
const KEY_SITE_TERMS_URL = "SITE_TERMS_URL"
const KEY_SITE_PRIVACY_URL = "SITE_PRIVACY_URL"
const KEY_USER_ACTIVATED = "USER_ACTIVATED"
const AUTHORIZATION_PREFIX = "Bearer "

const SigInitSystemConfig = "system.init"
