import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  defaultCustomRange,
  MAX_RANGE_DAYS,
  PRESET_DAYS,
  type MetricsRangeState,
  type PresetDays,
  validateCustomRange,
} from '../metrics-range'

type MetricsRangePickerProps = {
  value: MetricsRangeState
  onChange: (next: MetricsRangeState) => void
  disabled?: boolean
}

export function MetricsRangePicker({
  value,
  onChange,
  disabled,
}: MetricsRangePickerProps) {
  const selectValue = value.kind === 'preset' ? String(value.days) : 'custom'

  const onPresetChange = (raw: string) => {
    if (raw === 'custom') {
      onChange({ kind: 'custom', ...defaultCustomRange() })
      return
    }
    onChange({ kind: 'preset', days: Number(raw) as PresetDays })
  }

  const customError =
    value.kind === 'custom' ? validateCustomRange(value.from, value.to) : null

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Select
        value={selectValue}
        onValueChange={onPresetChange}
        disabled={disabled}
      >
        <SelectTrigger size='sm' className='w-[132px]'>
          <SelectValue placeholder='时间范围' />
        </SelectTrigger>
        <SelectContent>
          {PRESET_DAYS.map((days) => (
            <SelectItem key={days} value={String(days)}>
              近 {days} 天
            </SelectItem>
          ))}
          <SelectItem value='custom'>自定义</SelectItem>
        </SelectContent>
      </Select>

      {value.kind === 'custom' ? (
        <>
          <CompactDatePicker
            label='开始'
            value={value.from}
            disabled={disabled}
            max={value.to}
            onChange={(from) =>
              onChange({ kind: 'custom', from, to: value.to })
            }
          />
          <span className='text-sm text-muted-foreground'>—</span>
          <CompactDatePicker
            label='结束'
            value={value.to}
            disabled={disabled}
            min={value.from}
            onChange={(to) =>
              onChange({ kind: 'custom', from: value.from, to })
            }
          />
          {customError ? (
            <span className='text-xs text-destructive'>{customError}</span>
          ) : (
            <span className='text-xs text-muted-foreground'>
              最多 {MAX_RANGE_DAYS} 天
            </span>
          )}
        </>
      ) : null}
    </div>
  )
}

function CompactDatePicker({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string
  value: string
  min?: string
  max?: string
  disabled?: boolean
  onChange: (ymd: string) => void
}) {
  const selected = parseYmd(value)
  const minDate = min ? parseYmd(min) : undefined
  const maxDate = max ? parseYmd(max) : new Date()
  const today = new Date()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          disabled={disabled}
          className={cn('h-8 min-w-[128px] justify-start font-normal')}
        >
          <CalendarIcon className='mr-1.5 size-3.5 opacity-60' />
          {selected ? format(selected, 'yyyy-MM-dd') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          captionLayout='dropdown'
          selected={selected}
          onSelect={(date) => {
            if (!date) return
            onChange(format(date, 'yyyy-MM-dd'))
          }}
          disabled={(date) => {
            if (date > today) return true
            if (minDate && date < minDate) return true
            if (maxDate && date > maxDate) return true
            return date < new Date('2020-01-01')
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function parseYmd(raw: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined
  const [y, m, d] = raw.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return undefined
  return dt
}
