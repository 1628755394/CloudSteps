package utils

import (
	"time"

	lbconfig "github.com/LingByte/ling-base/common/config"
	"gorm.io/gorm"
)

// ConfigItem is re-exported from ling-base/common/config for callers that
// reference the configs table model (e.g. bootstrap migrations, seeds).
type ConfigItem = lbconfig.ConfigItem

// Config is an alias for ConfigItem, preserving backward compatibility with
// existing code that references utils.Config.
type Config = lbconfig.ConfigItem

// configStore is the global ling-base config store, initialized by
// InitConfigStore. When nil, config functions fall back to env-only mode.
var configStore *lbconfig.Store

// InitConfigStore creates a global config store backed by the given DB.
// Call this once at startup after the DB connection is established.
func InitConfigStore(db *gorm.DB) error {
	s, err := lbconfig.NewStoreWithDB(db)
	if err != nil {
		return err
	}
	configStore = s
	return nil
}

// GetConfigStore returns the global config store (may be nil before
// InitConfigStore is called).
func GetConfigStore() *lbconfig.Store {
	return configStore
}

// SetValue upserts a config entry.
func SetValue(key, value, format string, autoload, public bool) {
	if configStore == nil {
		return
	}
	_ = configStore.SetValue(key, value, format, autoload, public)
}

// GetValue returns the config value for key. Returns "" when not found.
func GetValue(key string) string {
	if configStore == nil {
		return ""
	}
	return configStore.GetValue(key)
}

// GetIntValue returns the config value as int, or defaultVal when unset/invalid.
func GetIntValue(key string, defaultVal int) int {
	if configStore == nil {
		return defaultVal
	}
	return configStore.GetIntValue(key, defaultVal)
}

// GetBoolValue returns the config value as bool.
func GetBoolValue(key string) bool {
	if configStore == nil {
		return false
	}
	return configStore.GetBoolValue(key)
}

// CheckValue inserts a default config entry if it doesn't exist.
func CheckValue(key, defaultValue, format string, autoload, public bool) {
	if configStore == nil {
		return
	}
	_ = configStore.CheckValue(key, defaultValue, format, autoload, public)
}

// LoadAutoloads loads all autoload=true configs into the cache.
func LoadAutoloads() {
	if configStore == nil {
		return
	}
	_ = configStore.LoadAutoloads()
}

// LoadPublicConfigs loads all public=true configs and returns them.
func LoadPublicConfigs() []Config {
	if configStore == nil {
		return nil
	}
	items, _ := configStore.LoadPublicConfigs()
	return items
}

// CloseConfigStore closes the global config store and releases cache resources.
func CloseConfigStore() {
	if configStore != nil {
		_ = configStore.Close()
		configStore = nil
	}
}

// Ensure time import is used (ConfigItem has time.Time fields).
var _ = time.Time{}
