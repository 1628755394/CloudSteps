package middlewares

import (
	lbmw "github.com/LingByte/ling-base/middleware"
	"github.com/gin-gonic/gin"
)

// WeChat 公众号服务器回调必须稳定返回明文 200，不能走熔断/超时包装。
func isWechatWebhookPath(path string) bool {
	return path == "/api/auth/wechat/mp/message"
}

// CircuitBreakerMiddleware 包装 ling-base 熔断器，微信回调路径跳过。
func CircuitBreakerMiddleware() gin.HandlerFunc {
	inner := lbmw.CircuitBreakerMiddleware()
	return func(c *gin.Context) {
		if isWechatWebhookPath(c.Request.URL.Path) {
			c.Next()
			return
		}
		inner(c)
	}
}

// CombinedTimeoutCircuitMiddleware 包装组合中间件，微信回调路径跳过。
func CombinedTimeoutCircuitMiddleware() gin.HandlerFunc {
	inner := lbmw.CombinedTimeoutCircuitMiddleware()
	return func(c *gin.Context) {
		if isWechatWebhookPath(c.Request.URL.Path) {
			c.Next()
			return
		}
		inner(c)
	}
}
