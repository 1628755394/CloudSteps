export type CoachingPerson = {
  id?: number
  username?: string
  displayName?: string
  email?: string
}

export function personLabel(
  person?: CoachingPerson | null,
  id?: number
): string {
  if (person?.displayName) return person.displayName
  if (person?.username) return person.username
  if (person?.email) return person.email
  if (id) return `#${id}`
  return '—'
}

export function formatMinutes(mins: number): string {
  if (!Number.isFinite(mins)) return '—'
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h} 小时 ${m} 分` : `${h} 小时`
  }
  return `${mins} 分钟`
}

export function capLabel(cap: number): string {
  if (cap <= 0) return '不限制'
  return formatMinutes(cap)
}

export function monthFromPeriodStart(periodStart?: string): string {
  if (!periodStart) return ''
  return periodStart.slice(0, 7)
}

export type StudentQuotaRow = {
  id: number
  teacherId: number
  studentId: number
  remainingMinutes: number
  totalAllocatedMinutes: number
  teacher?: CoachingPerson
  student?: CoachingPerson
}

export type TeacherUsageRow = {
  id: number
  teacherId: number
  periodStart: string
  periodEnd: string
  capMinutes: number
  usedMinutes: number
  teacher?: CoachingPerson
}
