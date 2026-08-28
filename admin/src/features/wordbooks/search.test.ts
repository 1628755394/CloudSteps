import { describe, expect, it } from 'vitest'
import {
  defaultWordbooksSearch,
  hasWordbookFilters,
  missingWordbooksPaging,
  wordbooksApiParams,
  wordbooksListSearch,
} from './search'

describe('missingWordbooksPaging', () => {
  it('requires both page and pageSize', () => {
    expect(missingWordbooksPaging('')).toBe(true)
    expect(missingWordbooksPaging('?keyword=a')).toBe(true)
    expect(missingWordbooksPaging('?page=1')).toBe(true)
    expect(missingWordbooksPaging('?page=1&pageSize=20')).toBe(false)
  })
})

describe('wordbooksListSearch', () => {
  it('always keeps paging and drops empty filters', () => {
    expect(wordbooksListSearch({})).toEqual(defaultWordbooksSearch())
    expect(
      wordbooksListSearch({
        page: 3,
        pageSize: 20,
        keyword: '  高考  ',
        isActive: 'true',
        group: '',
      })
    ).toEqual({
      page: 3,
      pageSize: 20,
      keyword: '高考',
      isActive: 'true',
    })
  })
})

describe('wordbooksApiParams', () => {
  it('serializes paging and active filters', () => {
    const params = wordbooksApiParams({
      page: 2,
      pageSize: 20,
      keyword: '高考',
      group: 'high',
    })
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('20')
    expect(params.get('keyword')).toBe('高考')
    expect(params.get('group')).toBe('high')
    expect(params.get('isActive')).toBeNull()
  })
})

describe('hasWordbookFilters', () => {
  it('is false for paging-only search', () => {
    expect(hasWordbookFilters(defaultWordbooksSearch())).toBe(false)
    expect(hasWordbookFilters({ page: 1, pageSize: 20, level: 'A1' })).toBe(
      true
    )
  })
})
