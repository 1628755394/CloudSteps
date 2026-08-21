package sysmetrics

import (
	"sync"
	"time"
)

const qpsWindowSecs = 60

// qpsTracker counts requests over a rolling 60-second window.
type qpsTracker struct {
	mu      sync.Mutex
	counts  [qpsWindowSecs]int64
	seconds [qpsWindowSecs]int64
}

func newQPSTracker() *qpsTracker {
	return &qpsTracker{}
}

func (q *qpsTracker) Record() {
	sec := time.Now().Unix()
	q.mu.Lock()
	defer q.mu.Unlock()
	idx := sec % qpsWindowSecs
	if q.seconds[idx] != sec {
		q.counts[idx] = 0
		q.seconds[idx] = sec
	}
	q.counts[idx]++
}

// Rate returns average requests per second over the last minute.
func (q *qpsTracker) Rate() float64 {
	sec := time.Now().Unix()
	q.mu.Lock()
	defer q.mu.Unlock()
	var total int64
	for i := 0; i < qpsWindowSecs; i++ {
		s := q.seconds[i]
		if s != 0 && sec-s < qpsWindowSecs {
			total += q.counts[i]
		}
	}
	return float64(total) / float64(qpsWindowSecs)
}
