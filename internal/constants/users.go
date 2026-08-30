package constants

import (
	"time"
)

// 缓存键前缀
const (
	CacheKeyUserByID    = "user:id:"
	CacheKeyUserByEmail = "user:email:"
)

// UserCacheExpiration 用户缓存过期时间
const UserCacheExpiration = 10 * time.Minute
