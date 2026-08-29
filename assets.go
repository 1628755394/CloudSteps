package CloudSteps

import (
	_ "embed"
)

// Email HTML bodies embedded for notification template seeds.
// SPA auth pages are served by web/admin/miniapp — not by the API server.

//go:embed templates/email/welcome.html
var WelcomeHTML string

//go:embed templates/email/verification.html
var VerificationHTML string

//go:embed templates/email/group_invitation.html
var GroupInvitationHTML string

//go:embed templates/email/email_verification.html
var EmailVerificationHTML string

//go:embed templates/email/password_reset.html
var PasswordResetHTML string

//go:embed templates/email/device_verification.html
var DeviceVerificationHTML string

//go:embed templates/email/new_device_login.html
var NewDeviceLoginHTML string

//go:embed templates/email/login.html
var LoginHTML string

//go:embed templates/email/logout.html
var LogoutHTML string

//go:embed templates/email/change_email.html
var ChangeEmailHTML string

//go:embed templates/email/change_email_done.html
var ChangeEmailDoneHTML string
