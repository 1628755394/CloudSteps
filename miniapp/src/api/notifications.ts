/**
 * 通知 API — 对齐 web/src/api/notifications.ts
 */
import { get, post, put } from '../utils/request'
import type { ApiResponse } from '../types/api'

export interface ApiNotification {
  id: number
  title: string
  content: string
  read: boolean
  created_at: string
}

export interface ListNotificationsResponse {
  list: ApiNotification[]
  total: number
  totalUnread: number
  totalRead: number
  page: number
  size: number
}

export function listNotifications(params: {
  page: number
  size: number
}): Promise<ApiResponse<ListNotificationsResponse>> {
  return get<ListNotificationsResponse>('/notification', params as any)
}

export function markAllNotificationsRead(): Promise<ApiResponse<null>> {
  return post<null>('/notification/readAll')
}

export function markNotificationRead(id: number): Promise<ApiResponse<null>> {
  return put<null>(`/notification/read/${id}`)
}
