// Package utils - signal/event utilities re-exported from ling-base/common.
// The original implementation has been moved to github.com/LingByte/ling-base/common.
package utils

import "github.com/LingByte/ling-base/common"

// Type aliases — callers use utils.Signals, utils.SignalHandler, etc.
type (
	SignalHandler = common.SignalHandler
	SigHandler    = common.SigHandler
	Signals       = common.Signals
)

// Sig returns the global signal instance (delegated to ling-base).
func Sig() *Signals { return common.Sig() }

// NewSignals creates a new Signals instance (delegated to ling-base).
func NewSignals() *Signals { return common.NewSignals() }
