/**
 * 学习 API — 对齐 web/src/api/study.ts
 */
import { get, post } from '../utils/request'
import type { ApiResponse } from '../types/api'

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
  todayNewLearned?: number
}

export interface StartStudySessionRequest {
  wordBookId: number
  knownIds: number[]
  unknownIds: number[]
}

export interface StartStudySessionResponse {
  sessionId: number
  words: any[]
}

export interface CompleteSessionResult {
  wordId: number
  remembered: boolean
}

export function getStudyWords(
  wordBookId: number,
  page: number = 1,
  pageSize: number = 20,
  opts?: { shuffle?: boolean; seed?: number }
): Promise<ApiResponse<StudyWordsResponse>> {
  return get<StudyWordsResponse>('/study/words', {
    wordBookId,
    page,
    pageSize,
    ...(opts?.shuffle ? { shuffle: 1, seed: opts.seed ?? 0 } : {}),
  } as any)
}

export function getStudyLighthouse(wordBookId: number): Promise<ApiResponse<StudyLighthouseResponse>> {
  return get<StudyLighthouseResponse>('/study/lighthouse', { wordBookId } as any)
}

export function startStudySession(
  data: StartStudySessionRequest
): Promise<ApiResponse<StartStudySessionResponse>> {
  return post<StartStudySessionResponse>('/study/session/start', data)
}

export interface LighthouseWordsResponse {
  words: StudyWordItem[]
  total: number
}

export function getLighthouseWords(
  wordBookId: number,
  step: string,
  page: number = 1,
  pageSize: number = 50
): Promise<ApiResponse<LighthouseWordsResponse>> {
  return get<LighthouseWordsResponse>('/study/lighthouse/words', {
    wordBookId, step, page, pageSize,
  } as any)
}

export function completeStudySession(
  sessionId: number,
  results: CompleteSessionResult[]
): Promise<ApiResponse<null>> {
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

export function listStudySessions(params?: {
  page?: number
  pageSize?: number
  sessionType?: string
  studentId?: number
  date?: string
  dateFrom?: string
  dateTo?: string
  wordBookId?: number
  status?: string
  groupBy?: 'bookDay'
}): Promise<ApiResponse<StudySessionsListResponse>> {
  return get<StudySessionsListResponse>('/study/sessions', params as any)
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

export function getStudySessionDetail(sessionId: number): Promise<ApiResponse<StudySessionDetail>> {
  return get<StudySessionDetail>(`/study/session/${sessionId}`)
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

export function exportStudySessionWords(params?: {
  sessionType?: string
  studentId?: number
  date?: string
  dateFrom?: string
  dateTo?: string
  wordBookId?: number
  status?: string
}): Promise<ApiResponse<{ words: StudyExportWord[]; total: number }>> {
  return get<{ words: StudyExportWord[]; total: number }>('/study/sessions/export-words', params as any)
}
