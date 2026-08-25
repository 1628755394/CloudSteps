/**
 * 媒体 URL 工具 — 对齐 web/src/utils/mediaUrl.ts。
 * 将相对资源路径补全为可请求的绝对 URL(头像、音频等)。
 */
import { getApiBaseURL } from '../config/apiConfig'

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url?.trim()) return null
  let u = url.trim()
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('blob:') || u.startsWith('wxfile://')) {
    return u
  }
  const api = getApiBaseURL()
  const origin = api.replace(/\/api\/?$/, '')
  return u.startsWith('/') ? `${origin}${u}` : `${origin}/${u}`
}
