import type { ReviewCurvePreset } from '../api/auth'

/** 与打印 PDF 一致：开课日 = 第 1 天 */
export const REVIEW_SCHEDULE_DAYS: Record<ReviewCurvePreset, number[]> = {
  times3: [1, 2, 4],
  times5: [1, 2, 4, 7, 11],
  times7: [1, 2, 4, 7, 11, 15, 20],
  times10: [1, 2, 3, 5, 7, 9, 12, 14, 17, 21],
}

function formatScheduleDesc(days: number[]): string {
  return days.map((d) => `第${d}天`).join(' → ')
}

export const REVIEW_TIMES_OPTIONS: Array<{
  value: ReviewCurvePreset
  label: string
  desc: string
}> = [
  {
    value: 'times3',
    label: '3 次',
    desc: formatScheduleDesc(REVIEW_SCHEDULE_DAYS.times3),
  },
  {
    value: 'times5',
    label: '5 次',
    desc: formatScheduleDesc(REVIEW_SCHEDULE_DAYS.times5),
  },
  {
    value: 'times7',
    label: '7 次',
    desc: formatScheduleDesc(REVIEW_SCHEDULE_DAYS.times7),
  },
  {
    value: 'times10',
    label: '10 次',
    desc: formatScheduleDesc(REVIEW_SCHEDULE_DAYS.times10),
  },
]

export function normalizeReviewCurvePreset(p?: string | null): ReviewCurvePreset {
  switch (p) {
    case 'times3':
    case 'interval3':
      return 'times3'
    case 'times5':
    case 'interval5':
      return 'times5'
    case 'times7':
      return 'times7'
    case 'times10':
    case 'standard':
    case 'interval10':
      return 'times10'
    default:
      return 'times5'
  }
}

export function reviewCurveLabel(p?: string | null): string {
  const n = normalizeReviewCurvePreset(p)
  const opt = REVIEW_TIMES_OPTIONS.find((o) => o.value === n)
  return opt ? `${opt.label}抗遗忘` : '5次抗遗忘'
}

export function reviewTimesCount(p?: string | null): number {
  const preset = normalizeReviewCurvePreset(p)
  return REVIEW_SCHEDULE_DAYS[preset]?.length ?? 5
}

export function reviewDayLabel(dayNum: number): string {
  return `第${dayNum}天`
}
