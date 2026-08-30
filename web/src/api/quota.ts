import { get, post, ApiResponse } from '../utils/request'

export type UserQuotaSummary = {
  remainingMinutes: number
  totalAllocatedMinutes: number
  checkedInToday: boolean
  dailyMinutes: number
}

export type CheckInResult = {
  minutesAwarded: number
  remainingMinutes: number
  totalAllocatedMinutes: number
  checkedInToday: boolean
}

export const getUserQuota = async (): Promise<ApiResponse<UserQuotaSummary>> => {
  return get<UserQuotaSummary>('/quota')
}

export const checkInDaily = async (): Promise<ApiResponse<CheckInResult>> => {
  return post<CheckInResult>('/quota/check-in')
}
