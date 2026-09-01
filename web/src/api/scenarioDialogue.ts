import { get, post, put, del, ApiResponse } from '@/utils/request'

export interface Scenario {
  id: number
  slug: string
  name: string
  description: string
  icon: string
  difficulty: string
  aiRole: string
  prompt?: string
  reviewStatus?: string
  rejectReason?: string
  isCustom?: boolean
  enabled?: boolean
}

export interface CustomScenarioPayload {
  name: string
  description?: string
  icon?: string
  difficulty?: string
  aiRole: string
  prompt: string
}

export interface ScenarioTurn {
  id: number
  role: 'user' | 'assistant'
  content: string
  hasCorrection: boolean
  hasPronunciation: boolean
  turnIndex: number
}

export interface ReviewAnalysis {
  turnCount: number
  userWordCount: number
  englishRatio: number
  wordsPerMinute: number
  avgWordsPerTurn: number
  uniqueWordCount: number
  chineseCharCount: number
  chineseTurnCount: number
  shortTurnCount: number
  explicitCorrections: number
  implicitCorrections: number
  fluencyScore: number
  accuracyScore: number
  pronunciationScore: number
  vocabularyScore: number
  participationScore: number
  overallScore: number
  highlights: string[]
  issues: string[]
  suggestions: string[]
  nextSteps: string[]
  aiAnalysis: string
}

export interface ScenarioSession {
  id: number
  scenarioId: number
  status: string
  startedAt?: string
  endedAt?: string
  durationSec: number
  fluencyScore: number
  accuracyScore: number
  pronunciationScore: number
  overallScore: number
  turnCount: number
  userWordCount: number
  correctionCount: number
  pronunciationHints: number
  reviewSummary: string
  analysis?: ReviewAnalysis
  scenario?: Scenario
  turns?: ScenarioTurn[]
}

export interface VoiceReadyStatus {
  ready: boolean
  provider: string
  hint: string
}

export interface StartSessionResponse {
  sessionId: number
  deviceId: string
  wsPath: string
  scenario: Scenario
  voiceReady: VoiceReadyStatus
}

export interface SpeakingStats {
  totalSessions: number
  totalMinutes: number
  avgOverallScore: number
  avgFluencyScore: number
  avgAccuracyScore: number
  avgPronunciationScore: number
  totalCorrections: number
  recentSessions: ScenarioSession[]
}

export const listScenarios = () =>
  get<Scenario[]>('/scenario-dialogue/scenarios')

export const listMyScenarios = () =>
  get<Scenario[]>('/scenario-dialogue/custom/scenarios')

export const createCustomScenario = (payload: CustomScenarioPayload) =>
  post<Scenario>('/scenario-dialogue/custom/scenarios', payload)

export const updateCustomScenario = (id: number, payload: CustomScenarioPayload) =>
  put<Scenario>(`/scenario-dialogue/custom/scenarios/${id}`, payload)

export const deleteCustomScenario = (id: number) =>
  del<void>(`/scenario-dialogue/custom/scenarios/${id}`)

export const startSession = (scenarioId: number) =>
  post<StartSessionResponse>('/scenario-dialogue/sessions', { scenarioId })

export const getSession = (sessionId: number) =>
  get<ScenarioSession>(`/scenario-dialogue/sessions/${sessionId}`)

export const completeSession = (sessionId: number) =>
  post<ScenarioSession>(`/scenario-dialogue/sessions/${sessionId}/complete`, {})

export const getSpeakingStats = () =>
  get<SpeakingStats>('/scenario-dialogue/stats')

export const getVoiceReady = () =>
  get<VoiceReadyStatus>('/scenario-dialogue/voice/ready')

export const activateSession = (sessionId: number) =>
  post(`/scenario-dialogue/sessions/${sessionId}/activate`, {})

export const recordTurn = (sessionId: number, role: 'user' | 'assistant', content: string) =>
  post(`/scenario-dialogue/sessions/${sessionId}/turns`, { role, content })
