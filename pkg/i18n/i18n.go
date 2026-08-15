// Package i18n - re-exported from github.com/LingByte/ling-base/i18n.
// The original implementation has been moved to ling-base.
package i18n

import "github.com/LingByte/ling-base/i18n"

// Type aliases — all exported types are identical between CloudSteps and ling-base.
type (
	Locale     = i18n.Locale
	Manager    = i18n.Manager
	Translator = i18n.Translator
	Config     = i18n.Config
)

// Constants re-exported from ling-base.
const (
	DefaultLocale = i18n.DefaultLocale
	LocaleEn      = i18n.LocaleEn
	LocaleEnUS    = i18n.LocaleEnUS
	LocaleEnGB    = i18n.LocaleEnGB
	LocaleZhCN    = i18n.LocaleZhCN
	LocaleZhTW    = i18n.LocaleZhTW
	LocaleJaJP    = i18n.LocaleJaJP
	LocaleKoKR    = i18n.LocaleKoKR
	LocaleFrFR    = i18n.LocaleFrFR
	LocaleDeDE    = i18n.LocaleDeDE
	LocaleEsES    = i18n.LocaleEsES
)

// Function aliases — signatures are identical.
var (
	NewManager = i18n.NewManager
)
