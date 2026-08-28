import { describe, expect, it } from 'vitest'
import {
  rangeDescription,
  rangeQueryParams,
  spanDays,
  validateCustomRange,
} from './metrics-range'

describe('rangeQueryParams', () => {
  it('maps preset and custom ranges', () => {
    expect(rangeQueryParams({ kind: 'preset', days: 30 })).toEqual({ days: 30 })
    expect(
      rangeQueryParams({
        kind: 'custom',
        from: '2026-08-01',
        to: '2026-08-14',
      })
    ).toEqual({ from: '2026-08-01', to: '2026-08-14' })
  })
})

describe('validateCustomRange', () => {
  it('rejects inverted ranges', () => {
    expect(validateCustomRange('2026-08-14', '2026-08-01')).toMatch(/结束日期/)
  })

  it('accepts valid spans', () => {
    expect(validateCustomRange('2026-08-01', '2026-08-14')).toBeNull()
    expect(spanDays('2026-08-01', '2026-08-14')).toBe(14)
  })
})

describe('rangeDescription', () => {
  it('formats labels', () => {
    expect(rangeDescription({ kind: 'preset', days: 7 })).toBe('近 7 天')
    expect(
      rangeDescription({
        kind: 'custom',
        from: '2026-08-01',
        to: '2026-08-14',
      })
    ).toBe('2026-08-01 至 2026-08-14')
  })
})
