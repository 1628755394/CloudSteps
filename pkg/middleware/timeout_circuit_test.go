package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestCombinedTimeoutCircuitMiddleware_timeoutDoesNotPanicWhenHandlerStillWrites(t *testing.T) {
	gin.SetMode(gin.TestMode)

	path := "/timeout-race-probe"
	mgr := GetTimeoutCircuitManager()
	mgr.mu.Lock()
	if mgr.timeoutConfig.EndpointTimeouts == nil {
		mgr.timeoutConfig.EndpointTimeouts = map[string]time.Duration{}
	}
	mgr.timeoutConfig.EndpointTimeouts[path] = 40 * time.Millisecond
	mgr.mu.Unlock()
	t.Cleanup(func() {
		mgr.mu.Lock()
		delete(mgr.timeoutConfig.EndpointTimeouts, path)
		mgr.mu.Unlock()
	})

	r := gin.New()
	r.Use(CombinedTimeoutCircuitMiddleware())
	r.GET(path, func(c *gin.Context) {
		time.Sleep(120 * time.Millisecond)
		c.Header("X-Slow", "1")
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, path, nil)
			r.ServeHTTP(w, req)
			if w.Code != http.StatusRequestTimeout {
				t.Errorf("expected 408, got %d body=%s", w.Code, w.Body.String())
			}
		}()
	}
	wg.Wait()
}

func TestCombinedTimeoutCircuitMiddleware_successStillReturnsHandlerBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	path := "/timeout-fast-probe"
	mgr := GetTimeoutCircuitManager()
	mgr.mu.Lock()
	if mgr.timeoutConfig.EndpointTimeouts == nil {
		mgr.timeoutConfig.EndpointTimeouts = map[string]time.Duration{}
	}
	mgr.timeoutConfig.EndpointTimeouts[path] = 2 * time.Second
	mgr.mu.Unlock()
	t.Cleanup(func() {
		mgr.mu.Lock()
		delete(mgr.timeoutConfig.EndpointTimeouts, path)
		mgr.mu.Unlock()
	})

	r := gin.New()
	r.Use(CombinedTimeoutCircuitMiddleware())
	r.GET(path, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
}
