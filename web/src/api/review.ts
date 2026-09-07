import { get, post, ApiResponse } from '../utils/request'

export interface ReviewWordItem {
  id: number
  word: string
}

export interface ReviewTodayResponse {
  words: ReviewWordItem[]
}

export interface StartReviewSessionRequest {
  wordBookId: string | number
  wordIds?: number[]
  studentId?: string | number
}

export interface StartReviewSessionResponse {
  sessionId?: string | number
  words?: any[]
  /** 无到期复习词时为 true */
  finished?: boolean
}

export interface CompleteReviewResult {
  wordId: string | number
  remembered: boolean
}

export const getReviewToday = async (
  wordBookId: string | number,
  opts?: {
    date?: string
    timeZone?: string
    limit?: number
    /** Snowflake-safe string; never coerce with Number() */
    studySessionId?: string | number
    all?: boolean
    studentId?: string | number
  }
): Promise<ApiResponse<ReviewTodayResponse>> => {
  const id = String(wordBookId).trim()
  if (!id || id === '0') {
    return { code: 400, msg: 'wordBookId required', data: { words: [] } } as ApiResponse<ReviewTodayResponse>
  }
  const tz = opts?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
  const studySessionId =
    opts?.studySessionId != null && String(opts.studySessionId).trim() !== '' && String(opts.studySessionId) !== '0'
      ? String(opts.studySessionId).trim()
      : undefined
  return get<ReviewTodayResponse>('/review/today', {
    params: {
      wordBookId: id,
      ...(opts?.date ? { date: opts.date } : {}),
      timeZone: tz,
      ...(opts?.limit ? { limit: opts.limit } : {}),
      ...(studySessionId ? { studySessionId } : {}),
      ...(opts?.all ? { all: 'true' } : {}),
      ...(opts?.studentId ? { studentId: String(opts.studentId) } : {}),
    },
  })
}

export type ReviewBookStatRow = {
  studentId?: string | number
  studentName?: string
  wordBookId: string | number
  cnt: number
  name: string
  level: string
  sessionId?: string | number
  practiceStartedAt?: string
  practiceEndedAt?: string | null
}

export const listReviewBooks = async (): Promise<ApiResponse<ReviewBookStatRow[]>> => {
  return get<ReviewBookStatRow[]>('/review/books')
}

/** 按本地自然日统计各词库待复习词数（与抗遗忘页日期联动） */
export const listReviewBooksByDate = async (
  date: string,
  timeZone?: string
): Promise<ApiResponse<ReviewBookStatRow[]>> => {
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
  return get<ReviewBookStatRow[]>('/review/books-by-date', { params: { date, timeZone: tz } })
}

export const startReviewSession = async (
  data: StartReviewSessionRequest
): Promise<ApiResponse<StartReviewSessionResponse>> => {
  return post<StartReviewSessionResponse>('/review/session/start', data)
}

export const completeReviewSession = async (
  sessionId: string | number,
  results: CompleteReviewResult[]
): Promise<ApiResponse<null>> => {
  const id = String(sessionId).trim()
  return post<null>(`/review/session/${id}/complete`, { results })
}
