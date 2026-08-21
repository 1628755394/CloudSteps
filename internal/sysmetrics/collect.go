package sysmetrics

import "github.com/LingByte/ling-base/common/stats"

// Daily is the in-memory view of one day's API metrics.
type Daily struct {
	Date     string
	PV       int64
	UV       int64
	IP       int64
	Requests     int64
	Errors       int64
	ClientErrors int64
	RTP50Ms      float64
	RTP95Ms  float64
	RTP99Ms  float64
}

// Collect reads today's totals out of common/stats.
// Key layout matches ling-base WebsiteMetrics / gin middleware.
func Collect(c stats.Collector, wm *stats.WebsiteMetrics, date string) Daily {
	return Daily{
		Date:     date,
		PV:       c.Counter("pv_total:" + date).Get(),
		UV:       int64(wm.GetUV(date)),
		IP:       int64(wm.GetIP(date)),
		Requests:     c.Counter("requests:" + date).Get(),
		Errors:       c.Counter("errors:" + date).Get(),
		ClientErrors: c.Counter("client_errors:" + date).Get(),
		RTP50Ms:      wm.GetResponseTimeP50(date),
		RTP95Ms:  wm.GetResponseTimeP95(date),
		RTP99Ms:  wm.GetResponseTimeP99(date),
	}
}
