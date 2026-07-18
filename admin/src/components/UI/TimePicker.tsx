import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/utils/cn.ts'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  label?: string
  minuteStep?: number
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const parseTime = (value: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return { hour: 9, minute: 0 }
  return {
    hour: Math.min(23, Math.max(0, Number(m[1]))),
    minute: Math.min(59, Math.max(0, Number(m[2]))),
  }
}

const formatTime = (hour: number, minute: number) => `${pad2(hour)}:${pad2(minute)}`

export default function TimePicker({
  value,
  onChange,
  placeholder = '选择时间',
  disabled = false,
  className,
  label,
  minuteStep = 5,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const parsed = parseTime(value)
  const [hour, setHour] = useState(parsed.hour)
  const [minute, setMinute] = useState(parsed.minute)
  const ref = useRef<HTMLDivElement>(null)

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep)

  useEffect(() => {
    const next = parseTime(value)
    setHour(next.hour)
    setMinute(next.minute)
  }, [value])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const apply = (h: number, m: number) => {
    onChange(formatTime(h, m))
    setIsOpen(false)
  }

  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="block text-xs text-slate-500 mb-1">{label}</label>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((v) => !v)}
          className={cn(
            'w-full px-3 py-2 text-left bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn(!value && 'text-neutral-500 dark:text-neutral-400')}>
              {value || placeholder}
            </span>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg shadow-lg p-4 w-64">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-neutral-500 mb-2 text-center">时</p>
                <div className="max-h-40 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  {hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHour(h)}
                      className={cn(
                        'w-full px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700',
                        hour === h && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {pad2(h)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-2 text-center">分</p>
                <div className="max-h-40 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  {minutes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMinute(m)}
                      className={cn(
                        'w-full px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700',
                        minute === m && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {pad2(m)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                className="px-3 py-1 text-sm text-neutral-600 dark:text-neutral-400"
                onClick={() => setIsOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                onClick={() => apply(hour, minute)}
              >
                确定
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
