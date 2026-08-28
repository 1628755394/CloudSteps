import { formatDateTime } from '@/lib/datetime'

const roleLabel: Record<string, string> = {
  admin: '管理员',
  teacher: '教师',
  student: '学员',
}

const genderLabel: Record<string, string> = {
  male: '男',
  m: '男',
  男: '男',
  female: '女',
  f: '女',
  女: '女',
}

export type ProfileInfo = {
  id?: number
  username?: string
  email?: string
  account?: string
  displayName?: string
  phone?: string
  role?: string
  firstName?: string
  lastName?: string
  locale?: string
  gender?: string
  city?: string
  region?: string
  lastLogin?: string | null
  loginCount?: number
  lastStudyDate?: string | null
  createdAt?: string | null
}

export type ProfileField = {
  label: string
  value: string
}

export function looksLikeEmail(value?: string | null) {
  const v = value?.trim() ?? ''
  return v.includes('@') && !v.startsWith('@') && !v.endsWith('@')
}

function filled(value?: string | number | null) {
  if (value === undefined || value === null) return ''
  const text = String(value).trim()
  return text === '' || text === '—' ? '' : text
}

function location(info: ProfileInfo) {
  return [info.region, info.city].map((p) => p?.trim()).filter(Boolean).join(' · ')
}

function fullName(info: ProfileInfo) {
  return [info.firstName, info.lastName].map((p) => p?.trim()).filter(Boolean).join(' ')
}

export function profileFields(info: ProfileInfo | null): ProfileField[] {
  if (!info) return []
  const role = info.role || ''
  const gender = info.gender?.trim().toLowerCase() || ''
  const rows: Array<ProfileField | null> = [
    { label: '账号', value: filled(info.account || info.username) || '—' },
    looksLikeEmail(info.email) ? { label: '邮箱', value: info.email!.trim() } : null,
    { label: '角色', value: roleLabel[role] || filled(role) || '—' },
    { label: '用户 ID', value: info.id != null ? String(info.id) : '—' },
    filled(fullName(info)) ? { label: '姓名', value: fullName(info) } : null,
    filled(genderLabel[gender] || info.gender)
      ? { label: '性别', value: genderLabel[gender] || info.gender!.trim() }
      : null,
    filled(info.locale) ? { label: '语言', value: info.locale!.trim() } : null,
    filled(location(info)) ? { label: '地区', value: location(info) } : null,
    { label: '上次登录', value: formatDateTime(info.lastLogin) },
    { label: '登录次数', value: String(info.loginCount ?? 0) },
    formatDateTime(info.lastStudyDate) !== '—'
      ? { label: '最近学习', value: formatDateTime(info.lastStudyDate) }
      : null,
    { label: '注册时间', value: formatDateTime(info.createdAt) },
  ]
  return rows.filter((row): row is ProfileField => row != null)
}
