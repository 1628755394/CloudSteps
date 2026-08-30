import { describe, expect, it } from 'vitest'
import { joinAudioUrls, mediaSrc, splitAudioUrls } from './word-audio'

describe('splitAudioUrls', () => {
  it('splits up to two semicolon-separated slots', () => {
    expect(splitAudioUrls('/a.mp3;/b.mp3;/c.mp3')).toEqual(['/a.mp3', '/b.mp3'])
  })

  it('pads missing slots with empty strings', () => {
    expect(splitAudioUrls('/a.mp3')).toEqual(['/a.mp3', ''])
    expect(splitAudioUrls(undefined)).toEqual(['', ''])
  })
})

describe('joinAudioUrls', () => {
  it('joins filled slots and drops trailing empties', () => {
    expect(joinAudioUrls(['/a.mp3', '/b.mp3'])).toBe('/a.mp3;/b.mp3')
  })

  it('clears a later slot that duplicates an earlier UK/US stem', () => {
    expect(joinAudioUrls(['/voice_us.mp3', '/voice_uk.mp3'])).toBe(
      '/voice_us.mp3'
    )
  })
})

describe('mediaSrc', () => {
  it('keeps absolute and data URLs', () => {
    expect(mediaSrc('https://cdn.example/a.mp3')).toBe(
      'https://cdn.example/a.mp3'
    )
    expect(mediaSrc('data:audio/wav;base64,aaa')).toBe(
      'data:audio/wav;base64,aaa'
    )
  })

  it('prefixes relative paths with a slash', () => {
    expect(mediaSrc('/uploads/a.mp3')).toBe('/uploads/a.mp3')
    expect(mediaSrc('uploads/a.mp3')).toBe('/uploads/a.mp3')
  })
})
