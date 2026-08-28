import { format, subDays } from 'date-fns'

export const PRESET_DAYS = [7, 14, 30, 90] as const
export type PresetDays = (typeof PRESET_DAYS)[number]

export type MetricsRangeState =
  | { kind: 'preset'; days: PresetDays }
  | { kind: 'custom'; from: string; to: string }

export const MAX_RANGE_DAYS = 90
const STORAGE_KEY = 'admin-metrics-range'

export function defaultMetricsRange(): MetricsRangeState {
  return { kind: 'preset', days: 14 }
}

export function defaultCustomRange(): { from: string; to: string } {
  const to = new Date()
  const from = subDays(to, 13)
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  }
}

export function loadMetricsRange(): MetricsRangeState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultMetricsRange()
    const parsed = JSON.parse(raw) as MetricsRangeState
    if (parsed.kind === 'preset' && PRESET_DAYS.includes(parsed.days)) {
      return parsed
    }
    if (
      parsed.kind === 'custom' &&
      typeof parsed.from === 'string' &&
      typeof parsed.to === 'string' &&
      validateCustomRange(parsed.from, parsed.to) == null
    ) {
      return parsed
    }
  } catch {
    /* ignore */
  }
  return defaultMetricsRange()
}

export function saveMetricsRange(range: MetricsRangeState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(range))
  } catch {
    /* ignore */
  }
}

export function rangeQueryParams(
  range: MetricsRangeState
): Record<string, string | number> {
  if (range.kind === 'preset') return { days: range.days }
  return { from: range.from, to: range.to }
}

export function rangeDescription(range: MetricsRangeState): string {
  if (range.kind === 'preset') return `近 ${range.days} 天`
  return `${range.from} 至 ${range.to}`
}

export function spanDays(from: string, to: string): number {
  const start = parseYmd(from)
  const end = parseYmd(to)
  if (!start || !end) return 0
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

export function validateCustomRange(from: string, to: string): string | null {
  const start = parseYmd(from)
  const end = parseYmd(to)
  if (!start || !end) return '日期格式无效'
  const today = dateOnly(new Date())
  if (end > today) return '结束日期不能晚于今天'
  if (end < start) return '结束日期不能早于开始日期'
  if (spanDays(from, to) > MAX_RANGE_DAYS) {
    return `时间范围不能超过 ${MAX_RANGE_DAYS} 天`
  }
  return null
}

export function isRangeEndingToday(range: MetricsRangeState): boolean {
  const today = format(new Date(), 'yyyy-MM-dd')
  if (range.kind === 'preset') return true
  return range.to === today
}

export function dayLabel(metricDate: string | undefined): string {
  if (!metricDate) return '—'
  return metricDate.length >= 10 ? metricDate.slice(5) : metricDate
}

function parseYmd(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [y, m, d] = raw.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  return dateOnly(dt)
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
