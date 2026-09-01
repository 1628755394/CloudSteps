import { get, post, del, put, ApiResponse } from '../utils/request'
import type { ReviewCurvePreset } from './auth'
import { normalizeSnowflakeId } from '../utils/json-snowflake'

type SnowflakeId = string | number

function studentIdPath(id: SnowflakeId): string {
  return normalizeSnowflakeId(id)
}

export type TeacherTeachingPoolSummary = {
  remainingMinutes: number
  totalAllocatedMinutes: number
}

export const getTeacherTeachingPool = async (): Promise<ApiResponse<TeacherTeachingPoolSummary>> => {
  return get<TeacherTeachingPoolSummary>('/teacher/coaching/teacher-pool')
}

export type CoachingWeekSchedule = {
  id: number
  title: string
  scheduledDate: string
  startTime: string
  endTime: string
  teacherId: number
  studentId: SnowflakeId
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

export const getTeacherCoachingWeek = async (
  date: string
): Promise<ApiResponse<{ schedules: CoachingWeekSchedule[] }>> => {
  return get<{ schedules: CoachingWeekSchedule[] }>('/teacher/coaching/week', { params: { date } })
}

export type TeacherCoachingQuotaRow = {
  id: number
  teacherId: number
  studentId: SnowflakeId
  remainingMinutes: number
  totalAllocatedMinutes?: number
  version?: number
  reviewTimes?: number
  reviewCurvePreset?: ReviewCurvePreset | string
  accent?: string
  preferredWordBookId?: number
  /** 词汇测评次数 */
  vocabTestCount?: number
  /** 与该老师的陪练完课次数 */
  coachingSessionCount?: number
  /** 单词训练等学习会话次数（学员维度） */
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
    reviewCurvePreset?: string
  }
}

/** 当前老师名下学员与陪练剩余分钟（游标分页） */
export const getTeacherCoachingQuotas = async (params?: {
  cursor?: string
  limit?: number
  q?: string
  /** 含注册自练额度（teacher=student）；学员管理默认不含 */
  includeSelf?: boolean
}): Promise<
  ApiResponse<{
    list: TeacherCoachingQuotaRow[]
    nextCursor?: string
    hasMore: boolean
    limit: number
  }>
> => {
  return get('/teacher/coaching/quotas', { params })
}

