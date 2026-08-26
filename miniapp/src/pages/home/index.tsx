/**
 * 首页(tab) — 对齐 web/src/pages/LessonPrep.tsx。
 * 常用功能 2x2 网格卡片 + 训练资料列表。
 * 教练角色显示学员选择器。
 */
import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Right, Star, Clock, Plus, List } from '@nutui/icons-react-taro'
import { useAuthStore } from '../../stores/authStore'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import {
  listAllTeacherCoachingQuotas,
  type TeacherCoachingQuotaRow,
} from '../../api/coaching'
import {
  getTrainingStudent,
  setTrainingStudent,
  studentLabelFromQuota,
} from '../../utils/trainingStudent'
import './index.scss'

interface QuickCard {
  key: string
  title: string
  desc: string
  tint: 'mint' | 'sky' | 'cream'
  icon: React.ReactNode
  onClick: () => void
}

interface MaterialItem {
  name: string
  desc: string
  path: string
}

export default function LessonPrep() {
  const user = useAuthStore((s) => s.user)
  const role = (user as { role?: string } | null)?.role || 'user'
  const isCoach = role === 'user' || role === 'admin' || role === 'teacher'

  const [students, setStudents] = useState<TeacherCoachingQuotaRow[]>([])
  const [studentId, setStudentId] = useState<string>(() => {
    const s = getTrainingStudent()
    return s?.id ? String(s.id) : ''
  })
  const [studentPickerOpen, setStudentPickerOpen] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)

  useEffect(() => {
    if (!isCoach) return
    let mounted = true
    setLoadingStudents(true)
    ;(async () => {
      try {
        const rows = await listAllTeacherCoachingQuotas()
        if (!mounted) return
        setStudents(rows)
        const saved = getTrainingStudent()
        let pick = saved?.id ? rows.find((r) => r.studentId === saved.id) : undefined
        if (!pick && rows[0]) pick = rows[0]
        if (pick) {
          const name = studentLabelFromQuota(pick)
          setStudentId(String(pick.studentId))
          setTrainingStudent(pick.studentId, name)
        }
      } catch {
        if (mounted) setStudents([])
      } finally {
        if (mounted) setLoadingStudents(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [isCoach])

  const studentOptions = useMemo(
    () =>
      students.map((r) => ({
        label: studentLabelFromQuota(r),
        value: String(r.studentId),
      })),
    [students],
  )

  const currentStudentLabel = useMemo(() => {
    const row = students.find((r) => String(r.studentId) === studentId)
    return row ? studentLabelFromQuota(row) : ''
  }, [students, studentId])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
  const displayName = user?.displayName || user?.email?.split('@')[0] || '同学'
  const avatarUrl = resolveMediaUrl(user?.avatar)
  const avatarText = (displayName || '?').charAt(0).toUpperCase()

  const go = (url: string) => Taro.navigateTo({ url })

  const quickCards: QuickCard[] = [
    {
      key: 'vocab-test',
      title: '词汇测试',
      desc: '进入测评',
      tint: 'mint',
      icon: <Star size={18} color="#4ECDC4" />,
      onClick: () => go('/pages/vocab-test/index'),
    },
    {
      key: 'material-selection',
      title: '单词训练',
      desc: '选择词库',
      tint: 'sky',
      icon: <List size={18} color="#55A3FF" />,
      onClick: () => go('/pages/material-selection/index'),
    },
    ...(isCoach
      ? [
          {
            key: 'my-students',
            title: '学员管理',
            desc: '学员与时长',
            tint: 'sky' as const,
            icon: <Plus size={18} color="#55A3FF" />,
            onClick: () => go('/pages/my-students/index'),
          },
        ]
      : []),
    {
      key: 'training-records',
      title: '学习记录',
      desc: '正课与复习',
      tint: 'cream',
      icon: <Clock size={18} color="#c37d0d" />,
      onClick: () => go('/pages/training-records/index'),
    },
  ]

  const materials: MaterialItem[] = [
    { name: '解析语法', desc: '语法专项练习', path: '/pages/grammar-analysis/index' },
    { name: '阅读理解', desc: '阅读训练', path: '/pages/reading-comprehension/index' },
    { name: '完形填空', desc: '完形专项', path: '/pages/cloze-practice/index' },
    { name: '情景口语', desc: 'AI 情景对话', path: '/pages/scenario-selection/index' },
  ]

  const onSelectStudent = (row: TeacherCoachingQuotaRow) => {
    setStudentId(String(row.studentId))
    setTrainingStudent(row.studentId, studentLabelFromQuota(row))
    setStudentPickerOpen(false)
  }

  return (
    <ScrollView className="lp" scrollY enableFlex>
      {/* 顶部欢迎区 + 头像入口 */}
      <View className="home__hero">
        <View className="home__hero-info">
          <Text className="home__greeting">{greeting}，</Text>
          <Text className="home__name">{displayName}</Text>
        </View>
        <View
          className="home__hero-avatar"
          onClick={() => go('/pages/profile/index')}
        >
          {avatarUrl ? (
            <Image className="home__avatar-img" src={avatarUrl} mode="aspectFill" />
          ) : (
            <Text className="home__avatar-text">{avatarText}</Text>
          )}
        </View>
      </View>

      {/* 学员选择器(教练角色才显示) */}
      {isCoach && (
        <View className="home__student-bar">
          <Text className="home__student-label">学员</Text>
          <View
            className="home__student-picker"
            onClick={() => setStudentPickerOpen((v) => !v)}
          >
            <Text
              className={`home__student-value ${!currentStudentLabel ? 'home__student-value--placeholder' : ''}`}
            >
              {loadingStudents
                ? '加载中…'
                : currentStudentLabel || '选择学员'}
            </Text>
            <Right size={14} color="#a4a097" />
          </View>
        </View>
      )}

      {/* 学员下拉面板 */}
      {isCoach && studentPickerOpen && (
        <View className="home__student-dropdown">
          {studentOptions.length === 0 ? (
            <View className="home__student-empty">
              <Text>{loadingStudents ? '加载中…' : '暂无学员'}</Text>
            </View>
          ) : (
            studentOptions.map((opt) => (
              <View
                key={opt.value}
                className={`home__student-option ${opt.value === studentId ? 'home__student-option--active' : ''}`}
                onClick={() => {
                  const row = students.find(
                    (r) => String(r.studentId) === opt.value,
                  )
                  if (row) onSelectStudent(row)
                }}
              >
                <Text className="home__student-option-text">{opt.label}</Text>
                {opt.value === studentId && (
                  <Star size={14} color="#4ECDC4" />
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* 常用功能 2x2 网格 */}
      <View className="home__section">
        <Text className="home__section-title">常用</Text>
        <View className="home__quick-grid">
          {quickCards.map((card) => (
            <View
              key={card.key}
              className={`home__quick-card home__quick-card--${card.tint}`}
              onClick={card.onClick}
            >
              <View className={`home__quick-icon home__quick-icon--${card.tint}`}>
                {card.icon}
              </View>
              <View className="home__quick-text">
                <Text className="home__quick-title">{card.title}</Text>
                <Text className="home__quick-desc">{card.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 训练资料列表 */}
      <View className="home__section">
        <Text className="home__section-title">训练资料</Text>
        <View className="home__material-card">
          {materials.map((item, idx) => (
            <View
              key={item.path}
              className={`home__material-item ${idx < materials.length - 1 ? 'home__material-item--border' : ''}`}
              onClick={() => go(item.path)}
            >
              <View className="home__material-icon">
                <List size={16} color="#787671" />
              </View>
              <View className="home__material-text">
                <Text className="home__material-name">{item.name}</Text>
                <Text className="home__material-desc">{item.desc}</Text>
              </View>
              <Right size={16} color="#a4a097" />
            </View>
          ))}
        </View>
      </View>

      <View className="home__footer">
        <Text className="home__footer-text">云阶 CloudSteps</Text>
      </View>
    </ScrollView>
  )
}
