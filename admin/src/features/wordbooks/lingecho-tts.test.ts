import { describe, expect, it } from 'vitest'
import { buildWordAudioTexts, pickChineseGloss } from './lingecho-tts'

describe('pickChineseGloss', () => {
  it('strips POS prefix from a JSON translation array', () => {
    expect(pickChineseGloss('apple', '["n. 苹果"]')).toBe('苹果')
  })

  it('falls back to the word when translation is empty', () => {
    expect(pickChineseGloss('apple', '')).toBe('apple')
  })
})

describe('buildWordAudioTexts', () => {
  it('builds the two TTS lines used for word audio slots', () => {
    expect(buildWordAudioTexts('apple', '["n. 苹果"]')).toEqual([
      'apple',
      'apple apple apple',
    ])
  })
})
