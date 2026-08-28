export type CloudUser = {
  id: number
  username?: string
  email?: string
  account?: string
  displayName?: string
  firstName?: string
  lastName?: string
  role?: string
  phone?: string
  locale?: string
  enabled?: boolean
  isDeleted?: boolean
  isStaff?: boolean
  lastLogin?: string | null
  lastLoginIP?: string
  loginCount?: number
  source?: string
  avatar?: string
  gender?: string
  city?: string
  region?: string
  streakDays?: number
  lastStudyDate?: string | null
  createdAt?: string
  updatedAt?: string
}

export function userDisplayName(user: CloudUser): string {
  const fullName = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
  return (
    user.displayName?.trim() ||
    fullName ||
    user.username?.trim() ||
    user.email?.trim() ||
    '未命名用户'
  )
}

export function userInitials(user: CloudUser): string {
  const name = userDisplayName(user)
  if (name === '未命名用户') return '?'
  const local = name.includes('@') ? name.slice(0, name.indexOf('@')) : name
  if (/[\u4e00-\u9fff]/.test(local)) return local.slice(0, 2)
  const parts = local.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export function roleLabel(role?: string): string {
  switch (role) {
    case 'admin':
      return '管理员'
    case 'teacher':
      return '教师'
    case 'student':
      return '学员'
    case 'user':
      return '用户'
    default:
      return role || '用户'
  }
}

const SOURCE_LABELS: Record<string, string> = {
  web: '网页注册',
  miniapp: '小程序',
  admin: '管理后台',
  teacher_create: '教师创建',
  seed: '种子数据',
}

export function sourceLabel(source?: string): string {
  const raw = source?.trim()
  if (!raw) return '—'
  const key = raw.toLowerCase()
  return SOURCE_LABELS[key] ?? raw
}

export function genderLabel(gender?: string): string {
  const value = gender?.trim().toLowerCase()
  if (!value) return '—'
  if (value === 'male' || value === 'm' || value === '男') return '男'
  if (value === 'female' || value === 'f' || value === '女') return '女'
  return gender?.trim() || '—'
}

export { formatDateTime } from '@/lib/datetime'

export function formatLocation(user: CloudUser): string {
  return (
    [user.region, user.city]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' · ') || '—'
  )
}
