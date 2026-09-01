import { get, post, put, ApiResponse } from '../utils/request'

export interface StudyWordItem {
  id: number
  word: string
  translation?: string
  phonetic?: string
  phoneticUk?: string
  phoneticUs?: string
  partOfSpeech?: string
  definition?: string
  audioUrl?: string
}

export interface StudyWordsResponse {
  total: number
  page: number
  pageSize: number
  words: StudyWordItem[]
  shuffle?: boolean
  seed?: number
}

export interface LighthouseDay {
  id: string
  count: number
  label: string
}

export interface StudyLighthouseResponse {
  days: LighthouseDay[]
  pendingCount?: number
  masteredCount?: number
  /** 今日首次计入「已学」的单词数 */
  todayNewLearned?: number
}

export interface StartStudySessionRequest {
  wordBookId: number
  knownIds: number[]
  unknownIds: number[]
  /** 老师代练时传当前学员 ID */
  studentId?: string
}

export interface StartStudySessionResponse {
  sessionId?: number
  words?: any[]
  finished?: boolean
}

export interface CompleteSessionResult {
  wordId: number
  remembered: boolean
}

export const getStudyWords = async (
  wordBookId: number,
  page: number = 1,
  pageSize: number = 20,
  opts?: { shuffle?: boolean; seed?: number }
): Promise<ApiResponse<StudyWordsResponse>> => {
  return get<StudyWordsResponse>('/study/words', {
    params: {
      wordBookId,
      page,
      pageSize,
      ...(opts?.shuffle ? { shuffle: 1, seed: opts.seed ?? 0 } : {}),
    },
  })
}

export const getStudyLighthouse = async (
  wordBookId: string | number
): Promise<ApiResponse<StudyLighthouseResponse>> => {
  return get<StudyLighthouseResponse>('/study/lighthouse', { params: { wordBookId } })
}

export const startStudySession = async (
  data: StartStudySessionRequest
): Promise<ApiResponse<StartStudySessionResponse>> => {
  return post<StartStudySessionResponse>('/study/session/start', data)
}

export interface LighthouseWordsResponse {
  words: StudyWordItem[]
  total: number
}

export const getLighthouseWords = async (
  wordBookId: number,
  step: string,
  page: number = 1,
  pageSize: number = 50
): Promise<ApiResponse<LighthouseWordsResponse>> => {
  return get<LighthouseWordsResponse>('/study/lighthouse/words', {
    params: { wordBookId, step, page, pageSize }
  })
}

export type LighthouseReviewSubmitResult = {
  wordId: number
  remembered: boolean
}

/** 九宫格「开始复习」：拉取所有已学未掌握词 */
export const getLighthouseReviewWords = async (
  wordBookId: string | number,
  opts?: { page?: number; pageSize?: number }
): Promise<ApiResponse<LighthouseWordsResponse>> => {
  const id = String(wordBookId).trim()
  return get<LighthouseWordsResponse>('/study/lighthouse/review-words', {
    params: {
      wordBookId: id,
      page: opts?.page ?? 1,
      pageSize: opts?.pageSize ?? 200,
    },
  })
}

/** 九宫格复习提交：对了推进一格，错了不推进 */
export const submitLighthouseReview = async (
  wordBookId: string | number,
  results: LighthouseReviewSubmitResult[]
): Promise<ApiResponse<{ advanced: number; unchanged: number }>> => {
  const id = String(wordBookId).trim()
  return post<{ advanced: number; unchanged: number }>('/study/lighthouse/review-submit', {
    wordBookId: id,
    results,
  })
}

export const completeStudySession = async (
  sessionId: number,
  results: CompleteSessionResult[]
): Promise<ApiResponse<null>> => {
  return post<null>(`/study/session/${sessionId}/complete`, { results })
}

export interface StudySessionListItem {
  id?: number
  sessionType: string
  status: string
  startedAt?: string
  completedAt?: string | null
  wordCount: number
  correctCount: number
  wordBookId?: number
  wordBookName?: string
  userId?: number
  /** groupBy=bookDay 时返回 */
  day?: string
  latestAt?: string
  sessionCount?: number
  sessionIds?: number[]
}

export interface StudySessionsListResponse {
  list: StudySessionListItem[]
  total: number
  page: number
  pageSize: number
  grouped?: boolean
}

/** 列出学习/复习会话；老师可传 studentId 做权限校验；groupBy=bookDay 按词库+日聚合 */
export const listStudySessions = async (params?: {
  page?: number
  pageSize?: number
  sessionType?: string
  studentId?: string | number
  date?: string
  dateFrom?: string
  dateTo?: string
  wordBookId?: number
  status?: string
  groupBy?: "bookDay"
}): Promise<ApiResponse<StudySessionsListResponse>> => {
  return get<StudySessionsListResponse>('/study/sessions', { params })
}

export interface StudySessionDTO {
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

export interface StudySessionDetail {
  session: StudySessionDTO
  words: StudyWordItem[]
}

export const getStudySessionDetail = async (
  sessionId: number
): Promise<ApiResponse<StudySessionDetail>> => {
  return get<StudySessionDetail>(`/study/session/${sessionId}`)
}

export type UpdatePracticeTimeRequest = {
  date: string
  startTime: string
  endTime: string
  studentId?: string
  sessionIds?: number[]
}

/** 课后设置识记练习时段（抗遗忘列表展示用） */
export const updateStudySessionsPracticeTime = async (
  data: UpdatePracticeTimeRequest
): Promise<ApiResponse<{ updated: number; sessionIds?: number[] }>> => {
  return put<{ updated: number; sessionIds?: number[] }>('/study/sessions/practice-time', data)
}

export type StudyExportWord = {
  id: number
  word: string
  phonetic?: string
  phoneticUk?: string
  phoneticUs?: string
  translation?: string
  partOfSpeech?: string
  audioUrl?: string
}

/** 一次拉取筛选条件下去重单词（导出用） */
export const exportStudySessionWords = async (params?: {
  sessionType?: string
  studentId?: string | number
  date?: string
  dateFrom?: string
  dateTo?: string
  wordBookId?: number
  status?: string
}): Promise<ApiResponse<{ words: StudyExportWord[]; total: number }>> => {
  return get<{ words: StudyExportWord[]; total: number }>('/study/sessions/export-words', { params })
}

