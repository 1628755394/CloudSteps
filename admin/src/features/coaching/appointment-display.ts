export type CoachingPerson = {
  id?: number
  username?: string
  displayName?: string
  email?: string
}

export type CoachingSession = {
  id?: number
  status?: string
  startedAt?: string
  endedAt?: string
  actualMinutes?: number
  billedMinutes?: number
  teacherCreditedMinutes?: number
}

export type CoachingAppointment = {
  id: number
  teacherId?: number
  studentId?: number
  scheduledDate?: string
  startTime?: string
  endTime?: string
  durationMinutes?: number
  status?: string
  title?: string
  notes?: string
  actualStartedAt?: string
  teacher?: CoachingPerson
  student?: CoachingPerson
  session?: CoachingSession
}

export type StatusBadge = {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function weekRange(now = new Date()): { from: string; to: string } {
  const fromMon = (now.getDay() + 6) % 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - fromMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: formatLocalDate(mon), to: formatLocalDate(sun) }
}

export function monthRange(now = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: formatLocalDate(from), to: formatLocalDate(to) }
}

export function formatScheduleDate(raw?: string): string {
  if (!raw) return '—'
  if (raw.length >= 10 && raw[4] === '-' && raw[7] === '-') {
    return raw.slice(0, 10)
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : formatLocalDate(d)
}

export function slotLabel(start?: string, end?: string): string {
  const a = start?.trim()
  const b = end?.trim()
  if (a && b) return `${a}–${b}`
  return a || b || '—'
}

export function personLabel(
  person?: CoachingPerson | null,
  fallbackId?: number
): string {
  const name =
    person?.displayName?.trim() ||
    person?.username?.trim() ||
    person?.email?.trim()
  if (name) return name
  if (fallbackId && fallbackId > 0) return `#${fallbackId}`
  return '—'
}

export function appointmentTitle(row: CoachingAppointment): string {
  return (
    row.title?.trim() ||
    personLabel(row.student, row.studentId) ||
    `排课 #${row.id}`
  )
}

export function statusBadge(status?: string): StatusBadge {
  switch (status) {
    case 'completed':
      return { label: '已完成', variant: 'secondary' }
    case 'in_progress':
      return { label: '进行中', variant: 'default' }
    case 'cancelled':
      return { label: '已取消', variant: 'destructive' }
    case 'no_show':
      return { label: '未到课', variant: 'outline' }
    case 'scheduled':
      return { label: '已排课', variant: 'outline' }
    default:
      return { label: status?.trim() || '未知', variant: 'outline' }
  }
}
