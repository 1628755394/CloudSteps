/**
 * 备课页(tab) — 学校课表样式。
 *
 * 布局:
 *  1. 顶部:标题 + 周切换(上一周/本周/下一周)
 *  2. 课表网格:
 *     - 左侧第一列:时间段(第1节~第8节,对应 08:00~20:00)
 *     - 顶部第一行:周一~周日(带日期)
 *     - 格子:有课则显示课程卡片(标题+学员+状态色),无课空白
 *     - 高亮当天所在列
 *  3. 点击课程卡片:教练可开始/下课/删除;学生查看详情
 *  4. 教练:底部浮动按钮(新建排课/添加学员) + 弹出表单
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Picker, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Plus, Right } from '@nutui/icons-react-taro'
import { useAuthStore } from '@/stores/authStore'
import {
  getTeacherCoachingWeek,
  getStudentCoachingWeek,
  listAllTeacherCoachingQuotas,
  createTeacherCoachingAppointment,
  deleteTeacherCoachingAppointment,
  startCoachingAppointment,
  endCoachingAppointment,
  type CoachingWeekSchedule,
  type TeacherCoachingQuotaRow,
} from '@/api/coaching'
import { CloudButton } from '@/components/button'
import { color } from '../../styles/tokens'
import './index.scss'

const pad2 = (n: number) => String(n).padStart(2, '0')
const fmtYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const fmtMD = (d: Date) => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function weekMonday(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const wd = x.getDay()
  const fromMon = (wd + 6) % 7
  x.setDate(x.getDate() - fromMon)
  return x
}

function studentLabel(s?: { displayName?: string; username?: string }, fallbackId?: number) {
  return s?.displayName || s?.username || (fallbackId ? `学员 #${fallbackId}` : '学员')
}

/* 课表节次定义 */
const PERIODS = [
  { label: '第1节', start: '08:00', end: '09:00' },
  { label: '第2节', start: '09:00', end: '10:00' },
  { label: '第3节', start: '10:00', end: '11:00' },
  { label: '第4节', start: '11:00', end: '12:00' },
  { label: '第5节', start: '14:00', end: '15:00' },
  { label: '第6节', start: '15:00', end: '16:00' },
  { label: '第7节', start: '16:00', end: '17:00' },
  { label: '第8节', start: '19:00', end: '20:00' },
  { label: '第9节', start: '20:00', end: '21:00' },
]

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: color.primary,
  in_progress: color.secondaryBrand,
  completed: color.mutedSoft,
  cancelled: color.destructive,
}

/** 判断课程属于哪个节次(按 startTime 匹配) */
function findPeriodIndex(startTime: string): number {
  const idx = PERIODS.findIndex((p) => p.start === startTime)
  return idx >= 0 ? idx : -1
}

