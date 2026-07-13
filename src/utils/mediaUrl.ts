import { getApiBaseURL } from '@/config/apiConfig'

/** 开发环境：证书异常的 store 域名改走本地 API 同源代理 */
function rewriteStoreHostForDev(url: string): string {
  if (!import.meta.env.DEV) return url
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('store.lingecho.com')) return url
    const api = getApiBaseURL()
    const origin = api.replace(/\/api\/?$/, '')
    return `${origin}${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

/** 将相对资源路径补全为可请求的绝对 URL（音频、图片等） */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url?.trim()) return null
  let u = url.trim()
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('blob:')) {
    return rewriteStoreHostForDev(u)
  }
  const api = getApiBaseURL()
  const origin = api.replace(/\/api\/?$/, '')
  const resolved = u.startsWith('/') ? `${origin}${u}` : `${origin}/${u}`
  return rewriteStoreHostForDev(resolved)
}
