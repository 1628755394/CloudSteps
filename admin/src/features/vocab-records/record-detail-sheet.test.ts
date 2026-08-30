import { describe, expect, it } from 'vitest'
import { parseRecordAnswers } from './record-detail-sheet'

describe('parseRecordAnswers', () => {
  it('parses answer snapshots from JSON', () => {
    expect(
      parseRecordAnswers(
        '[{"questionId":12,"level":"A1","answer":"苹果","correct":true}]'
      )
    ).toEqual([{ questionId: 12, level: 'A1', answer: '苹果', correct: true }])
  })

  it('returns an empty list for invalid JSON', () => {
    expect(parseRecordAnswers('not-json')).toEqual([])
    expect(parseRecordAnswers(undefined)).toEqual([])
  })
})
