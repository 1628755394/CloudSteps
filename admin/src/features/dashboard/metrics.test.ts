import { describe, expect, it } from 'vitest'
import { errorRate, formatQps, pctChange, toChartPoints } from './metrics'

describe('toChartPoints', () => {
  it('uses MM-DD labels and copies series', () => {
    expect(
      toChartPoints([
        {
          metricDate: '2026-08-18',
          pv: 10,
          uv: 3,
          ip: 4,
          requests: 10,
          errors: 1,
          clientErrors: 2,
          newUsers: 5,
          p50Ms: 12.5,
          p95Ms: 40,
          p99Ms: 80,
        },
      ])
    ).toEqual([
      {
        name: '08-18',
        requests: 10,
        uv: 3,
        ip: 4,
        errors: 1,
        clientErrors: 2,
        newUsers: 5,
        p50: 12.5,
        p95: 40,
        p99: 80,
      },
    ])
  })
})

describe('pctChange', () => {
  it('formats vs yesterday', () => {
    expect(pctChange(120, 100)).toBe('+20.0% 较昨日')
    expect(pctChange(80, 100)).toBe('-20.0% 较昨日')
    expect(pctChange(10, 0)).toBe('较昨日 —')
  })
})

describe('errorRate', () => {
  it('is errors over requests', () => {
    expect(errorRate(200, 2)).toBe('1.00%')
    expect(errorRate(0, 1)).toBe('0%')
  })
})

describe('formatQps', () => {
  it('formats small and large rates', () => {
    expect(formatQps(0)).toBe('0')
    expect(formatQps(1.234)).toBe('1.23')
    expect(formatQps(42.7)).toBe('43')
  })
})
