// Package utils - database utilities re-exported from ling-base/common.
// The original implementation has been moved to github.com/LingByte/ling-base/common.
package utils

import (
	"github.com/LingByte/ling-base/common"
	"gorm.io/gorm"
)

// Re-export database functions from ling-base/common.
var (
	InitDatabase            = common.InitDatabase
	ConfigureConnectionPool = common.ConfigureConnectionPool
	MakeMigrates            = common.MakeMigrates
)

// Ensure the gorm import is used (for callers that reference gorm.DB).
var _ *gorm.DB
