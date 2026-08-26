/**
 * 备课页(tab) — 对齐 web/src/pages/Home.tsx。
 * 教练视角:显示陪练课表面板(简化版)。
 * 学生视角:查看本周课程安排,支持周切换。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Clock, ArrowLeft, ArrowRight } from '@nutui/icons-react-taro'
import { useAuthStore } from '../../stores/authStore'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import {
  getStudentCoachingWeek,
  getTeacherCoachingWeek,
  type CoachingWeekSchedule,
} from '../../api/coaching'
import { CloudButton } from '../../components/button'
import './index.scss'

const pad2 = (n: number) => String(n).padStart(2, '0')
const fmtYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
}

export default function LessonPrep() {
  const user = useAuthStore((s) => s.user)
  const role = (user as { role?: string } | null)?.role || 'user'
  const isStudent = role === 'student'
  const isCoach = role === 'teacher' || role === 'user' || role === 'admin'

  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const [schedules, setSchedules] = useState<CoachingWeekSchedule[]>([])
  const [loading, setLoading] = useState(true)

  const weekRangeLabel = useMemo(() => {
    const d = weekAnchor
    const wd = d.getDay()
    const fromMon = (wd + 6) % 7
    const mon = new Date(d)
    mon.setDate(d.getDate() - fromMon)
    const sun = addDays(mon, 6)
    return `${fmtYMD(mon).replace(/-/g, '.')} – ${fmtYMD(sun).replace(/-/g, '.')}`
  }, [weekAnchor])

  const loadWeek = useCallback(async () => {
    const ref = fmtYMD(weekAnchor)
    setLoading(true)
    try {
      const fetcher = isCoach ? getTeacherCoachingWeek : getStudentCoachingWeek
      const res = await fetcher(ref)
      setSchedules(Array.isArray(res.data?.schedules) ? res.data!.schedules : [])
    } catch {
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [weekAnchor, isCoach])

  useEffect(() => {
    void loadWeek()
  }, [loadWeek])

  const activeSchedules = schedules.filter(
    (s) => s.status === 'scheduled' || s.status === 'in_progress'
  )

  const displayName = user?.displayName || user?.email?.split('@')[0] || '同学'
  const avatarUrl = resolveMediaUrl(user?.avatar)
  const avatarText = (displayName || '?').charAt(0).toUpperCase()

  const go = (url: string) => Taro.navigateTo({ url })

  return (
    <ScrollView className="lp" scrollY enableFlex>
      {/* 顶部欢迎区 + 头像(入口到我的) */}
      <View className="lp__hero">
        <View className="lp__hero-info">
          <Text className="lp__greeting">备课中心</Text>
          <Text className="lp__name">{displayName}</Text>
        </View>
        <View className="lp__hero-avatar" onClick={() => go('/pages/profile/index')}>
          {avatarUrl ? (
            <Image className="lp__avatar-img" src={avatarUrl} mode="aspectFill" />
          ) : (
            <Text className="lp__avatar-text">{avatarText}</Text>
          )}
        </View>
      </View>

      {/* 周课表 */}
      <View className="lp__section">
        <View className="lp__week-header">
          <View className="lp__week-info">
            <Text className="lp__week-title">{isCoach ? '本周排课' : '我的课表'}</Text>
            <Text className="lp__week-range">{weekRangeLabel}</Text>
          </View>
          <View className="lp__week-actions">
            <View className="lp__week-btn" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>
              <ArrowLeft size={16} color="#4ECDC4" />
            </View>
            <Text className="lp__week-btn-text" onClick={() => setWeekAnchor(new Date())}>
              本周
            </Text>
            <View className="lp__week-btn" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>
              <ArrowRight size={16} color="#4ECDC4" />
            </View>
          </View>
        </View>

        <View className="lp__schedule-list">
          {loading ? (
            <View className="lp__state">
              <Text className="lp__state-text">加载中...</Text>
            </View>
          ) : activeSchedules.length === 0 ? (
            <View className="lp__state">
              <Text className="lp__state-title">暂无待上课程</Text>
              <Text className="lp__state-desc">切换周次查看其他时间的排课</Text>
            </View>
          ) : (
            activeSchedules.map((s) => (
              <View key={s.id} className="lp__schedule-card">
                <View className="lp__schedule-top">
                  <Text className="lp__schedule-title">{s.title || `排课 #${s.id}`}</Text>
                  <View className={`lp__schedule-status lp__schedule-status--${s.status}`}>
                    <Text className="lp__schedule-status-text">
                      {STATUS_LABEL[s.status] || s.status}
                    </Text>
                  </View>
                </View>
                <View className="lp__schedule-meta">
                  <View className="lp__schedule-meta-item">
                    <Clock size={14} color="#787671" />
                    <Text className="lp__schedule-meta-text">
                      {s.scheduledDate?.slice?.(0, 10) || s.scheduledDate}
                    </Text>
                  </View>
                  <View className="lp__schedule-meta-item">
                    <Clock size={14} color="#787671" />
                    <Text className="lp__schedule-meta-text">
                      {s.startTime}–{s.endTime}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* 快捷入口 */}
      <View className="lp__section">
        <Text className="lp__section-title">常用</Text>
        <View className="lp__quick-grid">
          <View className="lp__quick-card" onClick={() => go('/pages/vocab-test/index')}>
            <View className="lp__quick-icon lp__quick-icon--mint">
              <Clock size={18} color="#4ECDC4" />
            </View>
            <Text className="lp__quick-title">词汇测试</Text>
            <Text className="lp__quick-desc">进入测评</Text>
          </View>
          <View className="lp__quick-card" onClick={() => go('/pages/material-selection/index')}>
            <View className="lp__quick-icon lp__quick-icon--sky">
              <Clock size={18} color="#55A3FF" />
            </View>
            <Text className="lp__quick-title">单词训练</Text>
            <Text className="lp__quick-desc">选择词库</Text>
          </View>
          {isCoach && (
            <View className="lp__quick-card" onClick={() => go('/pages/my-students/index')}>
              <View className="lp__quick-icon lp__quick-icon--sky">
                <Clock size={18} color="#55A3FF" />
              </View>
              <Text className="lp__quick-title">学员管理</Text>
              <Text className="lp__quick-desc">学员与时长</Text>
            </View>
          )}
          <View className="lp__quick-card" onClick={() => go('/pages/training-records/index')}>
            <View className="lp__quick-icon lp__quick-icon--cream">
              <Clock size={18} color="#c37d0d" />
            </View>
            <Text className="lp__quick-title">学习记录</Text>
            <Text className="lp__quick-desc">正课与复习</Text>
          </View>
        </View>
      </View>

      {/* 训练资料 */}
      <View className="lp__section">
        <Text className="lp__section-title">训练资料</Text>
        <View className="lp__material-card">
          {[
            { name: '解析语法', desc: '语法专项练习', path: '' },
            { name: '阅读理解', desc: '阅读训练', path: '' },
            { name: '完形填空', desc: '完形专项', path: '' },
            { name: '情景口语', desc: 'AI 情景对话', path: '/pages/scenario-selection/index' },
          ].map((item, idx) => (
            <View
              key={item.name}
              className={`lp__material-item ${idx < 3 ? 'lp__material-item--border' : ''}`}
              onClick={() => {
                if (item.path) go(item.path)
                else Taro.showToast({ title: '待开发', icon: 'none' })
              }}
            >
              <View className="lp__material-icon">
                <Clock size={15} color="#787671" />
              </View>
              <View className="lp__material-info">
                <Text className="lp__material-name">{item.name}</Text>
                <Text className="lp__material-desc">{item.desc}</Text>
              </View>
              <ArrowRight size={16} color="#a4a097" />
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: '48rpx' }} />
    </ScrollView>
  )
}
