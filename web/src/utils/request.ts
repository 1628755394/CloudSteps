import axiosInstance from './axios'
import { InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import i18n from '../i18n'

// 通用响应类型
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

// 请求函数 - 返回完整的响应结构
const request = async <T = any>(
  url: string,
  options: Partial<InternalAxiosRequestConfig> = {}
): Promise<ApiResponse<T>> => {
  try {
    const response: AxiosResponse<ApiResponse<T>> = await axiosInstance({
      url,
      ...options,
    })
    
    // 返回完整的响应结构，让业务层处理
    return response.data
  } catch (error: any) {
    // Already normalized by axios interceptor (e.g. business-code auth expiry)
    if (error && typeof error === 'object' && error.code !== undefined && error.msg && !error.response && !error.isAxiosError) {
      throw {
        code: error.code,
        msg: error.msg,
        data: error.data ?? null,
        error: error.error,
      }
    }

    // 如果是axios错误，尝试从响应中获取错误信息
    if (error.response?.data) {
      const errorData = error.response.data
      // 处理不同的错误格式
      if (errorData.code !== undefined) {
        // 标准格式: {code, msg, data, error?}
        // 优先使用 msg 字段，这是用户友好的错误信息
        // Preserve original error code from backend
        throw {
          code: errorData.code,
          msg: errorData.msg || errorData.message || errorData.error || i18n.t('common.request_failed'),
          data: errorData.data || null,
          error: errorData.error,
        }
      } else if (errorData.error) {
        // 格式: {"error": "email has exists"}
        throw {
          code: error.response.status || 500,
          msg: errorData.error,
          data: null
        }
      } else {
        // 其他格式，尝试提取错误信息
        throw {
          code: error.response.status || 500,
          msg: errorData.message || errorData.msg || errorData.error || i18n.t('common.request_failed'),
          data: null
        }
      }
    }
    
    // 网络错误处理
    let errorMessage = i18n.t('common.network_error')
    if (error.code === 'ERR_CONNECTION_REFUSED') {
      errorMessage = i18n.t('common.connection_refused')
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = i18n.t('common.request_timeout')
    } else if (error.message) {
      errorMessage = error.message
    }
    
    throw {
      code: -1,
      msg: errorMessage,
      data: null
    }
  }
}

// GET 请求
export const get = <T = any>(url: string, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  return request<T>(url, { ...config, method: 'GET' })
}

// POST 请求
export const post = <T = any>(url: string, data?: any, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  return request<T>(url, {
    ...config,
    method: 'POST',
    data,
  })
}

// PUT 请求
export const put = <T = any>(url: string, data?: any, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  return request<T>(url, {
    ...config,
    method: 'PUT',
    data,
  })
}

// DELETE 请求
export const del = <T = any>(url: string, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  return request<T>(url, { ...config, method: 'DELETE' })
}

// PATCH 请求
export const patch = <T = any>(url: string, data?: any, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  return request<T>(url, {
    ...config,
    method: 'PATCH',
    data,
  })
}

// 导出 request 对象和类型
export { request }
export default request
