package sysmetrics

import (
	"testing"
	"time"

	"github.com/LingByte/ling-base/common/stats"
	"github.com/LingByte/ling-base/common/stats/memory"
	"github.com/stretchr/testify/require"
)

func TestCollectReadsWebsiteMetrics(t *testing.T) {
	c := memory.New()
	wm := stats.NewWebsiteMetrics(c)
	date := "2026-08-18"

	wm.RecordPVTotal(date)
	wm.RecordPVTotal(date)
	wm.RecordUV(date, "u1")
	wm.RecordUV(date, "u2")
	wm.RecordUV(date, "u1")
	wm.RecordIP(date, "1.1.1.1")
	wm.RecordIP(date, "1.1.1.2")
	wm.RecordRequest(date)
	wm.RecordRequest(date)
	wm.RecordError(date)
	wm.RecordResponseTimeMs(date, 10)
	wm.RecordResponseTimeMs(date, 20)
	wm.RecordResponseTimeMs(date, 40)

	got := Collect(c, wm, date)
	require.Equal(t, date, got.Date)
	require.Equal(t, int64(2), got.PV)
	require.Equal(t, int64(2), got.UV)
	require.Equal(t, int64(2), got.IP)
	require.Equal(t, int64(2), got.Requests)
	require.Equal(t, int64(1), got.Errors)
	require.Greater(t, got.RTP50Ms, 0.0)
	require.GreaterOrEqual(t, got.RTP95Ms, got.RTP50Ms)
}

func TestCollectEmptyDay(t *testing.T) {
	c := memory.New()
	wm := stats.NewWebsiteMetrics(c)
	got := Collect(c, wm, "2026-01-01")
	require.Equal(t, Daily{Date: "2026-01-01"}, got)
}

func TestCollectDoesNotMixDates(t *testing.T) {
	c := memory.New()
	wm := stats.NewWebsiteMetrics(c)
	wm.RecordPVTotal("2026-08-17")
	wm.RecordRequest("2026-08-17")
	got := Collect(c, wm, "2026-08-18")
	require.Equal(t, int64(0), got.PV)
	require.Equal(t, int64(0), got.Requests)
}

func TestPercentileUsesMilliseconds(t *testing.T) {
	c := memory.New()
	wm := stats.NewWebsiteMetrics(c)
	date := "2026-08-18"
	wm.RecordResponseTime(date, 50*int64(time.Millisecond))
	got := Collect(c, wm, date)
	require.InDelta(t, 50, got.RTP50Ms, 0.1)
}
