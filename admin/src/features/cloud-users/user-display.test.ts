import { describe, expect, it } from 'vitest'
import {
  formatLocation,
  genderLabel,
  roleLabel,
  sourceLabel,
  userDisplayName,
  userInitials,
} from './user-display'

describe('userDisplayName', () => {
  it('prefers display name, then full name, then username', () => {
    expect(
      userDisplayName({
        id: 1,
        displayName: '小明',
        firstName: 'Ming',
        lastName: 'Li',
        username: 'ming@example.com',
      })
    ).toBe('小明')
    expect(
      userDisplayName({
        id: 1,
        firstName: 'Ming',
        lastName: 'Li',
        username: 'ming@example.com',
      })
    ).toBe('Ming Li')
    expect(userDisplayName({ id: 1, username: 'ming@example.com' })).toBe(
      'ming@example.com'
    )
  })
})

describe('userInitials', () => {
  it('uses two CJK characters or latin initials', () => {
    expect(userInitials({ id: 1, displayName: '张三' })).toBe('张三')
    expect(
      userInitials({ id: 1, firstName: 'Ada', lastName: 'Lovelace' })
    ).toBe('AL')
    expect(userInitials({ id: 1, email: 'teacher@school.com' })).toBe('TE')
  })
})

describe('roleLabel', () => {
  it('maps known roles', () => {
    expect(roleLabel('admin')).toBe('管理员')
    expect(roleLabel('teacher')).toBe('教师')
    expect(roleLabel('student')).toBe('学员')
    expect(roleLabel(undefined)).toBe('用户')
  })
})

describe('sourceLabel', () => {
  it('maps known registration sources', () => {
    expect(sourceLabel('web')).toBe('网页注册')
    expect(sourceLabel('WEB')).toBe('网页注册')
    expect(sourceLabel('miniapp')).toBe('小程序')
    expect(sourceLabel('teacher_create')).toBe('教师创建')
    expect(sourceLabel('')).toBe('—')
  })
})

describe('genderLabel', () => {
  it('normalizes common gender values', () => {
    expect(genderLabel('male')).toBe('男')
    expect(genderLabel('F')).toBe('女')
    expect(genderLabel('')).toBe('—')
  })
})

describe('formatLocation', () => {
  it('joins region and city', () => {
    expect(formatLocation({ id: 1, region: '浙江', city: '杭州' })).toBe(
      '浙江 · 杭州'
    )
    expect(formatLocation({ id: 1 })).toBe('—')
  })
})
