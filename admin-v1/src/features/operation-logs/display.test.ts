import { describe, expect, it } from 'vitest'
import {
  clientSummary,
  httpMethod,
  methodVariant,
  operationTitle,
  operatorLabel,
  shortPath,
} from './display'

const sample = {
  id: 1,
  user_id: 8,
  username: '小明',
  action: 'POST',
  target: '/api/wordbooks/12/words',
  details: '创建词库单词',
  request_method: 'POST',
  browser: 'Chrome120',
  operating_system: 'Mac OS X',
  device: 'Macintosh',
}

describe('httpMethod', () => {
  it('prefers request_method then action', () => {
    expect(httpMethod(sample)).toBe('POST')
    expect(httpMethod({ id: 1, action: 'get' })).toBe('GET')
  })
})

describe('methodVariant', () => {
  it('maps HTTP verbs to badge variants', () => {
    expect(methodVariant('GET')).toBe('outline')
    expect(methodVariant('POST')).toBe('default')
    expect(methodVariant('PUT')).toBe('secondary')
    expect(methodVariant('DELETE')).toBe('destructive')
  })
})

describe('operationTitle', () => {
  it('uses the Chinese details when present', () => {
    expect(operationTitle(sample)).toBe('创建词库单词')
    expect(operationTitle({ id: 1, action: 'PUT' })).toBe('PUT')
  })
})

describe('shortPath', () => {
  it('keeps short paths and ellipsizes the head of long ones', () => {
    expect(shortPath('/api/users')).toBe('/api/users')
    expect(shortPath(`/api/${'x'.repeat(80)}`)).toMatch(/^…/)
    expect(shortPath('')).toBe('—')
  })
})

describe('clientSummary', () => {
  it('joins browser, OS and device', () => {
    expect(clientSummary(sample)).toBe('Chrome120 · Mac OS X · Macintosh')
    expect(clientSummary({ id: 1 })).toBe('—')
  })
})

describe('operatorLabel', () => {
  it('falls back to user id', () => {
    expect(operatorLabel(sample)).toBe('小明')
    expect(operatorLabel({ id: 1, user_id: 9 })).toBe('用户 #9')
  })
})
