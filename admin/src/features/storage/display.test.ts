import { describe, expect, it } from 'vitest'
import {
  canPageNext,
  deleteConfirmText,
  fileLabel,
  folderLabel,
  formatBytes,
  isUnderPrefix,
  pageMarker,
  prefixCrumbs,
  previewKind,
  rememberNextMarker,
} from './display'

describe('folderLabel', () => {
  it('uses the last path segment', () => {
    expect(folderLabel('audio/words/')).toBe('words')
  })
})

describe('formatBytes', () => {
  it('formats kibibytes-style units', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
  })
})

describe('fileLabel', () => {
  it('uses the last path segment', () => {
    expect(fileLabel('audio/words/cat.mp3')).toBe('cat.mp3')
  })
})

describe('previewKind', () => {
  it('classifies by extension and content type', () => {
    expect(previewKind('a.png')).toBe('image')
    expect(previewKind('a.mp3')).toBe('audio')
    expect(previewKind('a.mp4')).toBe('video')
    expect(previewKind('doc.PDF')).toBe('pdf')
    expect(previewKind('note.txt')).toBe('text')
    expect(previewKind('data.bin', 'application/json')).toBe('text')
    expect(previewKind('blob.bin')).toBe('other')
  })
})

describe('rememberNextMarker', () => {
  it('keeps the cursor for the next page when truncated', () => {
    expect(rememberNextMarker([''], 1, 'm1', true)).toEqual(['', 'm1'])
    expect(rememberNextMarker(['', 'm1'], 2, '', false)).toEqual(['', 'm1'])
  })
})

describe('pageMarker', () => {
  it('returns the cursor for a 1-based page', () => {
    expect(pageMarker(['', 'm1'], 2)).toBe('m1')
    expect(pageMarker([''], 1)).toBe('')
  })
})

describe('canPageNext', () => {
  it('allows next when a later marker exists or the listing is truncated', () => {
    expect(canPageNext(1, ['', 'm1'], false, '')).toBe(true)
    expect(canPageNext(2, ['', 'm1'], false, '')).toBe(false)
    expect(canPageNext(1, [''], true, 'm1')).toBe(true)
  })
})

describe('deleteConfirmText', () => {
  it('describes single file, folder, and mixed deletes', () => {
    expect(deleteConfirmText(['a.txt'], [])).toContain('a.txt')
    expect(deleteConfirmText([], ['audio/words/'])).toContain('words')
    expect(deleteConfirmText(['a.txt'], ['audio/'])).toContain('1 个文件')
    expect(deleteConfirmText(['a.txt'], ['audio/'])).toContain('1 个文件夹')
  })
})

describe('isUnderPrefix', () => {
  it('matches keys under a folder prefix', () => {
    expect(isUnderPrefix('audio/a.mp3', 'audio/')).toBe(true)
    expect(isUnderPrefix('other/a.mp3', 'audio/')).toBe(false)
  })
})

describe('prefixCrumbs', () => {
  it('builds breadcrumbs from a prefix', () => {
    expect(prefixCrumbs('a/b/')).toEqual([
      { label: '根目录', prefix: '' },
      { label: 'a', prefix: 'a/' },
      { label: 'b', prefix: 'a/b/' },
    ])
  })
})
