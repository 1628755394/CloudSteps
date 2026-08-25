/**
 * 请求封装 — 基于 Taro.request,对齐 web/src/utils/request.ts 的行为:
 *  - Bearer Token 鉴权(token 存 Taro.setStorageSync)
 *  - 统一 ApiResponse<T> 结构
 *  - 会话过期处理(清 token + 跳登录页)
 *  - 错误归一化(抛出 ApiError)
 */
import Taro from '@tarojs/taro'
import { getApiBaseURL } from '../config/apiConfig'
import { AUTH_EXPIRED_CODES, type ApiResponse, type ApiError } from '../types/api'

export type { ApiResponse, ApiError }

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface RequestOptions {
  url: string
  method?: Method
  data?: Record<string, any> | string
  header?: Record<string, string>
  /** 请求超时 ms,默认 100000(对齐 web 端) */
  timeout?: number
  /** 是否跳过自动附加 token(如登录接口) */
  skipAuth?: boolean
}

const TOKEN_KEY = 'auth_token'
const AUTH_EXPIRED_HANDLING_FLAG = { current: false }

/** 读取本地 token */
export function getToken(): string | null {
  return Taro.getStorageSync(TOKEN_KEY) || null
}

/** 写入 token */
export function setToken(token: string): void {
  Taro.setStorageSync(TOKEN_KEY, token)
}

/** 清除 token */
export function clearToken(): void {
  Taro.removeStorageSync(TOKEN_KEY)
}

function isAuthExpired(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const body = data as { code?: number; error?: string }
  if (typeof body.code === 'number' && AUTH_EXPIRED_CODES.has(body.code)) return true
  return body.error === 'UNAUTHORIZED'
}

function handleAuthExpired(msg: string): void {
  if (AUTH_EXPIRED_HANDLING_FLAG.current) return
  AUTH_EXPIRED_HANDLING_FLAG.current = true
  clearToken()
  Taro.showToast({ title: msg || '登录已过期,请重新登录', icon: 'none', duration: 1500 })
  setTimeout(() => {
    AUTH_EXPIRED_HANDLING_FLAG.current = false
    Taro.reLaunch({ url: '/pages/home/index' })
  }, 1200)
}

/**
 * 发起请求,返回 ApiResponse<T>。
 * 失败时抛出 ApiError(code/msg/data)。
 */
export async function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  const {
    url,
    method = 'GET',
    data,
    header = {},
    timeout = 100000,
    skipAuth = false,
  } = options

  const fullURL = url.startsWith('http') ? url : `${getApiBaseURL()}${url}`

  const finalHeader: Record<string, string> = {
    'Content-Type': 'application/json',
    ...header,
  }

  if (!skipAuth) {
    const token = getToken()
    if (token) finalHeader.Authorization = `Bearer ${token}`
  }

  try {
    const res = await Taro.request({
      url: fullURL,
      method,
      data,
      header: finalHeader,
      timeout,
    })

    const { statusCode, data: body } = res

    // 会话过期(HTTP 200 + 业务码,或 HTTP 401)
    if (isAuthExpired(body) || statusCode === 401) {
      const msg = body?.msg || '登录已过期,请重新登录'
      handleAuthExpired(msg)
      const err: ApiError = {
        code: body?.code ?? 1002,
        msg,
        data: null,
        error: body?.error || 'UNAUTHORIZED',
      }
      throw err
    }

    // 标准 ApiResponse 结构
    if (body && typeof body === 'object' && typeof body.code !== 'undefined') {
      return body as ApiResponse<T>
    }

    // 非标准结构(如纯数据),包装成 ApiResponse
    return { code: 0, msg: 'ok', data: body as T }
  } catch (error) {
    // 已经是归一化的 ApiError,直接抛
    if (error && typeof error === 'object' && 'code' in error && 'msg' in error && !('errMsg' in error)) {
      throw error
    }

    // Taro.request 网络错误
    const errMsg = (error as any)?.errMsg || (error as any)?.message || '网络请求失败'
    const err: ApiError = { code: -1, msg: errMsg, data: null }
    throw err
  }
}

/** GET */
export function get<T = any>(url: string, params?: Record<string, any>, options?: Omit<RequestOptions, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
  let fullURL = url
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (qs) fullURL += (fullURL.includes('?') ? '&' : '?') + qs
  }
  return request<T>({ url: fullURL, method: 'GET', ...options })
}

/** POST */
export function post<T = any>(url: string, data?: Record<string, any>, options?: Omit<RequestOptions, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
  return request<T>({ url, method: 'POST', data, ...options })
}

/** PUT */
export function put<T = any>(url: string, data?: Record<string, any>, options?: Omit<RequestOptions, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
  return request<T>({ url, method: 'PUT', data, ...options })
}

/** DELETE */
export function del<T = any>(url: string, options?: Omit<RequestOptions, 'url' | 'method'>): Promise<ApiResponse<T>> {
  return request<T>({ url, method: 'DELETE', ...options })
}
