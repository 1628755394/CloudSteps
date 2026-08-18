import { z } from 'zod'

export const WORDBOOKS_DEFAULT_PAGE = 1
export const WORDBOOKS_DEFAULT_PAGE_SIZE = 20

export const wordbooksSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(WORDBOOKS_DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .catch(WORDBOOKS_DEFAULT_PAGE_SIZE),
  keyword: z.string().optional().catch(undefined),
  isActive: z.enum(['true', 'false']).optional().catch(undefined),
  group: z.string().optional().catch(undefined),
  sourceName: z.string().optional().catch(undefined),
  level: z.string().optional().catch(undefined),
})

export type WordbooksSearch = z.infer<typeof wordbooksSearchSchema>

export const WORDBOOK_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export const DEFAULT_WORDBOOK_GROUPS = [
  { key: '', label: '全部分类' },
  { key: 'primary', label: '小学' },
  { key: 'middle', label: '初中' },
  { key: 'high', label: '高中' },
  { key: 'cet4', label: '大学四级' },
  { key: 'cet6', label: '大学六级' },
  { key: 'kaoyan', label: '考研' },
  { key: 'abroad', label: '留学考试' },
  { key: 'tem', label: '专四专八' },
  { key: 'textbook', label: '教材' },
] as const

export function defaultWordbooksSearch(): WordbooksSearch {
  return {
    page: WORDBOOKS_DEFAULT_PAGE,
    pageSize: WORDBOOKS_DEFAULT_PAGE_SIZE,
  }
}

export function missingWordbooksPaging(searchStr: string): boolean {
  const raw = new URLSearchParams(
    searchStr.startsWith('?') ? searchStr.slice(1) : searchStr
  )
  return !raw.has('page') || !raw.has('pageSize')
}

export function wordbooksListSearch(
  search: Partial<WordbooksSearch>
): WordbooksSearch {
  const next: WordbooksSearch = {
    page: Number(search.page) > 0 ? Number(search.page) : WORDBOOKS_DEFAULT_PAGE,
    pageSize:
      Number(search.pageSize) > 0
        ? Number(search.pageSize)
        : WORDBOOKS_DEFAULT_PAGE_SIZE,
  }
  const keyword = search.keyword?.trim()
  if (keyword) next.keyword = keyword
  if (search.isActive) next.isActive = search.isActive
  if (search.group) next.group = search.group
  if (search.sourceName) next.sourceName = search.sourceName
  if (search.level) next.level = search.level
  return next
}

export function wordbooksApiParams(search: WordbooksSearch): URLSearchParams {
  const params = new URLSearchParams({
    page: String(search.page),
    pageSize: String(search.pageSize),
  })
  if (search.keyword) params.set('keyword', search.keyword)
  if (search.isActive) params.set('isActive', search.isActive)
  if (search.group) params.set('group', search.group)
  if (search.sourceName) params.set('sourceName', search.sourceName)
  if (search.level) params.set('level', search.level)
  return params
}

export function hasWordbookFilters(search: WordbooksSearch): boolean {
  return Boolean(
    search.keyword ||
      search.isActive ||
      search.group ||
      search.sourceName ||
      search.level
  )
}
