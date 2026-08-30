export function folderLabel(prefix: string): string {
  const trimmed = prefix.replace(/\/+$/, '')
  const parts = trimmed.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? prefix
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return '—'
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let n = size / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`
}

export function fileLabel(key: string): string {
  const parts = key.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? key
}

export type PreviewKind = 'image' | 'audio' | 'video' | 'pdf' | 'text' | 'other'

const IMAGE_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'])
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv'])
const TEXT_EXT = new Set([
  'txt',
  'json',
  'md',
  'csv',
  'xml',
  'yaml',
  'yml',
  'log',
  'html',
  'htm',
  'css',
  'js',
  'ts',
  'tsx',
  'go',
  'env',
])

function extname(key: string): string {
  const base = fileLabel(key)
  const i = base.lastIndexOf('.')
  if (i < 0) return ''
  return base.slice(i + 1).toLowerCase()
}

export function previewKind(key: string, contentType = ''): PreviewKind {
  const ct = contentType.toLowerCase()
  const ext = extname(key)
  if (ct.startsWith('image/') || IMAGE_EXT.has(ext)) return 'image'
  if (ct.startsWith('audio/') || AUDIO_EXT.has(ext)) return 'audio'
  if (ct.startsWith('video/') || VIDEO_EXT.has(ext)) return 'video'
  if (ct.includes('pdf') || ext === 'pdf') return 'pdf'
  if (
    ct.startsWith('text/') ||
    ct.includes('json') ||
    ct.includes('xml') ||
    ct.includes('javascript') ||
    TEXT_EXT.has(ext)
  ) {
    return 'text'
  }
  return 'other'
}

/** Object-store listing is cursor-based; markers[i] is the request marker for 1-based page i+1. */
export function rememberNextMarker(
  markers: string[],
  page: number,
  nextMarker: string,
  truncated: boolean
): string[] {
  const next = markers.slice(0, page)
  if (truncated && nextMarker) next.push(nextMarker)
  return next
}

export function pageMarker(markers: string[], page: number): string {
  return markers[page - 1] ?? ''
}

export function canPageNext(
  page: number,
  markers: string[],
  truncated: boolean,
  nextMarker: string
): boolean {
  return page < markers.length || (truncated && Boolean(nextMarker))
}

export function isUnderPrefix(key: string, prefix: string): boolean {
  return key.startsWith(prefix)
}

export function deleteConfirmText(keys: string[], prefixes: string[]): string {
  const fileCount = keys.length
  const folderCount = prefixes.length
  if (folderCount === 1 && fileCount === 0) {
    return `确定删除文件夹「${folderLabel(prefixes[0])}/」及其下全部对象？此操作不可恢复。`
  }
  if (folderCount === 0 && fileCount === 1) {
    return `确定删除「${fileLabel(keys[0])}」？此操作不可恢复。`
  }
  const parts: string[] = []
  if (fileCount > 0) parts.push(`${fileCount} 个文件`)
  if (folderCount > 0) parts.push(`${folderCount} 个文件夹（含其下全部对象）`)
  return `确定删除选中的 ${parts.join('和')}？此操作不可恢复。`
}

export function prefixCrumbs(
  prefix: string
): { label: string; prefix: string }[] {
  const parts = prefix.split('/').filter(Boolean)
  const crumbs: { label: string; prefix: string }[] = [
    { label: '根目录', prefix: '' },
  ]
  let acc = ''
  for (const part of parts) {
    acc += `${part}/`
    crumbs.push({ label: part, prefix: acc })
  }
  return crumbs
}
