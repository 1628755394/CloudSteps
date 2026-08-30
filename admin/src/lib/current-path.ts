export function currentPath(location: {
  href?: unknown
  pathname?: unknown
  searchStr?: unknown
  search?: unknown
}) {
  if (typeof location.href === 'string' && location.href.startsWith('/')) {
    return location.href
  }
  const pathname =
    typeof location.pathname === 'string' ? location.pathname : '/'
  const searchStr =
    typeof location.searchStr === 'string'
      ? location.searchStr
      : typeof location.search === 'string'
        ? location.search
        : ''
  return `${pathname}${searchStr}`
}
