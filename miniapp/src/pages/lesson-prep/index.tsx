/**
 * 备课页(tab) — 对齐 web/src/pages/Home.tsx + CoachingSchedulePanel.tsx。
 *
 * 教练视角:陪练排课面板(周切换 + 下一节课卡片 + 统计 + 排课列表 + 开始/下课/删除)
 * 学生视角:我的课表(周切换 + 待上课程列表)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Image, Picker, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Clock, Right, Plus, Refresh } from '@nutui/icons-react-taro'
import { useAuthStore } from '../../stores/authStore'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import {
  getTeacherCoachingWeek,
  getStudentCoachingWeek,
  listAllTeacherCoachingQuotas,
  createTeacherCoachingAppointment,
  deleteTeacherCoachingAppointment,
  startCoachingAppointment,
  endCoachingAppointment,
  searchCoachingStudents,
  addTeacherCoachingStudent,
  type CoachingWeekSchedule,
  type TeacherCoachingQuotaRow,
  type CoachingStudentSearchResult,
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

function parseSlotEnd(scheduledDate: string, endTime: string): Date | null {
  try {
    const dt = new Date(`${scheduledDate.slice(0, 10)}T${endTime.length === 5 ? endTime : endTime.slice(0, 5)}:00`)
    if (Number.isNaN(dt.getTime())) return null
    return dt
  } catch {
    return null
  }
}

function minutesUntilEnd(scheduledDate: string, endTime: string, nowTs: number): number | null {
  const end = parseSlotEnd(scheduledDate, endTime)
  if (!end) return null
  return Math.max(0, Math.ceil((end.getTime() - nowTs) / 60000))
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
}

export default function Home() {
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

  // 教练: 添加学员表单
  const [showStudentForm, setShowStudentForm] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<CoachingStudentSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [pickedStudent, setPickedStudent] = useState<CoachingStudentSearchResult | null>(null)
  const [quotaMinutes, setQuotaMinutes] = useState(60)
  const [addingStudent, setAddingStudent] = useState(false)

  const weekMon = useMemo(() => weekMonday(weekAnchor), [weekAnchor])
  const weekSun = useMemo(() => addDays(weekMon, 6), [weekMon])
  const weekRangeLabel = useMemo(
    () => `${fmtYMD(weekMon).replace(/-/g, '.')} – ${fmtYMD(weekSun).replace(/-/g, '.')}`,
    [weekMon, weekSun],
  )

  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.status === 'scheduled' || s.status === 'in_progress'),
    [schedules],
  )

  const nextClass = useMemo(() => {
    const inProgress = activeSchedules.find((s) => s.status === 'in_progress')
    if (inProgress) return inProgress
    const upcoming = activeSchedules
      .filter((s) => s.status === 'scheduled')
      .find((s) => {
        const end = parseSlotEnd(s.scheduledDate, s.endTime)
        return !end || end.getTime() >= nowTs
      })
    return upcoming || activeSchedules.find((s) => s.status === 'scheduled')
  }, [activeSchedules, nowTs])

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

  // 教练操作
  const onStart = async (id: number) => {
    setPendingAction((p) => ({ ...p, [id]: 'start' }))
    try {
      const res = await startCoachingAppointment(id)
      if (res.code !== 200) {
        Taro.showToast({ title: res.msg || '无法开始', icon: 'none' })
        return
      }
      Taro.showToast({ title: '已开始上课', icon: 'success' })
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
      confirmColor: '#e03131',
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await deleteTeacherCoachingAppointment(id)
          if (res.code !== 200) {
            Taro.showToast({ title: res.msg || '删除失败', icon: 'none' })
            return
          }
          Taro.showToast({ title: '已删除', icon: 'success' })
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

  const onSearchStudents = async () => {
    const q = searchQ.trim()
    if (q.length < 2) {
      Taro.showToast({ title: '请输入至少 2 个字符', icon: 'none' })
      return
    }
    setSearching(true)
    try {
      const res = await searchCoachingStudents(q)
      setSearchResults(Array.isArray(res.data) ? res.data : [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const onAddStudent = async () => {
    if (!pickedStudent) {
      Taro.showToast({ title: '请先选择学员', icon: 'none' })
      return
    }
    setAddingStudent(true)
    try {
      const res = await addTeacherCoachingStudent({
        studentId: pickedStudent.id,
        remainingMinutes: quotaMinutes,
      })
      if (res.code !== 200) {
        Taro.showToast({ title: res.msg || '添加失败', icon: 'none' })
        return
      }
      Taro.showToast({ title: '已添加学员', icon: 'success' })
      setPickedStudent(null)
      setSearchQ('')
      setSearchResults([])
      setShowStudentForm(false)
      void loadQuotas()
    } catch {
      Taro.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      setAddingStudent(false)
    }
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || '同学'
  const avatarUrl = resolveMediaUrl(user?.avatar)
  const avatarText = (displayName || '?').charAt(0).toUpperCase()

  const renderScheduleCard = (s: CoachingWeekSchedule) => {
    const st = s.status
    const canStart = st === 'scheduled'
    const canEnd = st === 'in_progress'
    const canEnter = st === 'in_progress'
    const slotEnd = parseSlotEnd(s.scheduledDate, s.endTime)
    const isPastSlot = st === 'scheduled' && !!slotEnd && slotEnd.getTime() < nowTs
    const minsLeft = st === 'in_progress' ? minutesUntilEnd(s.scheduledDate, s.endTime, nowTs) : null
    const pa = pendingAction[s.id] ?? null

    return (
      <View
        key={s.id}
        className={`lp__schedule-card ${canEnter ? 'lp__schedule-card--clickable' : ''}`}
        onClick={() => canEnter && Taro.navigateTo({ url: '/pages/material-selection/index' })}
      >
        <View className="lp__schedule-main">
          <Text className="lp__schedule-title">{s.title || `排课 #${s.id}`}</Text>
          <View className="lp__schedule-meta">
            <View className="lp__schedule-meta-item">
              <Clock size={14} color="#787671" />
              <Text className="lp__schedule-meta-text">
                {s.scheduledDate?.slice?.(0, 10) || s.scheduledDate} · {s.startTime}–{s.endTime}
              </Text>
            </View>
            {s.students && s.students.length > 0 && (
              <View className="lp__schedule-meta-item">
                <Text className="lp__schedule-meta-text">{s.students.join('、')}</Text>
              </View>
            )}
          </View>
          {st === 'scheduled' && !isPastSlot && (
            <Text className="lp__schedule-hint lp__schedule-hint--mint">可提前开始上课</Text>
          )}
          {isPastSlot && (
            <Text className="lp__schedule-hint lp__schedule-hint--muted">计划时段已过，仍可开始或删除</Text>
          )}
          {st === 'in_progress' && minsLeft != null && (
            <Text className="lp__schedule-hint lp__schedule-hint--mint">
              上课中 · 距结束约 {minsLeft} 分钟
            </Text>
          )}
        </View>
        <View className="lp__schedule-actions">
          {st === 'scheduled' && (
            <View
              className="lp__schedule-btn lp__schedule-btn--danger"
              onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
            >
              <Text className="lp__schedule-btn-text lp__schedule-btn-text--danger">删除</Text>
            </View>
          )}
          {canStart && (
            <CloudButton
              variant="brand"
              size="sm"
              loading={pa === 'start'}
              disabled={pa !== null}
              onClick={(e: any) => { e.stopPropagation(); onStart(s.id) }}
            >
              开始上课
            </CloudButton>
          )}
          {canEnd && (
            <CloudButton
              variant="destructive"
              size="sm"
              loading={pa === 'end'}
              disabled={pa !== null}
              onClick={(e: any) => { e.stopPropagation(); onEnd(s.id) }}
            >
              下课
            </CloudButton>
          )}
        </View>
      </View>
    )
  }

  return (
    <ScrollView className="home" scrollY enableFlex>
      {/* 顶部欢迎区 + 头像入口 */}
      <View className="lp__hero">
        <View className="lp__hero-info">
          <Text className="lp__greeting">{isCoach ? '陪练排课' : '我的课表'}</Text>
          <Text className="lp__week-range">{weekRangeLabel}</Text>
        </View>
        <View
          className="lp__hero-avatar"
          onClick={() => Taro.navigateTo({ url: '/pages/profile/index' })}
        >
          {avatarUrl ? (
            <Image className="lp__avatar-img" src={avatarUrl} mode="aspectFill" />
          ) : (
            <Text className="lp__avatar-text">{avatarText}</Text>
          )}
        </View>
      </View>

      {/* 周切换 */}
      <View className="lp__week-nav">
        <View className="lp__week-nav-btn" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>
          <Text className="lp__week-nav-text">上一周</Text>
        </View>
        <View className="lp__week-nav-btn" onClick={() => setWeekAnchor(new Date())}>
          <Text className="lp__week-nav-text lp__week-nav-text--primary">本周</Text>
        </View>
        <View className="lp__week-nav-btn" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>
          <Text className="lp__week-nav-text">下一周</Text>
        </View>
      </View>

      {/* 教练: 下一节课 + 统计 */}
      {isCoach && (
        <View className="lp__coach-grid">
          <View
            className={`lp__next-card ${!nextClass ? 'lp__next-card--disabled' : ''}`}
            onClick={() => {
              if (!nextClass) return
              if (nextClass.status === 'in_progress') {
                Taro.navigateTo({ url: '/pages/material-selection/index' })
              } else {
                onStart(nextClass.id)
              }
            }}
          >
            {nextClass ? (
              <>
                <Text className="lp__next-title">
                  {nextClass.title || nextClass.students?.[0] || '当前课程'}
                </Text>
                <Text className="lp__next-meta">
                  {nextClass.scheduledDate?.slice(0, 10)} · {nextClass.startTime}–{nextClass.endTime}
                </Text>
              </>
            ) : (
              <Text className="lp__next-title lp__next-title--muted">暂无待上课程</Text>
            )}
          </View>
          <View className="lp__stat-card">
            <View className="lp__stat-header">
              <Clock size={16} color="#55A3FF" />
              <Text className="lp__stat-label">待上 / 进行中</Text>
            </View>
            <Text className="lp__stat-value">{activeSchedules.length}</Text>
          </View>
        </View>
      )}

      {/* 教练: 新建排课 / 添加学员 */}
      {isCoach && (
        <View className="lp__action-grid">
          <View
            className="lp__action-btn lp__action-btn--brand"
            onClick={() => { setShowStudentForm(false); setShowScheduleForm((v) => !v) }}
          >
            <Plus size={16} color="#fff" />
            <Text className="lp__action-btn-text lp__action-btn-text--white">新建排课</Text>
          </View>
          <View
            className="lp__action-btn lp__action-btn--outline"
            onClick={() => { setShowScheduleForm(false); setShowStudentForm((v) => !v) }}
          >
            <Plus size={16} color="#4ECDC4" />
            <Text className="lp__action-btn-text">添加学员</Text>
          </View>
        </View>
      )}

      {/* 教练: 新建排课表单 */}
      {isCoach && showScheduleForm && (
        <View className="lp__form-card">
          <Text className="lp__form-title">新建排课</Text>
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
                <Right size={14} color="#a4a097" />
              </View>
            </Picker>
          </View>
          <View className="lp__form-row">
            <Text className="lp__form-label">日期</Text>
            <Picker
              mode="date"
              value={aDate}
              onChange={(e) => setADate(String(e.detail.value))}
            >
              <View className="lp__form-picker">
                <Text className="lp__form-picker-text">{aDate}</Text>
                <Right size={14} color="#a4a097" />
              </View>
            </Picker>
          </View>
          <View className="lp__form-row lp__form-row--two">
            <View className="lp__form-col">
              <Text className="lp__form-label">开始</Text>
              <Picker
                mode="time"
                value={aStart}
                onChange={(e) => setAStart(String(e.detail.value))}
              >
                <View className="lp__form-picker">
                  <Text className="lp__form-picker-text">{aStart}</Text>
                  <Right size={14} color="#a4a097" />
                </View>
              </Picker>
            </View>
            <View className="lp__form-col">
              <Text className="lp__form-label">结束</Text>
              <Picker
                mode="time"
                value={aEnd}
                onChange={(e) => setAEnd(String(e.detail.value))}
              >
                <View className="lp__form-picker">
                  <Text className="lp__form-picker-text">{aEnd}</Text>
                  <Right size={14} color="#a4a097" />
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
      )}

      {/* 教练: 添加学员表单 */}
      {isCoach && showStudentForm && (
        <View className="lp__form-card">
          <Text className="lp__form-title">添加学员</Text>
          <Input
            className="lp__form-input"
            value={searchQ}
            onInput={(e) => setSearchQ(e.detail.value)}
            placeholder="搜索用户名、昵称或手机号"
          />
          <CloudButton variant="brand" loading={searching} onClick={onSearchStudents}>
            搜索
          </CloudButton>
          {searchResults.length > 0 && (
            <View className="lp__search-results">
              {searchResults.map((u) => (
                <View
                  key={u.id}
                  className={`lp__search-item ${pickedStudent?.id === u.id ? 'lp__search-item--active' : ''}`}
                  onClick={() => setPickedStudent(u)}
                >
                  <Text className="lp__search-name">{u.displayName || u.username}</Text>
                  <Text className="lp__search-sub">
                    {u.username}{u.phone ? ` · ${u.phone}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View className="lp__form-row">
            <Text className="lp__form-label">陪练剩余分钟</Text>
            <Input
              className="lp__form-input"
              type="number"
              value={String(quotaMinutes)}
              onInput={(e) => setQuotaMinutes(Number(e.detail.value) || 0)}
            />
          </View>
          <CloudButton variant="brand" loading={addingStudent} onClick={onAddStudent}>
            确认添加
          </CloudButton>
        </View>
      )}

      {/* 课表列表 */}
      <View className="lp__schedule-list">
        {loading ? (
          <View className="lp__state">
            <Text className="lp__state-text">加载中...</Text>
          </View>
        ) : activeSchedules.length === 0 ? (
          <View className="lp__state">
            <Text className="lp__state-title">本周暂无待上课程</Text>
          </View>
        ) : (
          activeSchedules.map(renderScheduleCard)
        )}
      </View>

      <View style={{ height: '48rpx' }} />
    </ScrollView>
  )
}
