import { describe, expect, it } from 'vitest'
import {
  parseExampleSentences,
  splitHighlightedText,
} from './example-sentences'

const SAMPLE = JSON.stringify([
  {
    cn: '独奏者用小提琴演奏了一首优美的协奏曲。',
    en: 'The soloist performed a beautiful concerto on her violin.',
    para: '乐器',
    pos: 'n.',
  },
  {
    cn: '我正在练习小提琴。',
    en: 'I am practicing the \u003cb\u003eviolin\u003c/b\u003e.',
    para: '小提琴',
    pos: 'n.',
  },
])

describe('parseExampleSentences', () => {
  it('parses en/cn/para/pos objects and decodes HTML escapes', () => {
    const items = parseExampleSentences(SAMPLE)
    expect(items).toHaveLength(2)
    expect(items?.[0]).toEqual({
      en: 'The soloist performed a beautiful concerto on her violin.',
      cn: '独奏者用小提琴演奏了一首优美的协奏曲。',
      para: '乐器',
      pos: 'n.',
    })
    expect(items?.[1]?.en).toBe('I am practicing the <b>violin</b>.')
  })

  it('parses unicode-escaped HTML tags from stored JSON', () => {
    const raw =
      '[{"cn":"我正在练习小提琴。","en":"I am practicing the \\u003cb\\u003eviolin\\u003c/b\\u003e.","para":"小提琴","pos":"n."}]'
    expect(parseExampleSentences(raw)?.[0]?.en).toBe(
      'I am practicing the <b>violin</b>.'
    )
  })

  it('returns an empty list for blank input', () => {
    expect(parseExampleSentences('')).toEqual([])
    expect(parseExampleSentences(undefined)).toEqual([])
  })

  it('returns null when the payload is not a JSON array', () => {
    expect(parseExampleSentences('not-json')).toBeNull()
    expect(parseExampleSentences('{"en":"hi"}')).toBeNull()
  })
})

describe('splitHighlightedText', () => {
  it('splits bold tags into highlighted segments', () => {
    expect(splitHighlightedText('play the <b>violin</b>.')).toEqual([
      { text: 'play the ', highlight: false },
      { text: 'violin', highlight: true },
      { text: '.', highlight: false },
    ])
  })
})
