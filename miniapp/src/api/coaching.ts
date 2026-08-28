/**
 * 陪练 API — 对齐 web/src/api/coaching.ts
 */
import { get, post, del } from '../utils/request'
import type { ApiResponse } from '../types/api'

export type CoachingWeekSchedule = {
  id: number
  title: string
  scheduledDate: string
  startTime: string
  endTime: string
  teacherId: number
  studentId: number
  status: string
  students?: string[]
  session?: {
    status?: string
    startedAt?: string
    endedAt?: string
    scheduledEndAt?: string
    plannedMinutes?: number
    actualMinutes?: number
    billedMinutes?: number
    teacherCreditedMinutes?: number
  }
}

export function getTeacherCoachingWeek(date: string): Promise<ApiResponse<{ schedules: CoachingWeekSchedule[] }>> {
  return get<{ schedules: CoachingWeekSchedule[] }>('/teacher/coaching/week', { date } as any)
}

export type TeacherCoachingQuotaRow = {
  id: number
  teacherId: number
  studentId: number
  remainingMinutes: number
  totalAllocatedMinutes?: number
  reviewTimes?: number
  accent?: string
  preferredWordBookId?: number
  vocabTestCount?: number
  coachingSessionCount?: number
  studySessionCount?: number
  latestVocabLevel?: string
  latestVocabTestAt?: string
  latestEstimatedVocab?: number
  student?: {
    displayName?: string
    username?: string
    email?: string
    phone?: string
    avatar?: string
    role?: string
    city?: string
    region?: string
  }
}

export function getTeacherCoachingQuotas(params?: {
  cursor?: string
  limit?: number
  q?: string
  includeSelf?: boolean
}): Promise<ApiResponse<{
  list: TeacherCoachingQuotaRow[]
  nextCursor?: string
  hasMore: boolean
  limit: number
}>> {
  return get('/teacher/coaching/quotas', params as any)
}

export async function listAllTeacherCoachingQuotas(opts?: {
  includeSelf?: boolean
}): Promise<TeacherCoachingQuotaRow[]> {
  const res = await getTeacherCoachingQuotas({ limit: 100, includeSelf: opts?.includeSelf })
  if (res.code !== 200) return []
  const data = res.data as unknown
  if (Array.isArray(data)) return data as TeacherCoachingQuotaRow[]
  if (data && typeof data === 'object' && Array.isArray((data as { list?: unknown }).list)) {
    return (data as { list: TeacherCoachingQuotaRow[] }).list
  }
  return []
}

export type StudentActivityStats = {
  total: number
  coaching: number
  vocab: number
  study: number
  vocabAvgCorrectRate: number
  vocabTotalQuestions: number
  vocabCorrectCount?: number
}

export type VocabTestRecordDTO = {
  id: number
  userId: number
  studentId?: number
  estimatedLevel: string
  estimatedVocab: number
  answers?: string
  questionCount: number
  correctCount: number
  completedAt?: string | null
  createdAt?: string
}

export type CoachingSessionRecordDTO = {
  id: number
  appointmentId: number
  teacherId: number
  studentId: number
  startedAt: string
  endedAt: string
  actualMinutes: number
  billedMinutes: number
  teacherCreditedMinutes: number
  status: string
  appointment?: {
    title?: string
    scheduledDate?: string
    startTime?: string
    endTime?: string
  }
}

export type StudySessionDTO = {
  id: number
  userId: number
  wordBookId: number
  sessionType: string
  status: string
  startedAt: string
  completedAt?: string | null
  wordCount: number
  correctCount: number
}

export type StudentActivityListItem = {
  kind: 'vocab_test' | 'coaching_session' | 'study_session'
  id: number
  time: string
  title: string
  summary: string
  wordBookName?: string
  vocabTest?: VocabTestRecordDTO
  coachingSession?: CoachingSessionRecordDTO
  studySession?: StudySessionDTO
}

export function listStudentActivityRecordsAsTeacher(
  studentId: number,
  params?: { cursor?: string; limit?: number; month?: string; q?: string }
): Promise<ApiResponse<{
  list: StudentActivityListItem[]
  nextCursor?: string
  hasMore: boolean
  limit: number
  stats: StudentActivityStats
}>> {
  return get(`/teacher/coaching/students/${studentId}/vocab-records`, params as any)
}

