import { describe, expect, it } from 'vitest'
import { currentPath } from './current-path'

describe('currentPath', () => {
  it('prefers href when it is a path string', () => {
    expect(
      currentPath({
        href: '/wordbooks/1255?page=2',
        pathname: '/wordbooks/1255',
        search: { page: 2 },
      })
    ).toBe('/wordbooks/1255?page=2')
  })

  it('uses searchStr when search is a parsed object', () => {
    expect(
      currentPath({
        pathname: '/wordbooks/1255',
        search: { tab: '1' },
        searchStr: '?tab=1',
      })
    ).toBe('/wordbooks/1255?tab=1')
  })

  it('keeps a string search query', () => {
    expect(
      currentPath({
        pathname: '/dashboard',
        search: '?tab=1',
      })
    ).toBe('/dashboard?tab=1')
  })

  it('does not stringify a search object', () => {
    const path = currentPath({
      pathname: '/wordbooks/1255',
      search: { redirect: '/x' },
    })
    expect(path).toBe('/wordbooks/1255')
    expect(path).not.toContain('[object')
  })
})
