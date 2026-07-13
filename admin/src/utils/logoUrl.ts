import { getApiBaseURL } from '@/config/apiConfig'

/**
 * 构建完整的 logo URL
 * 如果 logoUrl 是相对路径，则构建完整的后端 URL
 * 如果 logoUrl 是完整 URL，则直接返回
 */
export function buildLogoUrl(logoUrl: string): string {
  if (!logoUrl) {
    return '/static/img/favicon.png'
  }

  // 如果是完整 URL（http:// 或 https:// 开头），直接返回
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    return logoUrl
  }

  // 仅将后端静态资源路径拼接到 API 主机；前端 public 资源（如 /favicon.png）保持原样
  if (logoUrl.startsWith('/')) {
    const backendAssetPrefixes = ['/uploads/', '/static/', '/media/']
    const isBackendAsset = backendAssetPrefixes.some((prefix) => logoUrl.startsWith(prefix))
    if (isBackendAsset) {
      const backendBase = getApiBaseURL()
      const baseUrl = backendBase.replace(/\/api$/, '')
      return `${baseUrl}${logoUrl}`
    }
    return logoUrl
  }

  // 其他情况，直接返回
  return logoUrl
}
