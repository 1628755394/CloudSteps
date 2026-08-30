import { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  Cloud,
  Database,
  RefreshCw,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { get } from '@/lib/api'
import { formatDateTime } from '@/lib/datetime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AdminPage } from '@/components/admin-page'

// ── Types ──

type StorageInfo = {
  kind: string
  supportsManagement: boolean
  supportsMultipart: boolean
  supportsStats: boolean
  defaultBucket: string
  defaultDomain: string
}

type BucketStats = {
  bucket: string
  region?: string
  size: number
  objectCount: number
  updatedAt: string
  storageClasses?: Array<{ class: string; size: number; objectCount: number }>
}

type CDNStatsResponse = {
  domains?: string[]
  points: CDNStatsPoint[]
  summary: CDNStatsSummary
}

type CDNStatsPoint = {
  timestamp: string
  traffic: number
  bandwidth: number
  requests: number
  hitRequests: number
  missRequests: number
}

type CDNStatsSummary = {
  totalTraffic: number
  totalRequests: number
  totalHitRequests: number
  hitRatio: number
  avgBandwidth: number
  peakBandwidth: number
  statusCodes?: Record<string, number>
}

type APIStatsResponse = {
  points: APIStatsPoint[]
  summary: APIStatsSummary
}

type APIStatsPoint = {
  timestamp: string
  totalRequests: number
  getRequests: number
  putRequests: number
  deleteRequests: number
  headRequests: number
  uploadBytes: number
  downloadBytes: number
  errorRequests: number
}

type APIStatsSummary = {
  totalRequests: number
  uploadBytes: number
  downloadBytes: number
  errorRequests: number
  errorRate: number
}

type OriginStatsResponse = {
  points: OriginStatsPoint[]
  summary: OriginStatsSummary
}

type OriginStatsPoint = {
  timestamp: string
  originTraffic: number
  originRequests: number
  failedRequests: number
}

type OriginStatsSummary = {
  totalOriginTraffic: number
  totalOriginRequests: number
  totalFailedRequests: number
  failureRate: number
}

// ── Helpers ──

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function formatTime(s: string): string {
  try {
    const d = new Date(s)
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return s
  }
}

// ── Time range ──

type RangePreset = '1h' | '24h' | '7d' | '30d' | 'custom'

const RANGE_LABELS: Record<RangePreset, string> = {
  '1h': '最近 1 小时',
  '24h': '最近 24 小时',
  '7d': '最近 7 天',
  '30d': '最近 30 天',
  custom: '自定义',
}

function rangeToQuery(
  preset: RangePreset,
  customStart?: string,
  customEnd?: string
) {
  if (preset === 'custom') {
    const start = customStart
      ? new Date(customStart + 'T00:00:00')
      : new Date(Date.now() - 7 * 86400000)
    const end = customEnd ? new Date(customEnd + 'T23:59:59') : new Date()
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
    }
  }
  const end = new Date()
  const start = new Date()
  switch (preset) {
    case '1h':
      start.setHours(start.getHours() - 1)
      break
    case '24h':
      start.setDate(start.getDate() - 1)
      break
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
  }
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  }
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Stat Card ──

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tint = 'text-primary',
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  tint?: string
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          {label}
        </CardTitle>
        <Icon className={`size-4 ${tint}`} />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {sub ? (
          <p className='mt-1 text-xs text-muted-foreground'>{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ── Main Page ──

export function StorageStatsPage() {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [bucketStats, setBucketStats] = useState<BucketStats | null>(null)
  const [cdnStats, setCdnStats] = useState<CDNStatsResponse | null>(null)
  const [apiStats, setApiStats] = useState<APIStatsResponse | null>(null)
  const [originStats, setOriginStats] = useState<OriginStatsResponse | null>(
    null
  )
  const [range, setRange] = useState<RangePreset>('7d')
  const [customStart, setCustomStart] = useState(
    toDateInputValue(new Date(Date.now() - 7 * 86400000))
  )
  const [customEnd, setCustomEnd] = useState(toDateInputValue(new Date()))
  const [loading, setLoading] = useState(false)

  const loadInfo = async () => {
    try {
      const res = await get<StorageInfo>('/admin/storage')
      setInfo(res.data)
    } catch {
      // ignore
    }
  }

  const loadAll = async () => {
    setLoading(true)
    const rq = rangeToQuery(range, customStart, customEnd)
    const qs = `start=${rq.start}&end=${rq.end}&granularity=hour`
    try {
      const [bs, cdn, api, origin] = await Promise.allSettled([
        get<BucketStats>('/admin/storage/stats/bucket'),
        get<CDNStatsResponse>(`/admin/storage/stats/cdn?${qs}`),
        get<APIStatsResponse>(`/admin/storage/stats/api?${qs}`),
        get<OriginStatsResponse>(`/admin/storage/stats/origin?${qs}`),
      ])
      if (bs.status === 'fulfilled') setBucketStats(bs.value.data)
      if (cdn.status === 'fulfilled') setCdnStats(cdn.value.data)
      if (api.status === 'fulfilled') setApiStats(api.value.data)
      if (origin.status === 'fulfilled') setOriginStats(origin.value.data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInfo()
  }, [])

  useEffect(() => {
    if (info?.supportsStats) {
      void loadAll()
    }
  }, [info?.supportsStats, range, customStart, customEnd])

  const supportsStats = info?.supportsStats ?? false

  const cdnChartData = (cdnStats?.points ?? []).map((p) => ({
    time: formatTime(p.timestamp),
    traffic: p.traffic,
    requests: p.requests,
    hits: p.hitRequests,
  }))

  const apiChartData = (apiStats?.points ?? []).map((p) => ({
    time: formatTime(p.timestamp),
    upload: p.uploadBytes,
    download: p.downloadBytes,
    errors: p.errorRequests,
    total: p.totalRequests,
  }))

  const originChartData = (originStats?.points ?? []).map((p) => ({
    time: formatTime(p.timestamp),
    traffic: p.originTraffic,
    requests: p.originRequests,
    failed: p.failedRequests,
  }))

  return (
    <AdminPage
      title='存储与 CDN 监控'
      description='存储用量、CDN 流量、API 请求与回源统计'
      extra={
        <div className='flex items-center gap-2'>
          <Select
            value={range}
            onValueChange={(v) => setRange(v as RangePreset)}
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as RangePreset[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {RANGE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {range === 'custom' ? (
            <>
              <input
                type='date'
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className='h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm'
                max={customEnd}
              />
              <span className='text-sm text-muted-foreground'>至</span>
              <input
                type='date'
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className='h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm'
                min={customStart}
                max={toDateInputValue(new Date())}
              />
            </>
          ) : null}
          <Button
            variant='outline'
            size='sm'
            onClick={() => void loadAll()}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      }
    >
      {!supportsStats ? (
        <Card>
          <CardContent className='py-12 text-center text-muted-foreground'>
            当前存储后端（{info?.kind ?? 'local'}）不支持统计接口。
            <br />
            请配置云存储（COS / OSS / S3 等）以查看监控数据。
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-6'>
          {/* 后端信息 */}
          {info ? (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <Badge variant='secondary'>{info.kind}</Badge>
              {info.defaultBucket ? (
                <span>Bucket: {info.defaultBucket}</span>
              ) : null}
              {info.defaultDomain ? <span>·</span> : null}
              {info.defaultDomain ? (
                <span>Domain: {info.defaultDomain}</span>
              ) : null}
            </div>
          ) : null}
          {/* 概览卡片 */}
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <StatCard
              icon={Database}
              label='存储用量'
              value={bucketStats ? formatBytes(bucketStats.size) : '-'}
              sub={
                bucketStats
                  ? `${formatNumber(bucketStats.objectCount)} 个对象`
                  : undefined
              }
              tint='text-blue-500'
            />
            <StatCard
              icon={Cloud}
              label='CDN 总流量'
              value={
                cdnStats ? formatBytes(cdnStats.summary.totalTraffic) : '-'
              }
              sub={
                cdnStats
                  ? `${formatNumber(cdnStats.summary.totalRequests)} 次请求`
                  : undefined
              }
              tint='text-cyan-500'
            />
            <StatCard
              icon={Activity}
              label='API 请求'
              value={
                apiStats ? formatNumber(apiStats.summary.totalRequests) : '-'
              }
              sub={
                apiStats
                  ? `错误率 ${formatPercent(apiStats.summary.errorRate)}`
                  : undefined
              }
              tint='text-violet-500'
            />
            <StatCard
              icon={Zap}
              label='回源流量'
              value={
                originStats
                  ? formatBytes(originStats.summary.totalOriginTraffic)
                  : '-'
              }
              sub={
                originStats
                  ? `失败率 ${formatPercent(originStats.summary.failureRate)}`
                  : undefined
              }
              tint='text-amber-500'
            />
          </div>

          {/* CDN 流量图表 */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <BarChart3 className='size-5' />
                CDN 流量趋势
              </CardTitle>
              <CardDescription>
                缓存命中率：
                {cdnStats ? formatPercent(cdnStats.summary.hitRatio) : '-'}
                {' · '}
                峰值带宽：
                {cdnStats
                  ? `${formatBytes(cdnStats.summary.peakBandwidth)}/s`
                  : '-'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cdnChartData.length > 0 ? (
                <ResponsiveContainer width='100%' height={280}>
                  <AreaChart data={cdnChartData}>
                    <defs>
                      <linearGradient
                        id='cdnTraffic'
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='5%'
                          stopColor='#06b6d4'
                          stopOpacity={0.3}
                        />
                        <stop
                          offset='95%'
                          stopColor='#06b6d4'
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      className='stroke-muted'
                    />
                    <XAxis dataKey='time' tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => formatBytes(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v, name) => {
                        const n = typeof v === 'number' ? v : Number(v ?? 0)
                        return name === 'traffic'
                          ? formatBytes(n)
                          : formatNumber(n)
                      }}
                    />
                    <Legend />
                    <Area
                      type='monotone'
                      dataKey='traffic'
                      name='流量 (bytes)'
                      stroke='#06b6d4'
                      fill='url(#cdnTraffic)'
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className='py-8 text-center text-sm text-muted-foreground'>
                  暂无 CDN 数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* API 请求图表 */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Activity className='size-5' />
                API 请求统计
              </CardTitle>
              <CardDescription>
                上传：
                {apiStats ? formatBytes(apiStats.summary.uploadBytes) : '-'}
                {' · '}
                下载：
                {apiStats ? formatBytes(apiStats.summary.downloadBytes) : '-'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiChartData.length > 0 ? (
                <ResponsiveContainer width='100%' height={280}>
                  <AreaChart data={apiChartData}>
                    <defs>
                      <linearGradient
                        id='apiUpload'
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='5%'
                          stopColor='#8b5cf6'
                          stopOpacity={0.3}
                        />
                        <stop
                          offset='95%'
                          stopColor='#8b5cf6'
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id='apiDownload'
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='5%'
                          stopColor='#10b981'
                          stopOpacity={0.3}
                        />
                        <stop
                          offset='95%'
                          stopColor='#10b981'
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      className='stroke-muted'
                    />
                    <XAxis dataKey='time' tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => formatBytes(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v) =>
                        formatBytes(typeof v === 'number' ? v : Number(v ?? 0))
                      }
                    />
                    <Legend />
                    <Area
                      type='monotone'
                      dataKey='upload'
                      name='上传 (bytes)'
                      stroke='#8b5cf6'
                      fill='url(#apiUpload)'
                    />
                    <Area
                      type='monotone'
                      dataKey='download'
                      name='下载 (bytes)'
                      stroke='#10b981'
                      fill='url(#apiDownload)'
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className='py-8 text-center text-sm text-muted-foreground'>
                  暂无 API 数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* 回源统计 */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Zap className='size-5' />
                回源统计
              </CardTitle>
              <CardDescription>
                回源请求：
                {originStats
                  ? formatNumber(originStats.summary.totalOriginRequests)
                  : '-'}
                {' · '}
                失败：
                {originStats
                  ? formatNumber(originStats.summary.totalFailedRequests)
                  : '-'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {originChartData.length > 0 ? (
                <ResponsiveContainer width='100%' height={280}>
                  <AreaChart data={originChartData}>
                    <defs>
                      <linearGradient
                        id='originTraffic'
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='5%'
                          stopColor='#f59e0b'
                          stopOpacity={0.3}
                        />
                        <stop
                          offset='95%'
                          stopColor='#f59e0b'
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      className='stroke-muted'
                    />
                    <XAxis dataKey='time' tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => formatBytes(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v) =>
                        formatBytes(typeof v === 'number' ? v : Number(v ?? 0))
                      }
                    />
                    <Legend />
                    <Area
                      type='monotone'
                      dataKey='traffic'
                      name='回源流量 (bytes)'
                      stroke='#f59e0b'
                      fill='url(#originTraffic)'
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className='py-8 text-center text-sm text-muted-foreground'>
                  暂无回源数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bucket 详情 */}
          {bucketStats ? (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Database className='size-5' />
                  Bucket 详情
                </CardTitle>
                <CardDescription>
                  {bucketStats.bucket || '默认 bucket'}
                  {bucketStats.region ? ` · ${bucketStats.region}` : ''}
                  {' · '}
                  更新于 {formatDateTime(bucketStats.updatedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid gap-4 sm:grid-cols-3'>
                  <div>
                    <div className='text-xs text-muted-foreground'>总大小</div>
                    <div className='text-lg font-semibold'>
                      {formatBytes(bucketStats.size)}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs text-muted-foreground'>对象数</div>
                    <div className='text-lg font-semibold'>
                      {formatNumber(bucketStats.objectCount)}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs text-muted-foreground'>
                      存储类型
                    </div>
                    <div className='mt-1 flex flex-wrap gap-1'>
                      {bucketStats.storageClasses &&
                      bucketStats.storageClasses.length > 0 ? (
                        bucketStats.storageClasses.map((sc) => (
                          <Badge key={sc.class} variant='secondary'>
                            {sc.class}: {formatBytes(sc.size)}
                          </Badge>
                        ))
                      ) : (
                        <span className='text-sm text-muted-foreground'>-</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </AdminPage>
  )
}
