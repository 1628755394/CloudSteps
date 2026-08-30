package constants

import (
	"testing"

	lbconstants "github.com/LingByte/ling-base/common/constants"
	"github.com/stretchr/testify/assert"
)

func TestConstants(t *testing.T) {
	// Test session related constants
	assert.Equal(t, "SESSION_FIELD", ENV_SESSION_FIELD, "ENV_SESSION_FIELD should be 'SESSION_FIELD'")
	assert.Equal(t, "SESSION_SECRET", ENV_SESSION_SECRET, "ENV_SESSION_SECRET should be 'SESSION_SECRET'")

	// Test context field constants
	assert.Equal(t, lbconstants.DbField, "_ling_db", "DbField should match ling-base common/constants.DbField")
	assert.Equal(t, "_CloudStepsGo_uid", UserField, "UserField should be '_CloudStepsGo_uid'")
	assert.Equal(t, "_CloudStepsGo_gid", GroupField, "GroupField should be '_CloudStepsGo_gid'")
	assert.Equal(t, "_CloudStepsGo_tz", TzField, "TzField should be '_CloudStepsGo_tz'")

	// Test key related constants
	assert.Equal(t, "VERIFY_EMAIL_EXPIRED", KEY_VERIFY_EMAIL_EXPIRED, "KEY_VERIFY_EMAIL_EXPIRED should be 'VERIFY_EMAIL_EXPIRED'")
	assert.Equal(t, "AUTH_TOKEN_EXPIRED", KEY_AUTH_TOKEN_EXPIRED, "KEY_AUTH_TOKEN_EXPIRED should be 'AUTH_TOKEN_EXPIRED'")
	assert.Equal(t, "SITE_NAME", KEY_SITE_NAME, "KEY_SITE_NAME should be 'SITE_NAME'")
	assert.Equal(t, "SITE_ADMIN", KEY_SITE_ADMIN, "KEY_SITE_ADMIN should be 'SITE_ADMIN'")
	assert.Equal(t, "SITE_URL", KEY_SITE_URL, "KEY_SITE_URL should be 'SITE_URL'")
	assert.Equal(t, "SITE_KEYWORDS", KEY_SITE_KEYWORDS, "KEY_SITE_KEYWORDS should be 'SITE_KEYWORDS'")
	assert.Equal(t, "SITE_DESCRIPTION", KEY_SITE_DESCRIPTION, "KEY_SITE_DESCRIPTION should be 'SITE_DESCRIPTION'")
	assert.Equal(t, "SITE_GA", KEY_SITE_GA, "KEY_SITE_GA should be 'SITE_GA'")

	// Test site URL related constants
	assert.Equal(t, "SITE_LOGO_URL", KEY_SITE_LOGO_URL, "KEY_SITE_LOGO_URL should be 'SITE_LOGO_URL'")
	assert.Equal(t, "SITE_FAVICON_URL", KEY_SITE_FAVICON_URL, "KEY_SITE_FAVICON_URL should be 'SITE_FAVICON_URL'")
	assert.Equal(t, "SITE_TERMS_URL", KEY_SITE_TERMS_URL, "KEY_SITE_TERMS_URL should be 'SITE_TERMS_URL'")
	assert.Equal(t, "SITE_PRIVACY_URL", KEY_SITE_PRIVACY_URL, "KEY_SITE_PRIVACY_URL should be 'SITE_PRIVACY_URL'")
	assert.Equal(t, "USER_ACTIVATED", KEY_USER_ACTIVATED, "KEY_USER_ACTIVATED should be 'USER_ACTIVATED'")
}
