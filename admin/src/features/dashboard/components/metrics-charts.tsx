import { memo, useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHART_SERIES,
  formatSeriesValue,
  getSeriesDef,
  type ChartSeriesKey,
  type MetricPoint,
} from '../chart-series'

export type { MetricPoint }

const axis = {
  stroke: '#888888',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const

type FilterableTrendChartProps = {
  data: MetricPoint[]
  selected: ChartSeriesKey[]
}

export const FilterableTrendChart = memo(function FilterableTrendChart({
  data,
  selected,
}: FilterableTrendChartProps) {
  const active = useMemo(
    () => CHART_SERIES.filter((series) => selected.includes(series.key)),
    [selected]
  )

  const showCount = active.some((series) => series.unit === 'count')
  const showMs = active.some((series) => series.unit === 'ms')

  if (active.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-sm text-muted-foreground'>
        请至少选择一条曲线
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={320} debounce={80}>
      <ComposedChart
        data={data}
        margin={{
          top: 8,
          right: showCount && showMs ? 16 : 8,
          left: 0,
          bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray='3 3' className='stroke-border' />
        <XAxis dataKey='name' {...axis} />
        {showCount ? (
          <YAxis
            yAxisId='count'
            {...axis}
            allowDecimals={false}
            tickFormatter={(v) => Number(v).toLocaleString()}
          />
        ) : null}
        {showMs ? (
          <YAxis
            yAxisId='ms'
            orientation={showCount ? 'right' : 'left'}
            {...axis}
            tickFormatter={(v) => `${v}ms`}
          />
        ) : null}
        <Tooltip
          formatter={(value, _name, item) => {
            const key = String(item.dataKey) as ChartSeriesKey
            return [
              formatSeriesValue(key, Number(value)),
              getSeriesDef(key).label,
            ]
          }}
        />
        <Legend />
        {active.map((series) => {
          const yAxisId = series.unit === 'ms' ? 'ms' : 'count'
          if (series.kind === 'line') {
            return (
              <Line
                key={series.key}
                yAxisId={yAxisId}
                type='monotone'
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            )
          }
          return (
            <Area
              key={series.key}
              yAxisId={yAxisId}
              type='monotone'
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              fill={series.color}
              fillOpacity={0.16}
              isAnimationActive={false}
            />
          )
        })}
      </ComposedChart>
    </ResponsiveContainer>
  )
})
