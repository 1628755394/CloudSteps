import { describe, expect, it } from 'vitest'
import {
  batchAudioButtonLabel,
  eligibleBooksForPageBatch,
  purgeAudioButtonLabel,
  queueOrderLabel,
} from './audio-jobs'

describe('queueOrderLabel', () => {
  it('shows a 1-based queue number', () => {
    expect(queueOrderLabel(0)).toBe(' (#1)')
    expect(queueOrderLabel(2)).toBe(' (#3)')
    expect(queueOrderLabel(undefined)).toBe('')
  })
})

describe('batchAudioButtonLabel', () => {
  it('is idle until a batch job is queued or running', () => {
    expect(batchAudioButtonLabel()).toBe('生成音频')
    expect(
      batchAudioButtonLabel({
        kind: 'purge',
        status: 'queued',
        processed: 0,
        total: 1,
      })
    ).toBe('生成音频')
  })

  it('shows cancel-queue with position while queued', () => {
    expect(
      batchAudioButtonLabel({
        kind: 'batch',
        status: 'queued',
        processed: 0,
        total: 40,
        queuePosition: 2,
      })
    ).toBe('取消排队 (#3)')
  })

  it('shows stop with progress while running', () => {
    expect(
      batchAudioButtonLabel({
        kind: 'batch',
        status: 'running',
        processed: 4,
        total: 10,
      })
    ).toBe('停止 (4/10)')
  })
})

describe('eligibleBooksForPageBatch', () => {
  const books = [
    { id: 1, wordCount: 10 },
    { id: 2, wordCount: 0 },
    { id: 3, wordCount: 8 },
    { id: 4, wordCount: 12 },
  ]

  it('skips jobs already queued, running, or purging', () => {
    expect(
      eligibleBooksForPageBatch(books, {
        3: {
          kind: 'batch',
          status: 'queued',
          processed: 0,
          total: 8,
        },
        4: {
          kind: 'purge',
          status: 'running',
          processed: 1,
          total: 12,
        },
      }).map((b) => b.id)
    ).toEqual([1, 2])
  })

  it('keeps every book on the page when nothing is in progress', () => {
    expect(eligibleBooksForPageBatch(books, {}).map((b) => b.id)).toEqual([
      1, 2, 3, 4,
    ])
  })
})

describe('purgeAudioButtonLabel', () => {
  it('shows queue position while queued', () => {
    expect(
      purgeAudioButtonLabel({
        kind: 'purge',
        status: 'queued',
        processed: 0,
        total: 10,
        queuePosition: 0,
      })
    ).toBe('排队中 (#1)')
  })
})
