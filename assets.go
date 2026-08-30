package CloudSteps

import (
	_ "embed"
)

// Email HTML bodies embedded for notification template seeds.

const WatermarkText = "解忧背词"

const WatermarkFontName = "cover-watermark-cn"

//go:embed static/email/welcome.html
var WelcomeHTML string

//go:embed static/email/verification.html
var VerificationHTML string

//go:embed static/email/group_invitation.html
var GroupInvitationHTML string

//go:embed static/email/email_verification.html
var EmailVerificationHTML string

//go:embed static/email/password_reset.html
var PasswordResetHTML string

//go:embed static/email/device_verification.html
var DeviceVerificationHTML string

//go:embed static/email/new_device_login.html
var NewDeviceLoginHTML string

//go:embed static/email/login.html
var LoginHTML string

//go:embed static/email/logout.html
var LogoutHTML string

//go:embed static/email/change_email.html
var ChangeEmailHTML string

//go:embed static/email/change_email_done.html
var ChangeEmailDoneHTML string

//go:embed static/logo.png
var EmbeddedLogoPNG []byte

//go:embed static/fonts/cover-watermark.ttf
var EmbeddedWatermarkFont []byte
