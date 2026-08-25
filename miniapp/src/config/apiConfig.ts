/**
 * API 配置 — 对齐 web/src/config/apiConfig.ts。
 *
 * 小程序端不能直接读 import.meta.env,改用 Taro 编译期 defineConstants
 * (见 config/index.ts → defineConstants)。
 */

interface ApiConfig {
  /** HTTP API 基址,如 https://api.cloudsteps.example/api */
  apiBaseURL: string
  /** WebSocket 基址,如 wss://api.cloudsteps.example */
  wsBaseURL: string
}

function convertToWebSocketURL(httpUrl: string): string {
  if (httpUrl.startsWith('https://')) return httpUrl.replace('https://', 'wss://')
  if (httpUrl.startsWith('http://')) return httpUrl.replace('http://', 'ws://')
  if (httpUrl.startsWith('ws://') || httpUrl.startsWith('wss://')) return httpUrl
  return `ws://${httpUrl}`
}

function resolveConfig(): ApiConfig {
  // defineConstants 注入的全局变量(见 config/index.ts)
  const apiBaseURL =
    (typeof TARO_APP_API_BASE_URL !== 'undefined' && TARO_APP_API_BASE_URL) ||
    'http://localhost:7080/api'

  const wsOverride =
    typeof TARO_APP_WS_BASE_URL !== 'undefined' ? TARO_APP_WS_BASE_URL : ''

  let wsBaseURL = wsOverride
  if (!wsBaseURL) {
    const origin = apiBaseURL.split('/api')[0] || apiBaseURL
    wsBaseURL = convertToWebSocketURL(origin)
  }

  return { apiBaseURL, wsBaseURL }
}

let cached: ApiConfig | null = null

export function getApiConfig(): ApiConfig {
  if (!cached) cached = resolveConfig()
  return cached
}

export function getApiBaseURL(): string {
  return getApiConfig().apiBaseURL
}

export function getWebSocketBaseURL(): string {
  return getApiConfig().wsBaseURL
}

/** 构建完整 WebSocket URL,path 形如 /api/voice/websocket */
export function buildWebSocketURL(path: string): string {
  const base = getWebSocketBaseURL().replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

/** 清除缓存(切换环境时用) */
export function clearConfigCache(): void {
  cached = null
}

// defineConstants 注入的全局变量声明(避免 TS 报错)
declare const TARO_APP_API_BASE_URL: string | undefined
declare const TARO_APP_WS_BASE_URL: string | undefined
