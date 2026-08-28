import { describe, expect, it } from 'vitest'
import {
  defaultSelected,
  reconcileSelection,
  seriesForPicker,
  seriesWithData,
  type MetricPoint,
} from './chart-series'

const sample: MetricPoint[] = [
  {
    name: '08-17',
    requests: 100,
    uv: 10,
    ip: 0,
    errors: 0,
    clientErrors: 0,
    newUsers: 0,
    p50: 0,
    p95: 0,
    p99: 0,
  },
  {
    name: '08-18',
    requests: 120,
    uv: 12,
    ip: 8,
    errors: 1,
    clientErrors: 2,
    newUsers: 3,
    p50: 15,
    p95: 40,
    p99: 80,
  },
]

describe('seriesWithData', () => {
  it('returns only keys with non-zero points', () => {
    expect(seriesWithData(sample)).toEqual([
      'requests',
      'uv',
      'ip',
      'newUsers',
      'clientErrors',
      'errors',
      'p50',
      'p95',
      'p99',
    ])
  })

  it('returns empty when all zero', () => {
    expect(
      seriesWithData([
        {
          name: '08-18',
          requests: 0,
          uv: 0,
          ip: 0,
          errors: 0,
          clientErrors: 0,
          newUsers: 0,
          p50: 0,
          p95: 0,
          p99: 0,
        },
      ])
    ).toEqual([])
  })
})

describe('seriesForPicker', () => {
  it('always includes default series and extras with data', () => {
    expect(seriesForPicker(sample)).toEqual([
      'requests',
      'uv',
      'ip',
      'newUsers',
      'clientErrors',
      'errors',
      'p50',
      'p95',
      'p99',
    ])
  })
})

describe('defaultSelected', () => {
  it('selects the default metric bundle', () => {
    expect(defaultSelected(seriesForPicker(sample))).toEqual([
      'requests',
      'uv',
      'ip',
      'errors',
      'p50',
      'p95',
      'p99',
    ])
  })

  it('omits defaults missing from available list', () => {
    expect(defaultSelected(['requests', 'uv'])).toEqual(['requests', 'uv'])
  })
})

describe('reconcileSelection', () => {
  it('keeps valid picks and resets when none left', () => {
    expect(
      reconcileSelection(['requests', 'uv', 'ip'], ['requests', 'errors'])
    ).toEqual(['requests', 'uv'])
    expect(reconcileSelection(['ip'], ['requests', 'uv'])).toEqual([
      'requests',
      'uv',
    ])
  })
})
