import { describe, expect, it } from 'vitest'
import {
  loginHistoryQuery,
  loginPlace,
  loginResultLabel,
  loginTypeLabel,
  loginUserLabel,
  shortUserAgent,
} from './display'

describe('loginTypeLabel', () => {
  it('maps known login types', () => {
    expect(loginTypeLabel('email')).toBe('邮箱')
    expect(loginTypeLabel('password')).toBe('密码')
    expect(loginTypeLabel('wechat')).toBe('微信')
    expect(loginTypeLabel(undefined)).toBe('—')
  })
})

describe('loginPlace', () => {
  it('dedupes country, city and location', () => {
    expect(
      loginPlace({
        id: 1,
        country: '中国',
        city: '杭州',
        location: '杭州',
      })
    ).toBe('中国 · 杭州')
    expect(loginPlace({ id: 1 })).toBe('—')
  })
})

describe('loginUserLabel', () => {
  it('prefers email then user id', () => {
    expect(loginUserLabel({ id: 1, email: 'a@b.com', userId: 3 })).toBe(
      'a@b.com'
    )
    expect(loginUserLabel({ id: 1, userId: 3 })).toBe('用户 #3')
  })
})

describe('shortUserAgent', () => {
  it('summarizes common platforms', () => {
    expect(shortUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(
      'iOS'
    )
    expect(shortUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      'Windows'
    )
    expect(shortUserAgent('')).toBe('—')
  })
})

describe('loginResultLabel', () => {
  it('marks failure and success', () => {
    expect(loginResultLabel({ id: 1, success: false })).toBe('失败')
    expect(loginResultLabel({ id: 1, success: true })).toBe('成功')
  })
})

describe('loginHistoryQuery', () => {
  it('maps the result filter to API params', () => {
    expect(loginHistoryQuery('success')).toEqual({ success: 'true' })
    expect(loginHistoryQuery('failed')).toEqual({ success: 'false' })
    expect(loginHistoryQuery('suspicious')).toEqual({ is_suspicious: 'true' })
    expect(loginHistoryQuery('all')).toEqual({})
  })
})
