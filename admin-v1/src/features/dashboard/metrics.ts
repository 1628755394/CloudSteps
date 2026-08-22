import type { MetricPoint } from './chart-series'

export type SysMetricRow = {
  metricDate: string
  pv: number
  uv: number
  ip: number
  requests: number
  errors: number
  clientErrors: number
  newUsers: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
}

export type LiveMetric = {
  qps: number
  mau: number
  dau: number
  requestsToday: number
  errorsToday: number
  clientErrorsToday: number
}

export function toChartPoints(rows: SysMetricRow[]): MetricPoint[] {
  return rows.map((row) => ({
    name:
      row.metricDate.length >= 10 ? row.metricDate.slice(5) : row.metricDate,
    requests: row.requests || 0,
    uv: row.uv || 0,
    ip: row.ip || 0,
    errors: row.errors || 0,
    clientErrors: row.clientErrors || 0,
    newUsers: row.newUsers || 0,
    p50: row.p50Ms || 0,
    p95: row.p95Ms || 0,
    p99: row.p99Ms || 0,
  }))
}

export function pctChange(today: number, yesterday: number): string {
  if (yesterday <= 0) return '较昨日 —'
  const pct = ((today - yesterday) / yesterday) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}% 较昨日`
}

export function errorRate(requests: number, errors: number): string {
  if (requests <= 0) return '0%'
  return `${((errors / requests) * 100).toFixed(2)}%`
}

export function formatQps(qps: number | undefined): string {
  if (qps == null || qps <= 0) return '0'
  if (qps < 10) return qps.toFixed(2)
  return Math.round(qps).toLocaleString()
}
