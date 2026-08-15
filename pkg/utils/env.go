package utils

import "github.com/LingByte/ling-base/common"

// Re-export env functions from ling-base/common.
var (
	GetEnv                 = common.GetEnv
	LookupEnv              = common.LookupEnv
	GetBoolEnv             = common.GetBoolEnv
	GetFloatEnv            = common.GetFloatEnv
	GetIntEnv              = common.GetIntEnv
	GetFloatEnvWithDefault = common.GetFloatEnvWithDefault
	GetIntEnvWithDefault   = common.GetIntEnvWithDefault
)

// LoadEnvs delegates to ling-base/common.LoadEnvs.
func LoadEnvs(objPtr any) { common.LoadEnvs(objPtr) }

// LoadEnv delegates to ling-base/common.LoadEnv.
func LoadEnv(env string) error { return common.LoadEnv(env) }
