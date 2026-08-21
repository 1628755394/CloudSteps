export type MetricPoint = {
  name: string
  requests: number
  uv: number
  ip: number
  errors: number
  clientErrors: number
  newUsers: number
  p50: number
  p95: number
  p99: number
}

export type ChartSeriesKey = keyof Omit<MetricPoint, 'name'>

export type ChartSeriesDef = {
  key: ChartSeriesKey
  label: string
  color: string
  unit: 'count' | 'ms'
  kind: 'area' | 'line'
  group: 'traffic' | 'errors' | 'latency' | 'users'
}

export const CHART_SERIES: ChartSeriesDef[] = [
  {
    key: 'requests',
    label: '请求',
    color: 'var(--chart-1)',
    unit: 'count',
    kind: 'area',
    group: 'traffic',
  },
  {
    key: 'uv',
    label: 'UV',
    color: 'var(--chart-2)',
    unit: 'count',
    kind: 'area',
    group: 'traffic',
  },
  {
    key: 'ip',
    label: 'IP',
    color: 'var(--chart-3)',
    unit: 'count',
    kind: 'area',
    group: 'traffic',
  },
  {
    key: 'newUsers',
    label: '新增用户',
    color: 'var(--chart-4)',
    unit: 'count',
    kind: 'area',
    group: 'users',
  },
  {
    key: 'clientErrors',
    label: '4xx',
    color: 'var(--chart-4)',
    unit: 'count',
    kind: 'area',
    group: 'errors',
  },
  {
    key: 'errors',
    label: '5xx',
    color: 'var(--chart-5)',
    unit: 'count',
    kind: 'area',
    group: 'errors',
  },
  {
    key: 'p50',
    label: 'P50',
    color: 'var(--chart-2)',
    unit: 'ms',
    kind: 'line',
    group: 'latency',
  },
  {
    key: 'p95',
    label: 'P95',
    color: 'var(--chart-1)',
    unit: 'ms',
    kind: 'line',
    group: 'latency',
  },
  {
    key: 'p99',
    label: 'P99',
    color: 'var(--chart-5)',
    unit: 'ms',
    kind: 'line',
    group: 'latency',
  },
]

const SERIES_BY_KEY = Object.fromEntries(
  CHART_SERIES.map((s) => [s.key, s])
) as Record<ChartSeriesKey, ChartSeriesDef>

export function getSeriesDef(key: ChartSeriesKey): ChartSeriesDef {
  return SERIES_BY_KEY[key]
}

export const DEFAULT_SERIES: ChartSeriesKey[] = [
  'requests',
  'uv',
  'ip',
  'errors',
  'p50',
  'p95',
  'p99',
]

/** Series with at least one non-zero data point in the range. */
export function seriesWithData(points: MetricPoint[]): ChartSeriesKey[] {
  if (points.length === 0) return []
  return CHART_SERIES.filter((series) =>
    points.some((point) => (point[series.key] ?? 0) > 0)
  ).map((series) => series.key)
}

/** Picker options: default series always + extras when they have data. */
export function seriesForPicker(points: MetricPoint[]): ChartSeriesKey[] {
  const keys = new Set<ChartSeriesKey>(DEFAULT_SERIES)
  for (const key of seriesWithData(points)) {
    keys.add(key)
  }
  return CHART_SERIES.filter((series) => keys.has(series.key)).map(
    (series) => series.key
  )
}

export function defaultSelected(available: ChartSeriesKey[]): ChartSeriesKey[] {
  return DEFAULT_SERIES.filter((key) => available.includes(key))
}

/** Keep user selection valid when available series change after reload. */
export function reconcileSelection(
  selected: ChartSeriesKey[],
  available: ChartSeriesKey[]
): ChartSeriesKey[] {
  const next = selected.filter((key) => available.includes(key))
  return next.length > 0 ? next : defaultSelected(available)
}

export function formatSeriesValue(
  key: ChartSeriesKey,
  value: number
): string {
  const def = getSeriesDef(key)
  if (def.unit === 'ms') return `${value.toFixed(1)} ms`
  return value.toLocaleString()
}
