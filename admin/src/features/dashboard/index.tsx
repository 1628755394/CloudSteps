import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Globe,
  Loader2,
  ShieldAlert,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { get } from '@/lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AdminPage } from '@/components/admin-page'
import {
  defaultSelected,
  reconcileSelection,
  seriesForPicker,
  type ChartSeriesKey,
} from './chart-series'
import {
  MetricSeriesPicker,
  selectedSeriesLabel,
} from './components/metric-series-picker'
import { FilterableTrendChart } from './components/metrics-charts'
import { MetricsRangePicker } from './components/metrics-range-picker'
import {
  errorRate,
  formatQps,
  toChartPoints,
  type LiveMetric,
  type SysMetricRow,
} from './metrics'
import {
  dayLabel,
  isRangeEndingToday,
  loadMetricsRange,
  rangeDescription,
  rangeQueryParams,
  saveMetricsRange,
  validateCustomRange,
  type MetricsRangeState,
} from './metrics-range'

const LIVE_POLL_MS = 5000

export function Dashboard() {
  const [range, setRange] = useState<MetricsRangeState>(() =>
    loadMetricsRange()
  )
  const [rows, setRows] = useState<SysMetricRow[]>([])
  const [live, setLive] = useState<LiveMetric | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSeries, setSelectedSeries] = useState<ChartSeriesKey[]>([])

  useEffect(() => {
    saveMetricsRange(range)
  }, [range])

  useEffect(() => {
    if (range.kind === 'custom') {
      const err = validateCustomRange(range.from, range.to)
      if (err) return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await get<{ list: SysMetricRow[] }>('/metrics/daily', {
          params: rangeQueryParams(range),
        })
        if (!cancelled) setRows(res.data.list || [])
      } catch (e: unknown) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : '加载系统指标失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [range])

  useEffect(() => {
    let cancelled = false
    const loadLive = async () => {
      try {
        const res = await get<LiveMetric>('/metrics/live')
        if (!cancelled) setLive(res.data)
      } catch {
        /* keep previous snapshot */
      }
    }
    void loadLive()
    const timer = window.setInterval(() => void loadLive(), LIVE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const points = useMemo(() => toChartPoints(rows), [rows])
  const availableSeries = useMemo(() => seriesForPicker(points), [points])
  const endingToday = isRangeEndingToday(range)

  useEffect(() => {
    setSelectedSeries((prev) => {
      if (prev.length === 0 && availableSeries.length > 0) {
        return defaultSelected(availableSeries)
      }
      return reconcileSelection(prev, availableSeries)
    })
  }, [availableSeries])

  const today = rows.length > 0 ? rows[rows.length - 1] : undefined
  const yesterday = rows.length > 1 ? rows[rows.length - 2] : undefined
  const lastDayLabel = dayLabel(today?.metricDate)
  const compareHint = endingToday
    ? '较昨日'
    : `较前日 (${dayLabel(yesterday?.metricDate)})`

  return (
    <AdminPage
      title='系统指标'
      description={`${rangeDescription(range)} · API 与系统健康概览`}
      extra={
        <MetricsRangePicker
          value={range}
          onChange={setRange}
          disabled={loading}
        />
      }
    >
      {loading ? (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          加载中…
        </div>
      ) : (
        <div className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <StatCard
              title={endingToday ? '今日请求' : `${lastDayLabel} 请求`}
              value={formatInt(today?.requests)}
              hint={formatCompare(
                today?.requests ?? 0,
                yesterday?.requests ?? 0,
                compareHint
              )}
              icon={Activity}
            />
            <StatCard
              title={endingToday ? '今日 UV' : `${lastDayLabel} UV`}
              value={formatInt(today?.uv)}
              hint={formatCompare(
                today?.uv ?? 0,
                yesterday?.uv ?? 0,
                compareHint
              )}
              icon={Users}
            />
            <StatCard
              title='本月 MAU'
              value={formatInt(live?.mau)}
              hint={`今日 DAU ${formatInt(live?.dau ?? today?.uv)}`}
              icon={Users}
            />
            <StatCard
              title='实时 QPS'
              value={formatQps(live?.qps)}
              hint='近 60 秒滑动平均'
              icon={Zap}
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <StatCard
              title={endingToday ? '今日新增用户' : `${lastDayLabel} 新增`}
              value={formatInt(today?.newUsers)}
              hint={formatCompare(
                today?.newUsers ?? 0,
                yesterday?.newUsers ?? 0,
                compareHint
              )}
              icon={UserPlus}
            />
            <StatCard
              title={endingToday ? '5xx 错误率' : `${lastDayLabel} 5xx`}
              value={errorRate(today?.requests ?? 0, today?.errors ?? 0)}
              hint={`${formatInt(today?.errors)} / ${formatInt(today?.requests)} 请求`}
              icon={ShieldAlert}
            />
            <StatCard
              title={endingToday ? '4xx 错误率' : `${lastDayLabel} 4xx`}
              value={errorRate(today?.requests ?? 0, today?.clientErrors ?? 0)}
              hint={`${formatInt(today?.clientErrors)} / ${formatInt(today?.requests)} 请求`}
              icon={ShieldAlert}
            />
            <StatCard
              title={endingToday ? '今日 IP' : `${lastDayLabel} IP`}
              value={formatInt(today?.ip)}
              hint={formatCompare(
                today?.ip ?? 0,
                yesterday?.ip ?? 0,
                compareHint
              )}
              icon={Globe}
            />
          </div>

          <Card>
            <CardHeader className='gap-3'>
              <div>
                <CardTitle>趋势曲线</CardTitle>
                <CardDescription>
                  {rangeDescription(range)} ·{' '}
                  {selectedSeriesLabel(selectedSeries)} · 仅展示有数据的指标
                </CardDescription>
              </div>
              <MetricSeriesPicker
                available={availableSeries}
                selected={selectedSeries}
                onChange={setSelectedSeries}
              />
            </CardHeader>
            <CardContent className='px-2 sm:px-6'>
              <FilterableTrendChart data={points} selected={selectedSeries} />
            </CardContent>
          </Card>
        </div>
      )}
    </AdminPage>
  )
}

function formatInt(n: number | undefined): string {
  return (n ?? 0).toLocaleString()
}

function formatCompare(
  today: number,
  yesterday: number,
  suffix: string
): string {
  if (yesterday <= 0) return `${suffix} —`
  const pct = ((today - yesterday) / yesterday) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}% ${suffix}`
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string
  value: string
  hint: string
  icon: typeof Activity
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold tabular-nums'>{value}</div>
        <p className='text-xs text-muted-foreground'>{hint}</p>
      </CardContent>
    </Card>
  )
}
