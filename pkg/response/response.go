// Package response is a CloudSteps-specific thin wrapper over
// ling-base/common/response/gin that preserves the CloudSteps call
// signatures so the 485+ existing callers don't need to change.
//
// All functions delegate to ling-base's gin helpers. Error responses
// return HTTP 200 with the business code in the JSON envelope's "code"
// field, matching the CloudSteps convention.
package response

import (
	lbgin "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
)

// Response is re-exported from ling-base for callers that reference it.
type Response = struct {
	Code    int    `json:"code"`
	Message string `json:"msg"`
	Data    any    `json:"data"`
}

// Success writes a 200 success envelope with a custom message.
// CloudSteps signature: Success(c, msg, data) — maps to gin.SuccessMsg.
func Success(c *gin.Context, msg string, data interface{}) {
	if msg == "" {
		lbgin.Success(c, data)
		return
	}
	lbgin.SuccessMsg(c, msg, data)
}

// Fail writes an error envelope with a direct message. HTTP status is
// 200; the business code (500) is in the JSON envelope.
func Fail(c *gin.Context, msg string, data interface{}) {
	lbgin.Fail(c, msg, data)
}

// Result writes a response with a custom HTTP status, business code,
// message, and data. This is a CloudSteps-specific helper not present
// in ling-base; it writes the envelope directly.
func Result(c *gin.Context, httpStatus int, code int, msg string, data gin.H) {
	c.JSON(httpStatus, gin.H{
		"code": code,
		"msg":  msg,
		"data": data,
	})
}

// AbortWithStatus aborts with a bare HTTP status (no JSON body).
func AbortWithStatus(c *gin.Context, httpStatus int) {
	c.AbortWithStatus(httpStatus)
}

// AbortWithStatusJSON aborts with an error envelope derived from the
// HTTP status and error. HTTP status is 200; the business code is in
// the JSON envelope.
func AbortWithStatusJSON(c *gin.Context, httpStatus int, err error) {
	lbgin.AbortWithStatusJSON(c, httpStatus, err)
}
