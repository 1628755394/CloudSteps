/**
 * 通知 API — 对齐 web/src/api/notifications.ts
 */
import { get, post, put } from '../utils/request'
import type { ApiResponse } from '../types/api'

export interface ApiNotification {
  id: number
  title: string
  content: string
  actionUrl?: string
  actionLabel?: string
  read: boolean
  createdAt: string
}

export interface ListNotificationsResponse {
  list: ApiNotification[]
  total: number
  totalUnread: number
  totalRead: number
  page: number
  size: number
}

export function normalizeNotification(raw: any): ApiNotification | null {
  if (!raw || typeof raw !== 'object') return null
  const idRaw = raw.id ?? raw.ID
  const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) return null
  return {
    id,
    title: String(raw.title ?? raw.Title ?? ''),
    content: String(raw.content ?? raw.Content ?? ''),
    actionUrl: raw.actionUrl ?? raw.ActionURL ?? undefined,
    actionLabel: raw.actionLabel ?? raw.ActionLabel ?? undefined,
    read: Boolean(raw.read ?? raw.Read),
    createdAt: String(raw.createdAt ?? raw.created_at ?? raw.CreatedAt ?? ''),
  }
}

export async function listNotifications(params: {
  page: number
  size: number
}): Promise<ApiResponse<ListNotificationsResponse>> {
  const res = await get<ListNotificationsResponse>('/notification', params as any)
  const list = (res.data?.list ?? [])
    .map(normalizeNotification)
    .filter((n): n is ApiNotification => n != null)
  return {
    ...res,
    data: {
      ...res.data,
      list,
      total: res.data?.total ?? list.length,
      totalUnread: res.data?.totalUnread ?? 0,
      totalRead: res.data?.totalRead ?? 0,
      page: res.data?.page ?? params.page,
      size: res.data?.size ?? params.size,
    },
  }
}

export function markAllNotificationsRead(): Promise<ApiResponse<null>> {
  return post<null>('/notification/readAll')
}

export function markNotificationRead(id: number): Promise<ApiResponse<null>> {
  if (!Number.isFinite(id) || id <= 0) {
    return Promise.reject({ code: 400, msg: '无效的通知 ID' })
  }
  return put<null>(`/notification/read/${id}`)
}
