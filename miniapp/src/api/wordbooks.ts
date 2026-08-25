/**
 * 词库 API — 对齐 web/src/api/wordbooks.ts
 */
import { get } from '../utils/request'
import type { ApiResponse } from '../types/api'

export interface WordBookItem {
  id: number
  name: string
  level?: string
  wordCount?: number
  category?: string
  description?: string
}

export interface WordBookListResult {
  list: WordBookItem[]
  total: number
  page: number
  pageSize: number
}

export interface WordBookGroup {
  key: string
  label: string
}

export function listWordBooks(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  level?: string
  category?: string
  group?: string
}): Promise<ApiResponse<WordBookListResult & { groups: WordBookGroup[] }>> {
  return get<WordBookListResult & { groups: WordBookGroup[] }>('/wordbooks', {
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20,
    keyword: params?.keyword || undefined,
    level: params?.level || undefined,
    category: params?.category || undefined,
    group: params?.group || undefined,
  } as any)
}

export interface WordBookDetail extends WordBookItem {}

export function getWordBook(id: number): Promise<ApiResponse<WordBookDetail>> {
  return get<WordBookDetail>(`/wordbooks/${id}`)
}

export interface WordBookWord {
  id: number
  wordBookId: number
  word: string
  phonetic?: string
  phoneticUs?: string
  phoneticUk?: string
  translation?: string
  definition?: string
  partOfSpeech?: string
  exampleSentence?: string
  audioUrl?: string
}

export function listWordBookWords(
  wordBookId: number,
  params: { page: number; pageSize: number; keyword?: string }
): Promise<ApiResponse<{ list: WordBookWord[]; total: number; page: number; pageSize: number }>> {
  return get<{ list: WordBookWord[]; total: number; page: number; pageSize: number }>(
    `/wordbooks/${wordBookId}/words`,
    { page: params.page, pageSize: params.pageSize, keyword: params.keyword || undefined } as any
  )
}

export interface WordDetail {
  id: number
  word: string
  phonetic?: string
  phoneticUk?: string
  phoneticUs?: string
  translation?: string
  partOfSpeech?: string
  definition?: string
  audioUrl?: string
  imageUrl?: string
  syllables?: string
  etymology?: string
  morphology?: string
  derivations?: string
  synonyms?: string
  antonyms?: string
  wordFamily?: string
  collocations?: string
  exampleSentences?: string
  usageNotes?: string
  grammarPatterns?: string
  homophones?: string
  mnemonic?: string
  tags?: string
}

export function getWordDetail(id: number): Promise<ApiResponse<WordDetail>> {
  return get<WordDetail>(`/words/${id}`)
}
