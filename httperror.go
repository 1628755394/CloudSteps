package CloudSteps

import (
	"fmt"
	"log"
	"runtime"
	"strings"

	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
)

// ErrorWithCode is an error that can override the HTTP status code.
type ErrorWithCode interface {
	StatusCode() int
}

// AbortWithJSONError records the error and aborts with a JSON error body.
func AbortWithJSONError(c *gin.Context, code int, err error) {
	errWithFileNum := err
	if log.Flags()&(log.Lshortfile|log.Llongfile) != 0 {
		_, file, line, ok := runtime.Caller(1)
		if !ok {
			file = "???"
			line = 0
		}
		pos := strings.LastIndex(file, "/")
		if log.Flags()&log.Lshortfile != 0 && pos >= 0 {
			file = file[1+pos:]
		}
		errWithFileNum = fmt.Errorf("%s:%d: %v", file, line, err)
	}
	_ = c.Error(errWithFileNum)

	if e, ok := err.(ErrorWithCode); ok {
		code = e.StatusCode()
	}

	if c.IsAborted() {
		c.JSON(code, gin.H{"error": err.Error()})
		response.Fail(c, err.Error(), nil)
		return
	}
	response.AbortWithStatusJSON(c, code, err)
}
