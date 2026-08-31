import { get, post, put, ApiResponse } from '../utils/request'
import i18n from '../i18n'

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

/** Normalize backend / legacy PascalCase inbox rows into a stable client shape. */
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

export const listNotifications = async (params: {
  page: number
  size: number
}): Promise<ApiResponse<ListNotificationsResponse>> => {
  const res = await get<ListNotificationsResponse>('/notification', { params })
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

export const markAllNotificationsRead = async (): Promise<ApiResponse<null>> => {
  return post<null>('/notification/readAll')
}

export const markNotificationRead = async (id: number): Promise<ApiResponse<null>> => {
  if (!Number.isFinite(id) || id <= 0) {
    return Promise.reject({ code: 400, msg: i18n.t('notification.invalid_id') })
  }
  return put<null>(`/notification/read/${id}`)
}

export const getUnreadNotificationCount = async (): Promise<number> => {
  const res = await get<number | { count?: number }>('/notification/unread-count')
  const data = res.data
  if (typeof data === 'number' && Number.isFinite(data)) return Math.max(0, data)
  if (data && typeof data === 'object' && typeof data.count === 'number') {
    return Math.max(0, data.count)
  }
  return 0
}
