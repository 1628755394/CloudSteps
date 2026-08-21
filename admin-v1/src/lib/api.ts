import axios, { type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth-store'

export type ApiResponse<T = unknown> = {
  code: number
  msg: string
  data: T
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30_000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg = error.response?.data?.msg
    if (typeof msg === 'string' && msg.length > 0) {
      error.message = msg
    }
    return Promise.reject(error)
  }
)

function unwrap<T>(payload: ApiResponse<T>): ApiResponse<T> {
  if (payload.code !== 200) {
    const err = new Error(payload.msg || '请求失败') as Error & {
      code: number
      msg: string
    }
    err.code = payload.code
    err.msg = payload.msg
    throw err
  }
  return payload
}

export async function get<T>(url: string, config?: AxiosRequestConfig) {
  const { data } = await api.get<ApiResponse<T>>(url, config)
  return unwrap(data)
}

export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
  const { data } = await api.post<ApiResponse<T>>(url, body, config)
  return unwrap(data)
}

export async function put<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
  const { data } = await api.put<ApiResponse<T>>(url, body, config)
  return unwrap(data)
}

export async function del<T>(url: string, config?: AxiosRequestConfig) {
  const { data } = await api.delete<ApiResponse<T>>(url, config)
  return unwrap(data)
}

export async function getBlob(url: string, config?: AxiosRequestConfig) {
  const { data } = await api.get<Blob>(url, {
    ...config,
    responseType: 'blob',
    timeout: config?.timeout ?? 60_000,
  })
  if (!data.type.includes('application/json')) return data
  const text = await data.text()
  try {
    const payload = JSON.parse(text) as ApiResponse
    if (typeof payload.code === 'number' && payload.code !== 200) {
      throw new Error(payload.msg || '请求失败')
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      return new Blob([text], { type: data.type })
    }
    throw err
  }
  return new Blob([text], { type: data.type })
}
