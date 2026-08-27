/**
 * 老师新手引导 — 请与 web/src/utils/coachOnboarding.ts 保持步骤与 key 同步
 */
import Taro from '@tarojs/taro'

export type CoachOnboardingIcon =
  | 'welcome'
  | 'students'
  | 'picker'
  | 'schedule'
  | 'training'

export type CoachOnboardingStep = {
  id: string
  title: string
  body: string
  icon: CoachOnboardingIcon
  /** data-coach 锚点；缺省则居中卡片 */
  target?: string
}

/** 与 web 端文案保持一致 */
export const COACH_ONBOARDING_STEPS: CoachOnboardingStep[] = [
  {
    id: 'welcome',
    title: '欢迎来到云阶',
    body: '注册后你已是陪练老师。先添加学员，再开始测评与单词训练。',
    icon: 'welcome',
  },
  {
    id: 'students',
    title: '先添加学员',
    body: '点这里进入「学员管理」，新建或关联学员。没有学员时无法开始单词训练。',
    icon: 'students',
    target: 'students',
  },
  {
    id: 'picker',
    title: '选择当前学员',
    body: '在这里切换当前学员，词汇测试与单词训练都会绑定到所选学员。',
    icon: 'picker',
    target: 'picker',
  },
  {
    id: 'schedule',
    title: '备课与排课',
    body: '进入「备课」课表后，点击空格子即可排课；点已有课程可开始或下课。',
    icon: 'schedule',
    target: 'schedule',
  },
  {
    id: 'training',
    title: '开始单词训练',
    body: '选好学员后点这里：选词库 → 记忆灯塔 →「继续练习」。',
    icon: 'training',
    target: 'training',
  },
]

const DONE_VALUE = 'done'

export function coachOnboardingStorageKey(userId: number | string): string {
  return `cs_coach_onboarding_v1:${userId}`
}

export function isCoachOnboardingDone(userId: number | string): boolean {
  try {
    return Taro.getStorageSync(coachOnboardingStorageKey(userId)) === DONE_VALUE
  } catch {
    return false
  }
}

export function markCoachOnboardingDone(userId: number | string): void {
  try {
    Taro.setStorageSync(coachOnboardingStorageKey(userId), DONE_VALUE)
  } catch {
    // ignore
  }
}

export function isCoachRole(role?: string | null): boolean {
  return role === 'user' || role === 'teacher' || role === 'admin'
}

export function shouldShowCoachOnboarding(
  role: string | null | undefined,
  userId: number | string | null | undefined,
): boolean {
  if (!userId || !isCoachRole(role)) return false
  return !isCoachOnboardingDone(userId)
}

export type CoachTargetRect = {
  top: number
  left: number
  width: number
  height: number
}

/** 备课 tab：估算底栏第 2 项位置（首页旁） */
export function estimateLessonTabRect(): CoachTargetRect {
  const sys = Taro.getSystemInfoSync()
  const w = sys.windowWidth || 375
  const h = sys.windowHeight || 667
  const bottomInset =
    (sys as { safeAreaInsets?: { bottom?: number } }).safeAreaInsets?.bottom || 0
  const tabH = 50 + bottomInset
  const itemW = w / 5
  return {
    left: itemW,
    width: itemW,
    height: 48,
    top: h - tabH + 2,
  }
}

export function measureCoachTarget(
  target: string,
): Promise<CoachTargetRect | null> {
  if (target === 'schedule') {
    return Promise.resolve(estimateLessonTabRect())
  }
  return new Promise((resolve) => {
    try {
      Taro.createSelectorQuery()
        .select(`[data-coach="${target}"]`)
        .boundingClientRect((rect) => {
          const r = Array.isArray(rect) ? rect[0] : rect
          if (r && typeof r === 'object' && (r as CoachTargetRect).width > 2) {
            resolve({
              top: (r as CoachTargetRect).top,
              left: (r as CoachTargetRect).left,
              width: (r as CoachTargetRect).width,
              height: (r as CoachTargetRect).height,
            })
          } else {
            resolve(null)
          }
        })
        .exec()
    } catch {
      resolve(null)
    }
  })
}
