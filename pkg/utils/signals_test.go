package utils

import (
	"testing"

	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/stretchr/testify/assert"
)

func TestSignal(t *testing.T) {
	var val string
	var eid uint
	eid = Sig().Connect("mock_test", func(sender any, params ...any) {
		val = sender.(string)
		Sig().Disconnect("mock_test", eid)
	})
	Sig().Emit("mock_test", "unittest")
	assert.Equal(t, val, "unittest")
	Sig().Clear("mock_test", constants.SigUserResetPassword, constants.SigUserVerifyEmail)
}
