/**
 * 通用 API 响应类型 — 与 web 端 web/src/utils/request.ts 的 ApiResponse 对齐。
 */
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

/** ling-base 业务码:会话过期 / 缺失 / 无效 */
export const AUTH_EXPIRED_CODES = new Set([1002, 1104, 1105])

/** 标准错误对象(请求层抛出) */
export interface ApiError {
  code: number
  msg: string
  data: any
  error?: string
}

/** 分页响应 */
export interface Paginated<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