export default function LessonPrep() {
  const user = useAuthStore((s) => s.user)
  const role = (user as { role?: string } | null)?.role || 'user'
  const isStudent = role === 'student'
  const isCoach = role === 'teacher' || role === 'user' || role === 'admin'

  const [nowTs, setNowTs] = useState(() => Date.now())
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const [schedules, setSchedules] = useState<CoachingWeekSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<Record<number, 'start' | 'end' | null>>({})

  // 教练: 新建排课表单
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [quotas, setQuotas] = useState<TeacherCoachingQuotaRow[]>([])
  const [aStudent, setAStudent] = useState('')
  const [aDate, setADate] = useState(fmtYMD(new Date()))
  const [aStart, setAStart] = useState('09:00')
  const [aEnd, setAEnd] = useState('10:00')
  const [aTitle, setATitle] = useState('')
  const [creatingAppt, setCreatingAppt] = useState(false)

  // 选中的课程(点击卡片后弹出详情)
  const [selectedSchedule, setSelectedSchedule] = useState<CoachingWeekSchedule | null>(null)

  const weekMon = useMemo(() => weekMonday(weekAnchor), [weekAnchor])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekMon, i)),
    [weekMon],
  )
  const weekRangeLabel = useMemo(
    () => `${fmtYMD(weekMon).replace(/-/g, '.')} – ${fmtYMD(addDays(weekMon, 6)).replace(/-/g, '.')}`,
    [weekMon],
  )

  const todayYMD = fmtYMD(new Date())

  // 把 schedules 按 (dayIndex, periodIndex) 组织成网格
  const grid = useMemo(() => {
    const g: (CoachingWeekSchedule | null)[][] = Array.from(
      { length: PERIODS.length },
      () => Array(7).fill(null),
    )
    schedules.forEach((s) => {
      const sDate = s.scheduledDate?.slice?.(0, 10) || s.scheduledDate
      const dayIdx = weekDays.findIndex((d) => fmtYMD(d) === sDate)
      if (dayIdx < 0) return
      const pIdx = findPeriodIndex(s.startTime)
      if (pIdx < 0) {
        // 不在标准节次里,找最近的
        const near = PERIODS.reduce((best, p, i) => {
          const diff = Math.abs(p.start.localeCompare(s.startTime))
          return diff < best.diff ? { idx: i, diff } : best
        }, { idx: 0, diff: Infinity })
        if (!g[near.idx][dayIdx]) g[near.idx][dayIdx] = s
        return
      }
      // 如果格子已被占,保留第一个
      if (!g[pIdx][dayIdx]) g[pIdx][dayIdx] = s
    })
    return g
  }, [schedules, weekDays])

  const activeCount = useMemo(
    () => schedules.filter((s) => s.status === 'scheduled' || s.status === 'in_progress').length,
    [schedules],
  )

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

  const loadQuotas = useCallback(async () => {
    if (!isCoach) return
    try {
      setQuotas(await listAllTeacherCoachingQuotas())
    } catch {
      setQuotas([])
    }
  }, [isCoach])

  useEffect(() => {
    void loadWeek()
    void loadQuotas()
  }, [loadWeek, loadQuotas])

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  const studentOptions = useMemo(
    () => quotas.map((q) => ({ label: studentLabel(q.student, q.studentId), value: String(q.studentId) })),
    [quotas],
  )

  const onStart = async (id: number) => {
    setPendingAction((p) => ({ ...p, [id]: 'start' }))
    try {
      const res = await startCoachingAppointment(id)
      if (res.code !== 200) {
        Taro.showToast({ title: res.msg || '无法开始', icon: 'none' })
        return
      }
      Taro.showToast({ title: '已开始上课', icon: 'success' })
      setSelectedSchedule(null)
      void loadWeek()
      Taro.navigateTo({ url: '/pages/material-selection/index' })
    } catch {
      Taro.showToast({ title: '开始失败', icon: 'none' })
    } finally {
      setPendingAction((p) => ({ ...p, [id]: null }))
    }
  }

  const onEnd = async (id: number) => {
    setPendingAction((p) => ({ ...p, [id]: 'end' }))
    try {
      const res = await endCoachingAppointment(id)
      if (res.code !== 200) {
        Taro.showToast({ title: res.msg || '无法下课', icon: 'none' })
        return
      }
      Taro.showToast({ title: '已下课', icon: 'success' })
      setSelectedSchedule(null)
      void loadWeek()
    } catch {
      Taro.showToast({ title: '下课失败', icon: 'none' })
    } finally {
      setPendingAction((p) => ({ ...p, [id]: null }))
    }
  }

  const onDelete = async (id: number) => {
    Taro.showModal({
      title: '删除排课',
      content: '确定删除该排课？删除后不可恢复。',
      confirmText: '确定删除',
      confirmColor: color.destructive,
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await deleteTeacherCoachingAppointment(id)
          if (res.code !== 200) {
            Taro.showToast({ title: res.msg || '删除失败', icon: 'none' })
            return
          }
          Taro.showToast({ title: '已删除', icon: 'success' })
          setSelectedSchedule(null)
          void loadWeek()
        } catch {
          Taro.showToast({ title: '删除失败', icon: 'none' })
        }
      },
    })
  }

  const onCreateAppt = async () => {
    const sid = Number(aStudent)
    if (!sid) {
      Taro.showToast({ title: '请选择学员', icon: 'none' })
      return
    }
    if (!aDate || !aStart || !aEnd) {
      Taro.showToast({ title: '请选择日期与时间', icon: 'none' })
      return
    }
    setCreatingAppt(true)
    try {
      const res = await createTeacherCoachingAppointment({
        studentId: sid,
        scheduledDate: aDate,
        startTime: aStart,
        endTime: aEnd,
        title: aTitle || undefined,
      })
      if (res.code !== 200) {
        Taro.showToast({ title: res.msg || '创建失败', icon: 'none' })
        return
      }
      Taro.showToast({ title: '已创建排课', icon: 'success' })
      setShowScheduleForm(false)
      setATitle('')
      const anchor = new Date(`${aDate}T12:00:00`)
      if (!Number.isNaN(anchor.getTime())) setWeekAnchor(anchor)
      void loadWeek()
      void loadQuotas()
    } catch {
      Taro.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setCreatingAppt(false)
    }
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || '同学'

  return (
    <View className="lp">
      {/* 顶部标题 + 周切换 */}
      <View className="lp__header">
        <View className="lp__header-top">
          <View className="lp__header-info">
            <View className="lp__title-row">
              <Text className="lp__title">{isCoach ? '学生课表' : '我的课表'}</Text>
              <View className="lp__count-badge">
                <Text className="lp__count-text">待上 {activeCount}</Text>
              </View>
            </View>
            <Text className="lp__week-range">{weekRangeLabel}</Text>
          </View>
          {isCoach && (
            <View className="lp__add-btn" onClick={() => setShowScheduleForm(true)}>
              <Plus size={18} color={color.white} />
              <Text className="lp__add-btn-text">排课</Text>
            </View>
          )}
        </View>
        <View className="lp__week-nav">
          <View className="lp__week-nav-btn" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>
            <Text className="lp__week-nav-text">‹ 上一周</Text>
          </View>
          <View className="lp__week-nav-btn lp__week-nav-btn--center" onClick={() => setWeekAnchor(new Date())}>
            <Text className="lp__week-nav-text lp__week-nav-text--primary">本周</Text>
          </View>
          <View className="lp__week-nav-btn" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>
            <Text className="lp__week-nav-text">下一周 ›</Text>
          </View>
        </View>
      </View>

      {/* 课表网格 */}
      <ScrollView className="lp__grid-scroll" scrollX scrollY enableFlex>
        <View className="lp__grid">
          {/* 表头:节次 + 周一~周日 */}
          <View className="lp__grid-row lp__grid-row--header">
            <View className="lp__grid-cell lp__grid-cell--corner">
              <Text className="lp__corner-text">节次</Text>
            </View>
            {weekDays.map((d, i) => {
              const ymd = fmtYMD(d)
              const isToday = ymd === todayYMD
              return (
                <View key={i} className={`lp__grid-cell lp__grid-cell--dayhead ${isToday ? 'lp__grid-cell--today' : ''}`}>
                  <Text className={`lp__day-label ${isToday ? 'lp__day-label--today' : ''}`}>周{WEEKDAY_LABELS[i]}</Text>
                  <Text className={`lp__day-date ${isToday ? 'lp__day-date--today' : ''}`}>{fmtMD(d)}</Text>
                </View>
              )
            })}
          </View>

          {/* 每个节次一行 */}
          {loading ? (
            <View className="lp__grid-loading">
              <Text className="lp__grid-loading-text">加载中...</Text>
            </View>
          ) : (
            PERIODS.map((period, pIdx) => (
              <View key={pIdx} className="lp__grid-row">
                {/* 左侧节次标签 */}
                <View className="lp__grid-cell lp__grid-cell--period">
                  <Text className="lp__period-label">{period.label}</Text>
                  <Text className="lp__period-time">{period.start}</Text>
                </View>
                {/* 7 天的格子 */}
                {weekDays.map((d, dIdx) => {
                  const s = grid[pIdx][dIdx]
                  const isToday = fmtYMD(d) === todayYMD
                  if (!s) {
                    return (
                      <View key={dIdx} className={`lp__grid-cell lp__grid-cell--empty ${isToday ? 'lp__grid-cell--today-col' : ''}`} />
                    )
                  }
                  const statusColor = STATUS_COLOR[s.status] || color.primary
                  return (
                    <View
                      key={dIdx}
                      className={`lp__grid-cell lp__grid-cell--lesson ${isToday ? 'lp__grid-cell--today-col' : ''}`}
                      onClick={() => setSelectedSchedule(s)}
                    >
                      <View className="lp__lesson-card" style={{ borderLeftColor: statusColor }}>
                        <Text className="lp__lesson-title" numberOfLines={2}>
                          {(s.title || '').replace(/\s*[·•]\s*陪练\s*$/u, '').trim() || s.students?.[0] || '课程'}
                        </Text>
                        {s.students && s.students.length > 0 && (
                          <Text className="lp__lesson-student" numberOfLines={1}>{s.students[0]}</Text>
                        )}
                        <View className="lp__lesson-status" style={{ backgroundColor: `${statusColor}1a` }}>
                          <Text className="lp__lesson-status-text" style={{ color: statusColor }}>{STATUS_LABEL[s.status] || s.status}</Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 教练: 新建排课表单(底部弹窗) */}
      {isCoach && showScheduleForm && (
        <View className="lp__modal-mask" onClick={() => setShowScheduleForm(false)}>
          <View className="lp__modal-sheet" onClick={(e) => e.stopPropagation()}>
            <View className="lp__modal-header">
              <Text className="lp__modal-title">新建排课</Text>
              <Text className="lp__modal-close" onClick={() => setShowScheduleForm(false)}>关闭</Text>
            </View>
            <View className="lp__form-row">
              <Text className="lp__form-label">学员</Text>
              <Picker
                mode="selector"
                range={studentOptions.map((o) => o.label)}
                value={Math.max(0, studentOptions.findIndex((o) => o.value === aStudent))}
                onChange={(e) => {
                  const idx = Number(e.detail.value)
                  if (studentOptions[idx]) setAStudent(studentOptions[idx].value)
                }}
              >
                <View className="lp__form-picker">
                  <Text className={aStudent ? 'lp__form-picker-text' : 'lp__form-picker-text lp__form-picker-text--placeholder'}>
                    {aStudent
                      ? studentOptions.find((o) => o.value === aStudent)?.label || '选择学员'
                      : studentOptions.length ? '选择学员' : '请先添加学员'}
                  </Text>
                  <Right size={14} color={color.mutedSoft} />
                </View>
              </Picker>
            </View>
            <View className="lp__form-row">
              <Text className="lp__form-label">日期</Text>
              <Picker mode="date" value={aDate} onChange={(e) => setADate(String(e.detail.value))}>
                <View className="lp__form-picker">
                  <Text className="lp__form-picker-text">{aDate}</Text>
                  <Right size={14} color={color.mutedSoft} />
                </View>
              </Picker>
            </View>
            <View className="lp__form-row lp__form-row--two">
              <View className="lp__form-col">
                <Text className="lp__form-label">开始</Text>
                <Picker mode="time" value={aStart} onChange={(e) => setAStart(String(e.detail.value))}>
                  <View className="lp__form-picker">
                    <Text className="lp__form-picker-text">{aStart}</Text>
                    <Right size={14} color={color.mutedSoft} />
                  </View>
                </Picker>
              </View>
              <View className="lp__form-col">
                <Text className="lp__form-label">结束</Text>
                <Picker mode="time" value={aEnd} onChange={(e) => setAEnd(String(e.detail.value))}>
                  <View className="lp__form-picker">
                    <Text className="lp__form-picker-text">{aEnd}</Text>
                    <Right size={14} color={color.mutedSoft} />
                  </View>
                </Picker>
              </View>
            </View>
            <View className="lp__form-row">
              <Text className="lp__form-label">标题(可选)</Text>
              <Input
                className="lp__form-input"
                value={aTitle}
                onInput={(e) => setATitle(e.detail.value)}
                placeholder="如：四级词汇陪练"
              />
            </View>
            <CloudButton variant="brand" loading={creatingAppt} onClick={onCreateAppt}>
              确认排课
            </CloudButton>
          </View>
        </View>
      )}

      {/* 课程详情弹窗(点击格子后) */}
      {selectedSchedule && (
        <View className="lp__modal-mask" onClick={() => setSelectedSchedule(null)}>
          <View className="lp__modal-sheet" onClick={(e) => e.stopPropagation()}>
            <View className="lp__modal-header">
              <Text className="lp__modal-title">
                {(selectedSchedule.title || '').replace(/\s*[·•]\s*陪练\s*$/u, '').trim() ||
                  selectedSchedule.students?.[0] ||
                  '课程详情'}
              </Text>
              <Text className="lp__modal-close" onClick={() => setSelectedSchedule(null)}>关闭</Text>
            </View>
            <View className="lp__detail-info">
              <View className="lp__detail-row">
                <Text className="lp__detail-label">时间</Text>
                <Text className="lp__detail-value">
                  {selectedSchedule.scheduledDate?.slice?.(0, 10) || selectedSchedule.scheduledDate} · {selectedSchedule.startTime}–{selectedSchedule.endTime}
                </Text>
              </View>
              {selectedSchedule.students && selectedSchedule.students.length > 0 && (
                <View className="lp__detail-row">
                  <Text className="lp__detail-label">学员</Text>
                  <Text className="lp__detail-value">{selectedSchedule.students.join('、')}</Text>
                </View>
              )}
              <View className="lp__detail-row">
                <Text className="lp__detail-label">状态</Text>
                <View className="lp__detail-status" style={{ backgroundColor: `${STATUS_COLOR[selectedSchedule.status] || color.primary}1a` }}>
                  <Text className="lp__detail-status-text" style={{ color: STATUS_COLOR[selectedSchedule.status] || color.primary }}>
                    {STATUS_LABEL[selectedSchedule.status] || selectedSchedule.status}
                  </Text>
                </View>
              </View>
            </View>
            {isCoach && (
              <View className="lp__detail-actions">
                {selectedSchedule.status === 'scheduled' && (
                  <>
                    <CloudButton
                      variant="brand"
                      loading={pendingAction[selectedSchedule.id] === 'start'}
                      disabled={pendingAction[selectedSchedule.id] !== null && pendingAction[selectedSchedule.id] !== undefined}
                      onClick={() => onStart(selectedSchedule.id)}
                    >
                      开始上课
                    </CloudButton>
                    <View className="lp__detail-btn-danger" onClick={() => onDelete(selectedSchedule.id)}>
                      <Text className="lp__detail-btn-danger-text">删除排课</Text>
                    </View>
                  </>
                )}
                {selectedSchedule.status === 'in_progress' && (
                  <>
                    <CloudButton
                      variant="brand"
                      onClick={() => {
                        setSelectedSchedule(null)
                        Taro.navigateTo({ url: '/pages/material-selection/index' })
                      }}
                    >
                      进入课堂
                    </CloudButton>
                    <CloudButton
                      variant="destructive"
                      loading={pendingAction[selectedSchedule.id] === 'end'}
                      disabled={pendingAction[selectedSchedule.id] !== null && pendingAction[selectedSchedule.id] !== undefined}
                      onClick={() => onEnd(selectedSchedule.id)}
                    >
                      下课
                    </CloudButton>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
