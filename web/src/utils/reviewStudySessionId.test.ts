import { describe, expect, it, vi, beforeEach } from 'vitest'
import { normalizeSnowflakeId } from './json-snowflake'

/**
 * Mirrors ReviewWordList / AntiForgetting studySessionId handling.
 * Number() loses precision on snowflake IDs → /review/today filters the wrong session → 0 words.
 */
function parseStudySessionIdBuggy(raw: string | null | undefined): number {
  return Number(raw || 0)
}

function parseStudySessionId(raw: string | null | undefined): string {
  return normalizeSnowflakeId(raw)
}

describe('anti-forgetting studySessionId', () => {
  const snowflake = '1454224691240108544'

  it('Number() corrupts snowflake studySessionId (root cause of 列表有词/点开0词)', () => {
    const corrupted = parseStudySessionIdBuggy(snowflake)
    expect(String(corrupted)).not.toBe(snowflake)
  })

  it('normalizeSnowflakeId keeps studySessionId exact for /review/today', () => {
    expect(parseStudySessionId(snowflake)).toBe(snowflake)
    expect(parseStudySessionId('0')).toBe('')
    expect(parseStudySessionId(null)).toBe('')
  })
})

describe('getReviewToday studySessionId param', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('forwards studySessionId as string, never Number-coerced', async () => {
    const get = vi.fn().mockResolvedValue({ code: 200, data: { words: [] } })
    vi.doMock('./request', () => ({ get, post: vi.fn() }))
    const { getReviewToday } = await import('../api/review')
    await getReviewToday('50', { studySessionId: '1454224691240108544', date: '2026-09-06' })
    expect(get).toHaveBeenCalledWith(
      '/review/today',
      expect.objectContaining({
        params: expect.objectContaining({
          studySessionId: '1454224691240108544',
          wordBookId: '50',
          date: '2026-09-06',
        }),
      })
    )
    const passed = get.mock.calls[0][1].params.studySessionId
    expect(typeof passed).toBe('string')
    expect(passed).toBe('1454224691240108544')
  })
})
