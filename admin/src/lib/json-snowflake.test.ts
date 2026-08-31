import { describe, expect, it } from 'vitest'
import { parseApiJson } from './json-snowflake'

describe('parseApiJson', () => {
  it('preserves snowflake id precision as string', () => {
    const raw = JSON.stringify({
      code: 200,
      data: {
        list: [{ id: 1454224691240108544, title: '测试' }],
      },
    })
    const payload = parseApiJson<{
      data: { list: Array<{ id: string; title: string }> }
    }>(raw)
    expect(payload.data.list[0].id).toBe('1454224691240108544')
  })
})
