/**
 * 教练页 — 对齐 web/src/pages/CoachCenter.tsx。
 * 用户信息卡片 + 功能卡片网格(已上课程/词汇测试记录/我的学生/通知/设置/防遗忘)。
 */
import React, { useEffect, useMemo } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  Clock,
  Star,
  Notice,
  Setting,
  ShieldCheck,
  Edit,
  Right,
  List,
} from '@nutui/icons-react-taro'
import { useAuthStore } from '../../stores/authStore'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { color } from '../../styles/tokens'
import './index.scss'

type Tint = 'mint' | 'sky' | 'cream'

interface FeatureItem {
  id: string
  label: string
  desc: string
  tint: Tint
  icon: React.ReactNode
  path: string
  coachOnly?: boolean
}

export default function Coach() {
  const user = useAuthStore((s) => s.user)
  const refreshUserInfo = useAuthStore((s) => s.refreshUserInfo)
  const role = (user as { role?: string } | null)?.role || 'user'
  const isCoach = role === 'teacher' || role === 'user' || role === 'admin'

  useEffect(() => {
    void refreshUserInfo()
  }, [refreshUserInfo])

  const name = user?.displayName || user?.email?.split('@')[0] || ''
  const greetingText = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return '早上好'
    if (hour < 18) return '下午好'
    return '晚上好'
  }, [])

  const avatarUrl = resolveMediaUrl(user?.avatar)
  const avatarText = (name || '?').charAt(0).toUpperCase()

  const go = (url: string) => Taro.navigateTo({ url })

  const features: FeatureItem[] = [
    {
      id: 'completed',
      label: '已上课程',
      desc: '查看近 90 天已完成的陪练记录与课时结算',
      tint: 'mint',
      icon: <Clock size={20} color={color.primary} />,
      path: '/pages/training-records/index',
      coachOnly: true,
    },
    {
      id: 'vocab-records',
      label: '词汇测试记录',
      desc: '查看词汇测评历史',
      tint: 'sky',
      icon: <Star size={20} color={color.secondaryBrand} />,
      path: '/pages/vocab-test/index',
    },
    {
      id: 'my-students',
      label: '我的学生',
      desc: '学员与课时管理',
      tint: 'sky',
      icon: <List size={20} color={color.secondaryBrand} />,
      path: '/pages/my-students/index',
    },
    {
      id: 'notifications',
      label: '通知',
      desc: '消息与提醒',
      tint: 'mint',
      icon: <Notice size={20} color={color.primary} />,
      path: '/pages/notifications/index',
    },
    {
      id: 'settings',
      label: '设置',
      desc: '账号与偏好设置',
      tint: 'cream',
      icon: <Setting size={20} color={color.warning} />,
      path: '/pages/settings/index',
    },
    {
      id: 'anti-forgetting',
      label: '防遗忘',
      desc: '复习计划与记忆曲线',
      tint: 'mint',
      icon: <ShieldCheck size={20} color={color.primary} />,
      path: '/pages/anti-forgetting/index',
    },
  ]

  const visibleFeatures = features.filter((f) => !f.coachOnly || isCoach)

  return (
    <ScrollView className="coach" scrollY enableFlex>
      {/* 用户信息卡片 */}
      <View className="coach__user-card">
        <View className="coach__avatar">
          {avatarUrl ? (
            <Image className="coach__avatar-img" src={avatarUrl} mode="aspectFill" />
          ) : (
            <Text className="coach__avatar-text">{avatarText}</Text>
          )}
        </View>
        <View className="coach__user-info">
          <View className="coach__user-name-row">
            <Text className="coach__user-name">{name || '-'}</Text>
            <Text className="coach__user-greeting">{greetingText}</Text>
          </View>
          <Text className="coach__user-sub">
            正式陪练 · ID {user?.id ?? '-'}
          </Text>
        </View>
        <View
          className="coach__edit-btn"
          onClick={() => go('/pages/profile-edit/index')}
        >
          <Edit size={18} color={color.mutedForeground} />
        </View>
      </View>

      {/* 已上课程(教练角色才显示,大卡片) */}
      {isCoach && (
        <View
          className="coach__completed-card"
          onClick={() => go('/pages/training-records/index')}
        >
          <View className="coach__completed-icon">
            <Clock size={24} color={color.primary} />
          </View>
          <View className="coach__completed-text">
            <View className="coach__completed-title-row">
              <Text className="coach__completed-title">已上课程</Text>
              <Right size={18} color={color.mutedSoft} />
            </View>
            <Text className="coach__completed-desc">
              查看近 90 天已完成的陪练记录与课时结算
            </Text>
          </View>
        </View>
      )}

      {/* 功能中心 */}
      <View className="coach__section">
        <Text className="coach__section-title">功能中心</Text>
        <View className="coach__feature-card">
          {visibleFeatures.map((feature, idx) => (
            <View
              key={feature.id}
              className={`coach__feature-item ${idx < visibleFeatures.length - 1 ? 'coach__feature-item--border' : ''}`}
              onClick={() => go(feature.path)}
            >
              <View className={`coach__feature-icon coach__feature-icon--${feature.tint}`}>
                {feature.icon}
              </View>
              <View className="coach__feature-text">
                <Text className="coach__feature-label">{feature.label}</Text>
                <Text className="coach__feature-desc">{feature.desc}</Text>
              </View>
              <Right size={16} color={color.mutedSoft} />
            </View>
          ))}
        </View>
      </View>

      <View className="coach__footer">
        <Text className="coach__footer-text">云阶 CloudSteps</Text>
      </View>
    </ScrollView>
  )
}