export function getStudentCoachingWeek(date: string): Promise<ApiResponse<{ schedules: CoachingWeekSchedule[] }>> {
  return get<{ schedules: CoachingWeekSchedule[] }>('/student/coaching/week', { date } as any)
}

export function startCoachingAppointment(id: number): Promise<ApiResponse<unknown>> {
  return post(`/teacher/coaching/appointments/${id}/start`)
}

export function endCoachingAppointment(id: number): Promise<ApiResponse<unknown>> {
  return post(`/teacher/coaching/appointments/${id}/end`)
}

export function startPracticeSession(body: {
  studentId: number
  plannedMinutes?: number
}): Promise<ApiResponse<{
  appointmentId: number
  studentId: number
  owned: boolean
  reused?: boolean
  appointment?: CoachingWeekSchedule
}>> {
  return post('/teacher/coaching/practice/start', body)
}

export type CoachingStudentSearchResult = {
  id: number
  username?: string
  displayName?: string
  phone?: string
  email?: string
}

export function searchCoachingStudents(q: string): Promise<ApiResponse<CoachingStudentSearchResult[]>> {
  return get<CoachingStudentSearchResult[]>('/teacher/coaching/students/search', { q } as any)
}

export function addTeacherCoachingStudent(body: {
  studentId: number
  remainingMinutes: number
}): Promise<ApiResponse<TeacherCoachingQuotaRow>> {
  return post<TeacherCoachingQuotaRow>('/teacher/coaching/quotas', body)
}

export type CreateTeacherStudentPayload = {
  displayName: string
  password?: string
  studyHours?: number
}

export type CreateTeacherStudentResult = {
  quota: TeacherCoachingQuotaRow
  student: { id: number; username?: string; displayName?: string }
  username?: string
  initialPassword?: string
}

export function createTeacherStudent(body: CreateTeacherStudentPayload): Promise<ApiResponse<CreateTeacherStudentResult>> {
  return post<CreateTeacherStudentResult>('/teacher/coaching/students', body)
}

export function setTeacherStudentPassword(
  studentId: number,
  password?: string
): Promise<ApiResponse<{ studentId: number; username?: string; password: string }>> {
  return post(`/teacher/coaching/students/${studentId}/password`, { password: password ?? '' })
}

export function createTeacherCoachingAppointment(body: {
  studentId: number
  scheduledDate: string
  startTime: string
  endTime: string
  title?: string
}): Promise<ApiResponse<CoachingWeekSchedule>> {
  return post<CoachingWeekSchedule>('/teacher/coaching/appointments', body)
}

export function deleteTeacherCoachingAppointment(id: number): Promise<ApiResponse<unknown>> {
  return del(`/teacher/coaching/appointments/${id}`)
}

export function getTeacherCoachingCompleted(params?: {
  from?: string
  to?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ schedules: CoachingWeekSchedule[]; total: number; page: number; pageSize: number }>> {
  return get<{ schedules: CoachingWeekSchedule[]; total: number; page: number; pageSize: number }>(
    '/teacher/coaching/completed', params as any
  )
}

export type StudentWordBookItem = { id: number; name: string; wordCount: number }

export function listStudentWordBooksAsTeacher(studentId: number): Promise<ApiResponse<{ list: StudentWordBookItem[] }>> {
  return get<{ list: StudentWordBookItem[] }>(`/teacher/coaching/students/${studentId}/wordbooks`)
}

export function addStudentWordBookAsTeacher(studentId: number, wordBookId: number): Promise<ApiResponse<StudentWordBookItem>> {
  return post<StudentWordBookItem>(`/teacher/coaching/students/${studentId}/wordbooks`, { wordBookId })
}

export function removeStudentWordBookAsTeacher(studentId: number, wordBookId: number): Promise<ApiResponse<{ studentId: number; wordBookId: number }>> {
  return del(`/teacher/coaching/students/${studentId}/wordbooks/${wordBookId}`)
}
