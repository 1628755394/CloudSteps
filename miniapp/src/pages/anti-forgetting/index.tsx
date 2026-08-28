/**
 * 抗遗忘页(tab) — 对齐 web/src/pages/AntiForgetting.tsx。
 *
 * 1. 日期选择卡片:上一日 / 日期显示 / 下一日
 * 2. 复习任务按学生分组,每组显示学员头像/首字母 + 任务数
 * 3. 每个任务两行布局:
 *    第一行:时间(固定宽) + 词包名(flex-1)
 *    第二行:词数·训练时长(左) + 复习/查看按钮(右)
 * 4. 今天点"复习"跳转 review-word-list(标记模式)
 * 5. 非今天点"查看"跳转 review-word-list(只读模式)
 */
import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, ArrowRight, Clock, Eye } from '@nutui/icons-react-taro'
import { useAuthStore } from '@/stores/authStore'
import { listReviewBooksByDate, type ReviewBookStatRow } from '@/api/review'
import { CloudButton } from '@/components/button'
import { color } from '../../styles/tokens'
import './index.scss'

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseYMDLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => Number(x))
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

function formatDateLabel(ymd: string): string {
  const d = parseYMDLocal(ymd)
  if (Number.isNaN(d.getTime())) return ymd
  const today = toDateInputValue(new Date())
  const yesterday = toDateInputValue(new Date(Date.now() - 86400000))
  const tomorrow = toDateInputValue(new Date(Date.now() + 86400000))
  let prefix = ''
  if (ymd === today) prefix = '今天 · '
  else if (ymd === yesterday) prefix = '昨天 · '
  else if (ymd === tomorrow) prefix = '明天 · '
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${prefix}${mm}月${dd}日 周${weekdays[d.getDay()]}`
}

function trainingTime(cnt: number): string {
  return `${Math.min(60, Math.max(10, Math.ceil(cnt / 20) * 10))}分钟`
}

const TIMES = ['08:00', '10:00', '14:00', '16:00', '18:00']

interface ReviewTask {
  id: number
  time: string
  student: string
  vocabularyPack: string
  trainingTime: string
  status: 'pending' | 'completed'
  wordBookId: number
  count: number
}

export default function AntiForgetting() {
  const user = useAuthStore((s) => s.user)
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()))
  const [bookStats, setBookStats] = useState<ReviewBookStatRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const tz = 'Asia/Shanghai'
        const res = await listReviewBooksByDate(selectedDate, tz)
        const arr = Array.isArray(res.data) ? (res.data as ReviewBookStatRow[]) : []
        if (mounted) setBookStats(arr)
      } catch {
        if (mounted) setBookStats([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [selectedDate])

  const shiftDate = (deltaDays: number) => {
    const d = parseYMDLocal(selectedDate)
    d.setDate(d.getDate() + deltaDays)
    setSelectedDate(toDateInputValue(d))
  }

  const isToday = selectedDate === toDateInputValue(new Date())

  const reviewTasks = useMemo<ReviewTask[]>(() => {
    const student = user?.displayName || user?.email?.split('@')[0] || '当前用户'
    return bookStats.map((b, idx) => ({
      id: idx + 1,
      time: TIMES[idx % TIMES.length],
      student,
      vocabularyPack: b.name,
      trainingTime: trainingTime(b.cnt),
      status: 'pending',
      wordBookId: b.wordBookId,
      count: b.cnt,
    }))
  }, [bookStats, user])

  const groupedByStudent = useMemo(() => {
    const groups: { [key: string]: ReviewTask[] } = {}
    reviewTasks.forEach((task) => {
      if (!groups[task.student]) groups[task.student] = []
      groups[task.student].push(task)
    })
    return groups
  }, [reviewTasks])

  const handleOpenTask = (task: ReviewTask) => {
    if (task.count <= 0) return
    const params = `?wordBookId=${task.wordBookId}&date=${encodeURIComponent(selectedDate)}${isToday ? '' : '&view=1'}`
    Taro.navigateTo({
      url: `/pages/review-word-list/index${params}`,
    })
  }

  return (
    <ScrollView className="anti" scrollY enableFlex>
      {/* 日期选择卡片 */}
      <View className="anti__date-card">
        <View className="anti__date-arrow" onClick={() => shiftDate(-1)}>
          <ArrowLeft size={22} color={color.primary} />
        </View>
        <Picker
          mode="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(String(e.detail.value))}
        >
          <View className="anti__date-center">
            <Text className="anti__date-label">选择日期</Text>
            <Text className="anti__date-value">{formatDateLabel(selectedDate)}</Text>
          </View>
        </Picker>
        <View className="anti__date-arrow" onClick={() => shiftDate(1)}>
          <ArrowRight size={22} color={color.primary} />
        </View>
      </View>

      {/* 任务列表 */}
      {loading ? (
        <View className="anti__state">
          <Text className="anti__state-text">加载中...</Text>
        </View>
      ) : reviewTasks.length === 0 ? (
        <View className="anti__empty">
          <View className="anti__empty-icon">
            <Clock size={40} color={color.mutedSoft} />
          </View>
          <Text className="anti__empty-text">
            该日暂无待复习词库任务{'\n'}可切换日期查看其它天的计划
          </Text>
        </View>
      ) : (
        <View className="anti__groups">
          {Object.entries(groupedByStudent).map(([student, tasks]) => (
            <View key={student} className="anti__group">
              {/* 学生头部 */}
              <View className="anti__group-header">
                <View className="anti__group-avatar">
                  <Text className="anti__group-avatar-text">
                    {student.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="anti__group-info">
                  <Text className="anti__group-name">{student}</Text>
                  <Text className="anti__group-count">
                    本日 {tasks.length} 个复习任务（按所选日期统计）
                  </Text>
                </View>
              </View>

              {/* 任务列表 */}
              <View className="anti__task-list">
                {tasks.map((task) => (
                  <View key={task.id} className="anti__task">
                    {/* 第一行:时间 + 词包名 */}
                    <View className="anti__task-line">
                      <View className="anti__task-time">
                        <Clock size={14} color={color.primary} />
                        <Text className="anti__task-time-text">{task.time}</Text>
                      </View>
                      <Text className="anti__task-pack-name" numberOfLines={1}>{task.vocabularyPack}</Text>
                    </View>
                    {/* 第二行:词数/训练时长(左) + 按钮(右) */}
                    <View className="anti__task-line anti__task-line--bottom">
                      <Text className="anti__task-meta">
                        {task.count} 词 · {task.trainingTime}
                      </Text>
                      <View className="anti__task-btn-wrap">
                        <CloudButton
                          variant="brand"
                          size="sm"
                          disabled={task.count <= 0}
                          onClick={() => handleOpenTask(task)}
                        >
                          <View className="anti__task-btn-inner">
                            <Eye size={14} color={color.white} />
                            <Text className="anti__task-btn-text">
                              {task.count <= 0 ? '暂无词' : isToday ? '复习' : '查看'}
                            </Text>
                          </View>
                        </CloudButton>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: '48rpx' }} />
    </ScrollView>
  )
}
