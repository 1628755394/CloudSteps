import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { useAuthStore } from '../stores/authStore'
import { getApiBaseURL } from '../config/apiConfig'
import i18n, { getStoredLocale } from '../i18n'
import zhCN from '../i18n/locales/zh-CN.json'
import { formatApiMessage } from './apiMessage'
import { toast } from 'sonner'

const getApiBaseUrl = () => {
  return getApiBaseURL()
}

/** ling-base business codes for expired / missing / invalid session token */
const AUTH_EXPIRED_CODES = new Set([1002, 1104, 1105])

let handlingAuthExpired = false

const SUPPRESS_403_MSG_MARKERS = [
  'coaching.relation_required',
  'coaching.no_student_access',
  zhCN['coaching.relation_required'],
  zhCN['coaching.no_student_access'],
] as const

function shouldSuppress403Toast(msg: string): boolean {
  if (!msg) return false
  return SUPPRESS_403_MSG_MARKERS.some((marker) => msg.includes(marker))
}

function isAuthExpiredPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const body = data as { code?: number; error?: string }
  if (typeof body.code === 'number' && AUTH_EXPIRED_CODES.has(body.code)) return true
  return body.error === 'UNAUTHORIZED'
}

/** Toast once + clear session + redirect to login (deduped for parallel 401s). */
function handleAuthExpired() {
  if (handlingAuthExpired) return
  handlingAuthExpired = true

  useAuthStore.getState().clearUser()
  toast.error(i18n.t('auth.session_expired'))

  const currentPath = window.location.pathname + window.location.search
  if (currentPath.startsWith('/login')) {
    handlingAuthExpired = false
    return
  }
  setTimeout(() => {
    window.location.href = `/login?next=${encodeURIComponent(currentPath)}`
  }, 1200)
}

// 创建axios实例
const axiosInstance: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 100000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 添加认证token
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // 注入 Accept-Language 让后端 i18n 中间件按语言返回消息
    config.headers['Accept-Language'] = getStoredLocale()
    // 移除测试token逻辑，让需要认证的接口正确返回401
    
    // 如果是FormData，让浏览器自动设置Content-Type（包含boundary）
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    
    // 添加请求时间戳
    if (config.params) {
      config.params._t = Date.now()
    } else {
      config.params = { _t: Date.now() }
    }
    
    // 添加调试信息
    // @ts-ignore
      console.log('Making request to:', config.baseURL + config.url, {
      method: config.method,
      headers: config.headers,
      params: config.params
    })
    
    return config
  },
  (error) => {
    console.error('Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器 - 只处理通用错误，不处理业务逻辑
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // ling-base AbortWithStatusJSON always returns HTTP 200 with business code
    // (e.g. 1002 UNAUTHORIZED / "token expired"). Handle session expiry here;
    // leave other non-200 codes to the page layer.
    if (isAuthExpiredPayload(response.data)) {
      handleAuthExpired()
      return Promise.reject({
        code: response.data?.code ?? 1002,
        msg: response.data?.msg || i18n.t('auth.session_expired'),
        data: null,
        error: response.data?.error || 'UNAUTHORIZED',
      })
    }
    return response
  },
  (error) => {
      console.error('Response interceptor error:', error)
    // 处理网络错误和HTTP状态码错误
    if (error.response) {
        console.log('Response status:', error.response.status)
      // 服务器返回了错误状态码
      const status = error.response.status
      const data = error.response.data

      if (status === 401 || isAuthExpiredPayload(data)) {
        handleAuthExpired()
        return Promise.reject(error)
      }

      switch (status) {
        case 403: {
          const msg =
            data && typeof data === 'object' && 'msg' in data
              ? String((data as { msg?: unknown }).msg || '')
              : ''
          if (shouldSuppress403Toast(msg)) {
            break
          }
          toast.error(formatApiMessage(msg, 'common.no_permission'))
          break
        }
        case 404:
          console.error('Not Found: API endpoint not found')
          break
        case 500:
          console.error('Internal Server Error')
          break
        default:
          console.error(`HTTP Error ${status}:`, data)
      }
    } else if (error.request) {
      // 网络错误 - 连接被拒绝或超时
      console.error('Network Error:', error.message)
    } else {
      // 其他错误
      console.error('Error:', error.message)
    }
    
    return Promise.reject(error)
  }
)

export default axiosInstance
