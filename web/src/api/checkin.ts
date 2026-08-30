import { get, post, ApiResponse } from '../utils/request'

export type CheckInRewardTier = {
  days: number
  minutes: number
}

export type CheckInStatus = {
  checkedInToday: boolean
  currentStreak: number
  longestStreak: number
  yearCheckIns: number
  dailyReward: number
  nextStreakBonusDays?: number | null
  nextStreakBonusMinutes?: number | null
  poolRemainingMinutes: number
  monthMask: boolean[]
  monthStartWeekday: number
  recentMask: boolean[]
  recentStartWeekday: number
  recentDays: number
  recentStartDate: string
  rewardPreview?: CheckInRewardTier[]
}

export type CheckInResult = {
  alreadyCheckedIn: boolean
  grantedMinutes: number
  dailyMinutes: number
  bonusMinutes: number
  currentStreak: number
  longestStreak: number
  poolRemainingMinutes: number
}

export const getCheckInStatus = async (): Promise<ApiResponse<CheckInStatus>> => {
  return get<CheckInStatus>('/teacher/checkin')
}

export const postCheckIn = async (): Promise<ApiResponse<CheckInResult>> => {
  return post<CheckInResult>('/teacher/checkin')
}
