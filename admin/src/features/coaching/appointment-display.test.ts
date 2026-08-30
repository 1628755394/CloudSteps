import { describe, expect, it } from 'vitest'
import {
  appointmentTitle,
  formatScheduleDate,
  monthRange,
  personLabel,
  slotLabel,
  statusBadge,
  weekRange,
} from './appointment-display'

describe('formatScheduleDate', () => {
  it('keeps YYYY-MM-DD and strips timestamps', () => {
    expect(formatScheduleDate('2026-08-27')).toBe('2026-08-27')
    expect(formatScheduleDate('2026-08-27T00:00:00+08:00')).toBe('2026-08-27')
    expect(formatScheduleDate('')).toBe('—')
  })
})

describe('personLabel', () => {
  it('prefers display name then username then id', () => {
    expect(personLabel({ displayName: '小明', username: 'stu1' }, 9)).toBe(
      '小明'
    )
    expect(personLabel({ username: 'stu1' }, 9)).toBe('stu1')
    expect(personLabel(undefined, 9)).toBe('#9')
    expect(personLabel(undefined)).toBe('—')
  })
})

describe('statusBadge', () => {
  it('maps coaching statuses', () => {
    expect(statusBadge('completed').label).toBe('已完成')
    expect(statusBadge('scheduled').label).toBe('已排课')
    expect(statusBadge('in_progress').label).toBe('进行中')
    expect(statusBadge('cancelled').label).toBe('已取消')
  })
})

describe('slotLabel', () => {
  it('joins start and end', () => {
    expect(slotLabel('10:00', '10:30')).toBe('10:00–10:30')
    expect(slotLabel(undefined, undefined)).toBe('—')
  })
})

describe('appointmentTitle', () => {
  it('uses title then student name', () => {
    expect(appointmentTitle({ id: 1, title: '早课' })).toBe('早课')
    expect(
      appointmentTitle({
        id: 2,
        studentId: 8,
        student: { displayName: '小明' },
      })
    ).toBe('小明')
  })
})

describe('weekRange', () => {
  it('is Monday through Sunday in local calendar', () => {
    const wed = new Date(2026, 7, 26) // Wed Aug 26 2026
    expect(weekRange(wed)).toEqual({ from: '2026-08-24', to: '2026-08-30' })
  })
})

describe('monthRange', () => {
  it('covers the local month', () => {
    expect(monthRange(new Date(2026, 7, 27))).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    })
  })
})
