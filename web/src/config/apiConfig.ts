/**
 * API配置管理模块
 * 从环境变量统一读取后端地址配置
 */

interface ApiConfig {
  apiBaseURL: string
  wsBaseURL: string
  uploadsBaseURL: string
}

/**
 * 将HTTP URL转换为WebSocket URL
 */
function convertToWebSocketURL(httpUrl: string): string {
  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://')
  } else if (httpUrl.startsWith('http://')) {
    return httpUrl.replace('http://', 'ws://')
  }
  // 如果已经有ws://或wss://，直接返回
  if (httpUrl.startsWith('ws://') || httpUrl.startsWith('wss://')) {
    return httpUrl
  }
  // 默认使用ws://
  return `ws://${httpUrl}`
}

/**
 * 开发态相对路径（如 VITE_API_BASE_URL=/api）时，走当前页面 host + Vite 代理。
 */
function sameOriginWsBase(): string {
  if (typeof window !== 'undefined' && window.location?.host) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}`
  }
  return 'ws://localhost:3000'
}

/**
 * 获取API配置
 */
function getApiConfig(): ApiConfig {
  // 优先使用环境变量（本地开发常用相对路径 /api，由 Vite 代理到后端）
  const apiBaseURL = import.meta.env.VITE_API_BASE_URL || '/api'

  let wsBaseURL = import.meta.env.VITE_WS_BASE_URL as string | undefined
  if (!wsBaseURL) {
    if (apiBaseURL.startsWith('/')) {
      // 相对 API：不要拼成 ws:///api/...（会触发 ERR_NAME_NOT_RESOLVED）
      wsBaseURL = sameOriginWsBase()
    } else {
      const origin = apiBaseURL.split('/api')[0] || apiBaseURL
      wsBaseURL = convertToWebSocketURL(origin)
    }
  }

  const uploadsBaseURL =
    import.meta.env.VITE_UPLOADS_BASE_URL ||
    (apiBaseURL.startsWith('/') ? '/uploads' : apiBaseURL.replace('/api', '/uploads'))

  return {
    apiBaseURL,
    wsBaseURL,
    uploadsBaseURL,
  }
}

// 缓存配置
let cachedConfig: ApiConfig | null = null

/**
 * 获取配置（带缓存）
 */
export function getConfig(): ApiConfig {
  if (!cachedConfig) {
    cachedConfig = getApiConfig()
  }
  return cachedConfig
}

/**
 * 获取API基础URL
 */
export function getApiBaseURL(): string {
  return getConfig().apiBaseURL
}

/**
 * 获取WebSocket基础URL
 */
export function getWebSocketBaseURL(): string {
  return getConfig().wsBaseURL
}

/**
 * 构建完整的WebSocket URL
 * @param path API路径，例如 '/api/voice/websocket' 或 '/api/chat/call'
 */
export function buildWebSocketURL(path: string): string {
  const wsBaseURL = getWebSocketBaseURL().replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  // path 形如 /api/voice/... 时直接拼到同源 ws 基址（经 Vite ws 代理到后端）
  return `${wsBaseURL}${normalized}`
}

/**
 * 获取上传文件基础URL
 */
export function getUploadsBaseURL(): string {
  return getConfig().uploadsBaseURL
}

/**
 * 清除配置缓存（用于重新加载配置）
 */
export function clearConfigCache(): void {
  cachedConfig = null
}