/** 兼容：取名下学员列表（下拉选择等场景一次拉满） */
export const listAllTeacherCoachingQuotas = async (opts?: {
  includeSelf?: boolean
}): Promise<TeacherCoachingQuotaRow[]> => {
  const res = await getTeacherCoachingQuotas({
    limit: 100,
    includeSelf: opts?.includeSelf,
  })
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

/** 学员活动时间线（游标分页 + 月筛选 + 统计） */
export const listStudentActivityRecordsAsTeacher = async (
  studentId: SnowflakeId,
  params?: {
    cursor?: string
    limit?: number
    month?: string
    q?: string
  }
): Promise<
  ApiResponse<{
    list: StudentActivityListItem[]
    nextCursor?: string
    hasMore: boolean
    limit: number
    stats: StudentActivityStats
  }>
> => {
  return get(`/teacher/coaching/students/${studentIdPath(studentId)}/vocab-records`, { params })
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
  studentId: SnowflakeId
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

export type StudentActivityKind = 'vocab_test' | 'coaching_session' | 'study_session'

export type StudentActivityListItem = {
  kind: StudentActivityKind
  id: number
  time: string
  title: string
  summary: string
  wordBookName?: string
  vocabTest?: VocabTestRecordDTO
  coachingSession?: CoachingSessionRecordDTO
  studySession?: StudySessionDTO
}

/** 合并：陪练完课 + 词汇测评 + 单词训练会话（游标分页见上方 listStudentActivityRecordsAsTeacher） */

export const getStudentVocabRecordAsTeacher = async (
  studentId: SnowflakeId,
  recordId: SnowflakeId
): Promise<ApiResponse<VocabTestRecordDTO>> => {
  return get<VocabTestRecordDTO>(
    `/teacher/coaching/students/${studentIdPath(studentId)}/vocab-records/${studentIdPath(recordId)}`
  )
}

export type StudentWordBookItem = {
  id: SnowflakeId
  name: string
  wordCount: number
}

/** 老师查看学员已分配词库 */
export const listStudentWordBooksAsTeacher = async (
  studentId: SnowflakeId
): Promise<ApiResponse<{ list: StudentWordBookItem[] }>> => {
  return get<{ list: StudentWordBookItem[] }>(
    `/teacher/coaching/students/${studentIdPath(studentId)}/wordbooks`
  )
}

/** 老师为学员添加词库 */
export const addStudentWordBookAsTeacher = async (
  studentId: SnowflakeId,
  wordBookId: SnowflakeId
): Promise<ApiResponse<StudentWordBookItem>> => {
  return post<StudentWordBookItem>(`/teacher/coaching/students/${studentIdPath(studentId)}/wordbooks`, {
    wordBookId: studentIdPath(wordBookId),
  })
}

/** 老师移除学员词库 */
export const removeStudentWordBookAsTeacher = async (
  studentId: SnowflakeId,
  wordBookId: SnowflakeId
): Promise<ApiResponse<{ studentId: number; wordBookId: number }>> => {
  return del(
    `/teacher/coaching/students/${studentIdPath(studentId)}/wordbooks/${studentIdPath(wordBookId)}`
  )
}

export const getStudentCoachingSessionAsTeacher = async (
  studentId: SnowflakeId,
  sessionId: SnowflakeId
): Promise<ApiResponse<CoachingSessionRecordDTO>> => {
  return get<CoachingSessionRecordDTO>(
    `/teacher/coaching/students/${studentIdPath(studentId)}/coaching-sessions/${studentIdPath(sessionId)}`
  )
}

export const getStudentStudySessionAsTeacher = async (
  studentId: SnowflakeId,
  sessionId: SnowflakeId
): Promise<ApiResponse<{ session: StudySessionDTO; wordBookName: string }>> => {
  return get<{ session: StudySessionDTO; wordBookName: string }>(
    `/teacher/coaching/students/${studentIdPath(studentId)}/study-sessions/${studentIdPath(sessionId)}`
  )
}

export const getStudentCoachingWeek = async (
  date: string
): Promise<ApiResponse<{ schedules: CoachingWeekSchedule[] }>> => {
  return get<{ schedules: CoachingWeekSchedule[] }>('/student/coaching/week', { params: { date } })
}

export const startCoachingAppointment = async (
  id: string | number
): Promise<ApiResponse<unknown>> => {
  return post(`/teacher/coaching/appointments/${normalizeSnowflakeId(id)}/start`)
}

export const endCoachingAppointment = async (
  id: string | number
): Promise<ApiResponse<unknown>> => {
  return post(`/teacher/coaching/appointments/${normalizeSnowflakeId(id)}/end`)
}

/** 无排课练习：按学员立即开课计时（结束仍走 appointments/:id/end） */
export const startPracticeSession = async (body: {
  studentId: string | number
  plannedMinutes?: number
}): Promise<
  ApiResponse<{
    appointmentId: SnowflakeId
    studentId: SnowflakeId
    owned: boolean
    reused?: boolean
    appointment?: CoachingWeekSchedule
  }>
> => {
  return post('/teacher/coaching/practice/start', body)
}

export type CoachingStudentSearchResult = {
  id: SnowflakeId
  username?: string
  displayName?: string
  phone?: string
  email?: string
}

export const searchCoachingStudents = async (
  q: string
): Promise<ApiResponse<CoachingStudentSearchResult[]>> => {
  return get<CoachingStudentSearchResult[]>('/teacher/coaching/students/search', { params: { q } })
}

export const addTeacherCoachingStudent = async (body: {
  studentId: SnowflakeId
  remainingMinutes: number
}): Promise<ApiResponse<TeacherCoachingQuotaRow>> => {
  return post<TeacherCoachingQuotaRow>('/teacher/coaching/quotas', body)
}

export type CreateTeacherStudentPayload = {
  displayName: string
  password?: string
  studyHours?: number
}

export type CreateTeacherStudentResult = {
  quota: TeacherCoachingQuotaRow
  student: {
    id: number
    username?: string
    displayName?: string
  }
  username?: string
  initialPassword?: string
}

/** 老师新建学员账号并建立陪练额度 */
export const createTeacherStudent = async (
  body: CreateTeacherStudentPayload
): Promise<ApiResponse<CreateTeacherStudentResult>> => {
  return post<CreateTeacherStudentResult>('/teacher/coaching/students', body)
}

/** 老师设置/重置学员登录密码；password 空则重置为 student123 */
export const setTeacherStudentPassword = async (
  studentId: SnowflakeId,
  password?: string
): Promise<ApiResponse<{ studentId: number; username?: string; password: string }>> => {
  return post(`/teacher/coaching/students/${studentIdPath(studentId)}/password`, {
    password: password ?? '',
  })
}

/** 老师从名下移除学员（解除陪练关系，不删除学员账号） */
export const removeTeacherStudent = async (
  studentId: SnowflakeId
): Promise<ApiResponse<{ studentId: number }>> => {
  return del(`/teacher/coaching/students/${studentIdPath(studentId)}`)
}

/** 老师为学员设置抗遗忘次数（艾宾浩斯曲线） */
export const setTeacherStudentReviewCurve = async (
  studentId: SnowflakeId,
  reviewCurvePreset: ReviewCurvePreset
): Promise<
  ApiResponse<{
    studentId: SnowflakeId
    reviewCurvePreset: string
    reviewTimes: number
    presetLabel?: string
  }>
> => {
  return put(`/teacher/coaching/students/${studentIdPath(studentId)}/review-curve`, {
    reviewCurvePreset,
  })
}

export const createTeacherCoachingAppointment = async (body: {
  studentId: SnowflakeId
  scheduledDate: string
  startTime: string
  endTime: string
  title?: string
  notes?: string
}): Promise<ApiResponse<CoachingWeekSchedule>> => {
  return post<CoachingWeekSchedule>('/teacher/coaching/appointments', body)
}

export const deleteTeacherCoachingAppointment = async (id: number): Promise<ApiResponse<unknown>> => {
  return del(`/teacher/coaching/appointments/${id}`)
}

export const getTeacherCoachingCompleted = async (params?: {
  from?: string
  to?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ schedules: CoachingWeekSchedule[]; total: number; page: number; pageSize: number }>> => {
  return get<{ schedules: CoachingWeekSchedule[]; total: number; page: number; pageSize: number }>(
    '/teacher/coaching/completed',
    { params }
  )
}
