import { describe, expect, it } from 'vitest'
import { parseQuestionOptions } from './question-detail-sheet'

describe('parseQuestionOptions', () => {
  it('parses a JSON string array', () => {
    expect(parseQuestionOptions('["苹果","香蕉","橙子"]')).toEqual([
      '苹果',
      '香蕉',
      '橙子',
    ])
  })

  it('falls back to comma-separated text', () => {
    expect(parseQuestionOptions('苹果, 香蕉')).toEqual(['苹果', '香蕉'])
  })

  it('returns an empty list when missing', () => {
    expect(parseQuestionOptions(undefined)).toEqual([])
    expect(parseQuestionOptions('')).toEqual([])
  })
})
