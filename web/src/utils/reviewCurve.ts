import type { ReviewCurvePreset } from '../api/auth'
import i18n from '../i18n'

/** 与打印 PDF 一致：开课日 = 第 1 天 */
export const REVIEW_SCHEDULE_DAYS: Record<ReviewCurvePreset, number[]> = {
  times3: [1, 2, 4],
  times5: [1, 2, 4, 7, 11],
  times7: [1, 2, 4, 7, 11, 15, 20],
  times10: [1, 2, 3, 5, 7, 9, 12, 14, 17, 21],
}

export const REVIEW_CURVE_PRESETS: ReviewCurvePreset[] = [
  'times3',
  'times5',
  'times7',
  'times10',
]

function formatScheduleDesc(days: number[]): string {
  return days.map((d) => i18n.t('review_curve.day', { n: d })).join(' → ')
}

export function getReviewTimesOptions(): Array<{
  value: ReviewCurvePreset
  label: string
  desc: string
}> {
  return REVIEW_CURVE_PRESETS.map((value) => ({
    value,
    label: i18n.t(`review_curve.${value}.label`),
    desc: formatScheduleDesc(REVIEW_SCHEDULE_DAYS[value]),
  }))
}

/** @deprecated Use getReviewTimesOptions() for locale-aware labels */
export const REVIEW_TIMES_OPTIONS = getReviewTimesOptions()

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
  const opt = getReviewTimesOptions().find((o) => o.value === n)
  return opt
    ? i18n.t('review_curve.anti_forgetting', { label: opt.label })
    : i18n.t('review_curve.default')
}

export function reviewTimesCount(p?: string | null): number {
  const preset = normalizeReviewCurvePreset(p)
  return REVIEW_SCHEDULE_DAYS[preset]?.length ?? 5
}

export function reviewDayLabel(dayNum: number): string {
  return i18n.t('review_curve.day', { n: dayNum })
}
