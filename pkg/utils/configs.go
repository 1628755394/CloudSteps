// Package utils - environment and database config utilities.
// Env functions are re-exported from ling-base/common.
// Database config functions (SetValue/GetValue/etc.) remain CloudSteps-specific.
package utils

import (
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/ling-base/common"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

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

// ──────────────────────────────────────────────
// CloudSteps-specific database config (not in ling-base)
// ──────────────────────────────────────────────

type Config struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	Key       string `json:"key" gorm:"size:128;uniqueIndex"`
	Desc      string `json:"desc" gorm:"size:200"`
	Autoload  bool   `json:"autoload" gorm:"index"`
	Public    bool   `json:"public" gorm:"index" default:"false"`
	Format    string `json:"format" gorm:"size:20" default:"text" comment:"json,yaml,int,float,bool,text"`
	Value     string
	CreatedAt time.Time `json:"-" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"-" gorm:"autoUpdateTime"`
}

var configValueCache *ExpiredLRUCache[string, string]

func init() {
	size := 1024
	v, _ := strconv.ParseInt(GetEnv(constants.ENV_CONFIG_CACHE_SIZE), 10, 32)
	if v > 0 {
		size = int(v)
	}

	var configCacheExpired = 10 * time.Second
	exp, err := time.ParseDuration(GetEnv(constants.ENV_CONFIG_CACHE_EXPIRED))
	if err == nil {
		configCacheExpired = exp
	}

	configValueCache = NewExpiredLRUCache[string, string](size, configCacheExpired)
}

func SetValue(db *gorm.DB, key, value, format string, autoload, public bool) {
	key = strings.ToUpper(key)
	configValueCache.Remove(key)

	newV := &Config{
		Key:      key,
		Value:    value,
		Format:   format,
		Autoload: autoload,
		Public:   public,
	}
	result := db.Model(&Config{}).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "format", "autoload", "public"}),
	}).Create(newV)

	if result.Error != nil {
		logrus.WithFields(logrus.Fields{
			"key":    key,
			"value":  value,
			"format": format,
		}).WithError(result.Error).Warn("config: setValue fail")
	}
}

func GetValue(db *gorm.DB, key string) string {
	key = strings.ToUpper(key)
	cobj, ok := configValueCache.Get(key)
	if ok {
		return cobj
	}

	var v Config
	result := db.Where("key", key).Take(&v)
	if result.Error != nil {
		return ""
	}

	configValueCache.Add(key, v.Value)
	return v.Value
}

func GetIntValue(db *gorm.DB, key string, defaultVal int) int {
	v := GetValue(db, key)
	if v == "" {
		return defaultVal
	}
	val, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return defaultVal
	}
	return int(val)
}

func GetBoolValue(db *gorm.DB, key string) bool {
	v := GetValue(db, key)
	if v == "" {
		return false
	}

	r, _ := strconv.ParseBool(strings.ToLower(v))
	return r
}

func CheckValue(db *gorm.DB, key, defaultValue, format string, autoload, public bool) {
	newV := &Config{
		Key:      strings.ToUpper(key),
		Value:    defaultValue,
		Format:   format,
		Autoload: autoload,
		Public:   public,
	}
	db.Model(&Config{}).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoNothing: true,
	}).Create(newV)
}

func LoadAutoloads(db *gorm.DB) {
	var configs []Config
	db.Where("autoload", true).Find(&configs)
	for _, v := range configs {
		configValueCache.Add(v.Key, v.Value)
	}
}

func LoadPublicConfigs(db *gorm.DB) []Config {
	var configs []Config
	db.Where("public", true).Find(&configs)
	for _, v := range configs {
		configValueCache.Add(v.Key, v.Value)
	}
	return configs
}

// Ensure reflect import is used (LoadEnvs is now delegated, but Config struct uses reflect indirectly).
var _ = reflect.TypeOf
