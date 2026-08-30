package sysmetrics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestQPSTrackerRollingRate(t *testing.T) {
	q := newQPSTracker()
	for i := 0; i < 30; i++ {
		q.Record()
	}
	require.InDelta(t, 0.5, q.Rate(), 0.01)
}

func TestQPSTrackerIgnoresOldBuckets(t *testing.T) {
	q := newQPSTracker()
	sec := time.Now().Unix()
	q.mu.Lock()
	q.counts[0] = 1000
	q.seconds[0] = sec - 120
	q.mu.Unlock()
	require.InDelta(t, 0, q.Rate(), 0.001)
}
