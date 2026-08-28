import type { ReviewCurvePreset } from '../api/auth'

export const REVIEW_TIMES_OPTIONS: Array<{
  value: ReviewCurvePreset
  label: string
  desc: string
}> = [
  {
    value: 'times3',
    label: '3 次',
    desc: '次日 → 2 天 → 4 天（艾宾浩斯精简）',
  },
  {
    value: 'times5',
    label: '5 次',
    desc: '次日 → 2、4、7、15 天',
  },
  {
    value: 'times7',
    label: '7 次',
    desc: '次日 → 2、4、7、15、30、45 天',
  },
  {
    value: 'times10',
    label: '10 次',
    desc: '完整艾宾浩斯长周期巩固',
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
  switch (normalizeReviewCurvePreset(p)) {
    case 'times3':
      return 3
    case 'times5':
      return 5
    case 'times7':
      return 7
    case 'times10':
      return 10
    default:
      return 5
  }
}
