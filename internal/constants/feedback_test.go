package constants

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFeedbackSignals(t *testing.T) {
	assert.Equal(t, "feedback.admin_replied", SigFeedbackAdminReplied)
}
