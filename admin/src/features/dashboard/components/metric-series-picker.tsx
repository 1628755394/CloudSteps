import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  CHART_SERIES,
  type ChartSeriesKey,
  getSeriesDef,
} from '../chart-series'

type MetricSeriesPickerProps = {
  available: ChartSeriesKey[]
  selected: ChartSeriesKey[]
  onChange: (next: ChartSeriesKey[]) => void
}

export function MetricSeriesPicker({
  available,
  selected,
  onChange,
}: MetricSeriesPickerProps) {
  if (available.length === 0) {
    return <p className='text-sm text-muted-foreground'>暂无可用曲线数据</p>
  }

  const toggle = (key: ChartSeriesKey) => {
    if (selected.includes(key)) {
      if (selected.length <= 1) return
      onChange(selected.filter((item) => item !== key))
      return
    }
    onChange([...selected, key])
  }

  const availableSet = new Set(available)

  return (
    <div className='flex flex-wrap gap-2'>
      {CHART_SERIES.filter((series) => availableSet.has(series.key)).map(
        (series) => {
          const active = selected.includes(series.key)
          return (
            <Button
              key={series.key}
              type='button'
              variant={active ? 'default' : 'outline'}
              size='sm'
              className='h-8 gap-2'
              onClick={() => toggle(series.key)}
            >
              <span
                className={cn('size-2 rounded-full')}
                style={{ backgroundColor: series.color }}
                aria-hidden
              />
              {series.label}
            </Button>
          )
        }
      )}
    </div>
  )
}

export function selectedSeriesLabel(keys: ChartSeriesKey[]): string {
  if (keys.length === 0) return '未选择指标'
  return keys.map((key) => getSeriesDef(key).label).join('、')
}
