package utils

import (
	"context"
	"time"

	"github.com/LingByte/ling-base/cache/lru"
)

// GlobalCache is a global in-memory LRU cache with TTL, backed by
// ling-base/cache/lru. It preserves the CloudSteps API:
//   - Get(key) (V, bool)   — returns (value, found)
//   - Add(key, value)      — stores a value
//   - Remove(key)          — deletes a key
//
// Internally it delegates to lru.Cache[string, any] which implements
// cache.Cache[string, any] with per-entry TTL.
var GlobalCache *GlobalLRUCache

// GlobalLRUCache wraps lru.Cache[string, any] with the CloudSteps-style
// API (no context, bool return from Get).
type GlobalLRUCache struct {
	inner *lru.Cache[string, any]
	ctx   context.Context
}

// InitGlobalCache initializes the global LRU cache with the given size
// and expiration duration.
func InitGlobalCache(maxSize int, expiration time.Duration) {
	c, err := lru.New[string, any](maxSize, lru.WithDefaultTTL(expiration))
	if err != nil {
		panic("InitGlobalCache: " + err.Error())
	}
	GlobalCache = &GlobalLRUCache{inner: c, ctx: context.Background()}
}

// Get returns the value for key, or (zero, false) if missing or expired.
func (g *GlobalLRUCache) Get(key string) (any, bool) {
	if g == nil || g.inner == nil {
		return nil, false
	}
	v, err := g.inner.Get(g.ctx, key)
	if err != nil {
		return nil, false
	}
	return v, true
}

// Add stores value under key.
func (g *GlobalLRUCache) Add(key string, value any) {
	if g == nil || g.inner == nil {
		return
	}
	_ = g.inner.Set(g.ctx, key, value, 0)
}

// Remove deletes key.
func (g *GlobalLRUCache) Remove(key string) {
	if g == nil || g.inner == nil {
		return
	}
	_ = g.inner.Delete(g.ctx, key)
}
