import { describe, expect, it } from 'vitest'
import { looksLikeEmail, profileFields } from './profile-display'

describe('looksLikeEmail', () => {
  it('rejects usernames that are not emails', () => {
    expect(looksLikeEmail('admin')).toBe(false)
    expect(looksLikeEmail('')).toBe(false)
    expect(looksLikeEmail('cetide@example.com')).toBe(true)
  })
})

describe('profileFields', () => {
  it('keeps identity and login rows, skips empty extras and fake emails', () => {
    const rows = profileFields({
      id: 1,
      username: 'admin',
      email: 'admin',
      role: 'admin',
      lastLogin: '2026-08-20T03:19:40.000Z',
      loginCount: 39,
      createdAt: '2026-04-01T03:13:22.000Z',
    })
    const labels = rows.map((row) => row.label)
    expect(labels).toEqual([
      '账号',
      '角色',
      '用户 ID',
      '上次登录',
      '登录次数',
      '注册时间',
    ])
    expect(rows.find((row) => row.label === '账号')?.value).toBe('admin')
    expect(rows.find((row) => row.label === '角色')?.value).toBe('管理员')
    expect(rows.find((row) => row.label === '用户 ID')?.value).toBe('1')
    expect(rows.find((row) => row.label === '登录次数')?.value).toBe('39')
  })

  it('includes optional rows only when they have real values', () => {
    const rows = profileFields({
      id: 7,
      username: 'cetide',
      email: 'cetide@example.com',
      role: 'admin',
      firstName: 'Ce',
      lastName: 'Tide',
      locale: 'zh-CN',
      gender: 'male',
      city: '杭州',
      region: '浙江',
      loginCount: 12,
    })
    const byLabel = Object.fromEntries(
      rows.map((row) => [row.label, row.value])
    )
    expect(byLabel['邮箱']).toBe('cetide@example.com')
    expect(byLabel['姓名']).toBe('Ce Tide')
    expect(byLabel['性别']).toBe('男')
    expect(byLabel['语言']).toBe('zh-CN')
    expect(byLabel['地区']).toBe('浙江 · 杭州')
  })

  it('returns an empty list when there is no user', () => {
    expect(profileFields(null)).toEqual([])
  })
})
