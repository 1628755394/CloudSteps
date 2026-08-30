export type LoginHistoryItem = {
  id: number
  userId?: number
  email?: string
  ipAddress?: string
  location?: string
  country?: string
  city?: string
  userAgent?: string
  deviceId?: string
  loginType?: string
  success?: boolean
  failureReason?: string
  isSuspicious?: boolean
  createdAt?: string
  updatedAt?: string
}

export function loginTypeLabel(type?: string): string {
  switch (type) {
    case 'email':
      return '邮箱'
    case 'password':
      return '密码'
    case 'phone':
      return '手机'
    case 'wechat':
      return '微信'
    case 'oauth':
      return 'OAuth'
    default:
      return type?.trim() || '—'
  }
}

export function loginPlace(row: LoginHistoryItem): string {
  const parts = [row.country, row.city, row.location]
    .map((part) => part?.trim())
    .filter(Boolean)
  return [...new Set(parts)].join(' · ') || '—'
}

export function loginUserLabel(row: LoginHistoryItem): string {
  return row.email?.trim() || (row.userId ? `用户 #${row.userId}` : '—')
}

export function shortUserAgent(ua?: string): string {
  if (!ua?.trim()) return '—'
  if (/iPhone|iPad/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Linux/i.test(ua)) return 'Linux'
  return ua.length > 36 ? `${ua.slice(0, 36)}…` : ua
}

export function loginResultLabel(row: LoginHistoryItem): string {
  return row.success === false ? '失败' : '成功'
}

export function loginHistoryQuery(result: string): {
  success?: string
  is_suspicious?: string
} {
  if (result === 'success') return { success: 'true' }
  if (result === 'failed') return { success: 'false' }
  if (result === 'suspicious') return { is_suspicious: 'true' }
  return {}
}
