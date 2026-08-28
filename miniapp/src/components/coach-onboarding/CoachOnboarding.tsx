/**
 * 老师新手引导 — 蒙层挖洞 + 指向锚点（对齐 web CoachOnboarding）
 */
import { useCallback, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Star, Plus, User, Clock, List } from '@nutui/icons-react-taro'
import { CloudButton } from '../button'
import { color } from '../../styles/tokens'
import {
  COACH_ONBOARDING_STEPS,
  markCoachOnboardingDone,
  measureCoachTarget,
  type CoachOnboardingIcon,
  type CoachTargetRect,
} from '../../utils/coachOnboarding'
import './coach-onboarding.scss'

type Props = {
  open: boolean
  userId: number
  onDone: () => void
}

const PAD = 6

function StepIcon({ name }: { name: CoachOnboardingIcon }) {
  const c = color.primary
  switch (name) {
    case 'welcome':
      return <Star size={22} color={c} />
    case 'students':
      return <Plus size={22} color={c} />
    case 'picker':
      return <User size={22} color={c} />
    case 'schedule':
      return <Clock size={22} color={c} />
    case 'training':
      return <List size={22} color={c} />
  }
}

export function CoachOnboarding({ open, userId, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [hole, setHole] = useState<CoachTargetRect | null>(null)

  const current = COACH_ONBOARDING_STEPS[step]
  const total = COACH_ONBOARDING_STEPS.length
  const isLast = step >= total - 1
  const hasTarget = Boolean(current?.target)

  const remountMeasure = useCallback(() => {
    const target = COACH_ONBOARDING_STEPS[step]?.target
    if (!target) {
      setHole(null)
      return
    }
    void measureCoachTarget(target).then((r) => setHole(r))
    // 布局稳定后再量一次
    setTimeout(() => {
      void measureCoachTarget(target).then((r) => setHole(r))
    }, 160)
  }, [step])

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    remountMeasure()
  }, [open, remountMeasure])

  // 一旦展示过就写入本地缓存，避免下次进入重复弹出
  useEffect(() => {
    if (!open || !userId) return
    markCoachOnboardingDone(userId)
  }, [open, userId])

  if (!open || !current) return null

  const finish = (goAddStudent: boolean) => {
    markCoachOnboardingDone(userId)
    onDone()
    if (goAddStudent) {
      Taro.navigateTo({ url: '/pages/my-students/index' })
    }
  }

  const goNext = () => {
    if (isLast) {
      finish(true)
      return
    }
    setStep((s) => s + 1)
  }

  const goPrev = () => {
    if (step <= 0) return
    setStep((s) => s - 1)
  }

  const tip = (
    <View className="coach-ob__tip">
      <View className="coach-ob__top">
        <Text className="coach-ob__progress">
          {step + 1} / {total}
        </Text>
        <Text className="coach-ob__skip" onClick={() => finish(false)}>
          跳过
        </Text>
      </View>
      <View className="coach-ob__row">
        <View className="coach-ob__icon-wrap coach-ob__icon-wrap--sm">
          <StepIcon name={current.icon} />
        </View>
        <View className="coach-ob__copy">
          <Text className="coach-ob__title">{current.title}</Text>
          <Text className="coach-ob__desc">{current.body}</Text>
        </View>
      </View>
      <View className="coach-ob__dots">
        {COACH_ONBOARDING_STEPS.map((s, i) => (
          <View
            key={s.id}
            className={`coach-ob__dot ${i === step ? 'coach-ob__dot--active' : ''}`}
          />
        ))}
      </View>
      <View className="coach-ob__actions">
        {step > 0 ? (
          <CloudButton
            variant="brandOutline"
            size="sm"
            className="coach-ob__btn"
            onClick={goPrev}
          >
            上一步
          </CloudButton>
        ) : null}
        <CloudButton
          variant="brand"
          size="sm"
          className="coach-ob__btn"
          onClick={goNext}
        >
          {isLast ? '去添加学员' : '下一步'}
        </CloudButton>
      </View>
    </View>
  )

  if (!hasTarget || !hole) {
    return (
      <View className="coach-ob__mask coach-ob__mask--center" catchMove>
        {tip}
      </View>
    )
  }

  const hl = {
    top: Math.max(0, hole.top - PAD),
    left: Math.max(0, hole.left - PAD),
    width: hole.width + PAD * 2,
    height: hole.height + PAD * 2,
  }

  const sys = Taro.getSystemInfoSync()
  const vw = sys.windowWidth || 375
  const vh = sys.windowHeight || 667
  const tipW = Math.min(vw - 24, 340)
  const tipH = 200
  const placeBelow = hl.top + hl.height < vh * 0.55
  let tipTop = placeBelow ? hl.top + hl.height + 12 : hl.top - tipH - 12
  if (tipTop < 12) tipTop = 12
  if (tipTop + tipH > vh - 12) tipTop = Math.max(12, vh - tipH - 12)
  let tipLeft = hl.left + hl.width / 2 - tipW / 2
  tipLeft = Math.min(Math.max(12, tipLeft), vw - tipW - 12)
  const arrowLeft = Math.min(
    Math.max(20, hl.left + hl.width / 2 - tipLeft - 8),
    tipW - 36,
  )
  const arrowBelow = tipTop > hl.top + hl.height / 2

  return (
    <View className="coach-ob__mask coach-ob__mask--spotlight" catchMove>
      <View
        className="coach-ob__hole"
        style={{
          top: `${hl.top}px`,
          left: `${hl.left}px`,
          width: `${hl.width}px`,
          height: `${hl.height}px`,
        }}
      />
      <View
        className="coach-ob__tip-wrap"
        style={{
          top: `${tipTop}px`,
          left: `${tipLeft}px`,
          width: `${tipW}px`,
        }}
      >
        <View
          className={`coach-ob__arrow ${arrowBelow ? 'coach-ob__arrow--up' : 'coach-ob__arrow--down'}`}
          style={{ left: `${arrowLeft}px` }}
        />
        {tip}
      </View>
    </View>
  )
}

export default CoachOnboarding
