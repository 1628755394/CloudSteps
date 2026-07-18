import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  DatePicker as ArcoDatePicker,
  Input as ArcoInput,
  InputNumber,
  Select,
  Tabs,
  TimePicker as ArcoTimePicker,
  Button as ArcoButton,
} from '@arco-design/web-react'
import { Calendar as CalendarIcon, Plus, RefreshCw, Trash2, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import { showAlert } from '@/utils/notification'
import { get, post, put, del } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'
import { listUsers, type User } from '@/services/adminApi'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-slate-500 mb-1.5">{children}</div>
}

function UserSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  placeholder: string
}) {
  return (
    <Select
      placeholder={placeholder}
      value={value || undefined}
      onChange={(v) => onChange(v ? String(v) : '')}
      allowClear
      showSearch
      filterOption={(input, option) =>
        String(option?.props?.children ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      style={{ width: '100%' }}
    >
      {options.map((o) => (
        <Select.Option key={o.value} value={o.value}>
          {o.label}
        </Select.Option>
      ))}
    </Select>
  )
}

const BASE = () => getApiBaseURL()

function fmtYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weekRange(ref: Date) {
  const x = new Date(ref)
  const wd = x.getDay()
  const fromMon = (wd + 6) % 7
  const mon = new Date(x)
  mon.setDate(x.getDate() - fromMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: fmtYMD(mon), to: fmtYMD(sun) }
}

type Quota = {
  id: number
  teacherId: number
  studentId: number
  remainingMinutes: number
  teacher?: { displayName?: string; username?: string; email?: string }
  student?: { displayName?: string; username?: string; email?: string }
}

// 将分钟转换为小时显示
const formatHours = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}小时`;
  return `${hours}小时${mins}分钟`;
};

type Appointment = {
  id: number
  teacherId: number
  studentId: number
  scheduledDate: string
  startTime: string
  endTime: string
  status: string
  title?: string
}

type UsagePeriod = {
  id: number
  teacherId: number
  periodStart: string
  periodEnd: string
  usedMinutes: number
  capMinutes: number
}

type CoachingAuditLog = {
  id: number
  createdAt: string
  actorId: number
  actorUsername: string
  actorRole: string
  action: string
  targetType: string
  targetId: number
  appointmentId: number
  summary: string
  detail?: Record<string, unknown>
  ip?: string
}

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Coaching() {
  const [tab, setTab] = useState<'quota' | 'appt' | 'usage' | 'audit'>('quota')
  const [quotas, setQuotas] = useState<Quota[]>([])
  const [appts, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [teachers, setTeachers] = useState<User[]>([])
  const [students, setStudents] = useState<User[]>([])

  const [range, setRange] = useState(() => weekRange(new Date()))
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())

  const [qTeacher, setQTeacher] = useState('')
  const [qStudent, setQStudent] = useState('')
  const [qMin, setQMin] = useState('60')

  const [aTeacher, setATeacher] = useState('')
  const [aStudent, setAStudent] = useState('')
  const [aDate, setADate] = useState(fmtYMD(new Date()))
  const [aStart, setAStart] = useState('09:00')
  const [aEnd, setAEnd] = useState('10:00')
  const [aTitle, setATitle] = useState('')

  const [usageTeacher, setUsageTeacher] = useState('')
  const [usageRows, setUsageRows] = useState<UsagePeriod[]>([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageMonth, setUsageMonth] = useState(currentMonthStr)
  const [usageCap, setUsageCap] = useState('0')
  const [usageUsed, setUsageUsed] = useState('0')

  const [auditLogs, setAuditLogs] = useState<CoachingAuditLog[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const auditPageSize = 20
  const [auditAction, setAuditAction] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)
  /** 与 auditPage 配合，保证「查询」在停留第 1 页时也能重新拉取 */
  const [auditQueryNonce, setAuditQueryNonce] = useState(0)

  const loadUsers = useCallback(async () => {
    try {
      const [tRes, sRes, t2] = await Promise.all([
        listUsers({ page: 1, pageSize: 200, role: 'teacher' }),
        listUsers({ page: 1, pageSize: 200, role: 'student' }),
        listUsers({ page: 1, pageSize: 200, role: 'user' }),
      ])
      const tList = [...(tRes.users || []), ...(t2.users || [])]
      const seen = new Set<number>()
      const merge: User[] = []
      for (const u of tList) {
        if (seen.has(u.id)) continue
        seen.add(u.id)
        merge.push(u)
      }
      setTeachers(merge)
      setStudents(sRes.users || [])
    } catch (e: any) {
      showAlert(e?.msg || '加载用户失败', 'error')
    }
  }, [])

  const loadQuotas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<Quota[]>(`${BASE()}/coaching/quotas`)
      if (res.code !== 200) throw new Error(res.msg)
      setQuotas(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) {
      showAlert(e?.msg || '加载额度失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAppts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<Appointment[]>(
        `${BASE()}/coaching/appointments?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      )
      if (res.code !== 200) throw new Error(res.msg)
      setAppts(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) {
      showAlert(e?.msg || '加载排课失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const loadUsage = useCallback(async () => {
    const tid = Number(usageTeacher)
    if (!tid) {
      setUsageRows([])
      return
    }
    setUsageLoading(true)
    try {
      const res = await get<UsagePeriod[]>(`${BASE()}/coaching/usage-periods?teacherId=${tid}&limit=36`)
      if (res.code !== 200) throw new Error(res.msg)
      setUsageRows(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) {
      showAlert(e?.msg || '加载计量失败', 'error')
    } finally {
      setUsageLoading(false)
    }
  }, [usageTeacher])

  useEffect(() => {
    if (tab !== 'audit') return
    let cancelled = false
    ;(async () => {
      setAuditLoading(true)
      try {
        const q = new URLSearchParams({
          page: String(auditPage),
          pageSize: String(auditPageSize),
        })
        if (auditAction.trim()) q.set('action', auditAction.trim())
        const res = await get<{ list: CoachingAuditLog[]; total: number; page: number; pageSize: number }>(
          `${BASE()}/coaching/audit-logs?${q.toString()}`
        )
        if (cancelled) return
        if (res.code !== 200) throw new Error(res.msg)
        const d = res.data
        setAuditLogs(Array.isArray(d?.list) ? d.list : [])
        setAuditTotal(typeof d?.total === 'number' ? d.total : 0)
      } catch (e: any) {
        if (!cancelled) showAlert(e?.msg || '加载审计失败', 'error')
      } finally {
        if (!cancelled) setAuditLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, auditPage, auditAction, auditQueryNonce])

  useEffect(() => {
    if (tab === 'quota') void loadQuotas()
    else if (tab === 'appt') void loadAppts()
    else if (tab === 'usage') void loadUsage()
  }, [tab, loadQuotas, loadAppts, loadUsage])

  const saveUsagePeriod = async () => {
    const tid = Number(usageTeacher)
    if (!tid) {
      showAlert('请选择老师', 'error')
      return
    }
    const capHours = Number(usageCap)
    const usedHours = Number(usageUsed)
    if (Number.isNaN(capHours) || Number.isNaN(usedHours) || capHours < 0 || usedHours < 0) {
      showAlert('封顶/已用时间无效', 'error')
      return
    }
    // 将小时转换为分钟保存到后端
    const capMinutes = capHours * 60
    const usedMinutes = usedHours * 60
    try {
      const res = await put(`${BASE()}/coaching/usage-periods`, {
        teacherId: tid,
        month: usageMonth,
        capMinutes: capMinutes,
        usedMinutes: usedMinutes,
      })
      if (res.code !== 200) throw new Error(res.msg)
      showAlert('已保存', 'success')
      void loadUsage()
    } catch (e: any) {
      showAlert(e?.msg || '保存失败', 'error')
    }
  }

  const saveQuota = async () => {
    const tid = Number(qTeacher)
    const sid = Number(qStudent)
    const hours = Number(qMin)
    if (!tid || !sid) {
      showAlert('请选择老师与学员', 'error')
      return
    }
    if (Number.isNaN(hours) || hours < 0) {
      showAlert('剩余时间无效', 'error')
      return
    }
    // 将小时转换为分钟保存到后端
    const mins = hours * 60
    try {
      const res = await put(`${BASE()}/coaching/quotas`, {
        teacherId: tid,
        studentId: sid,
        remainingMinutes: mins,
      })
      if (res.code !== 200) throw new Error(res.msg)
      showAlert('已保存额度', 'success')
      void loadQuotas()
    } catch (e: any) {
      showAlert(e?.msg || '保存失败', 'error')
    }
  }

  const createAppt = async () => {
    const tid = Number(aTeacher)
    const sid = Number(aStudent)
    if (!tid || !sid) {
      showAlert('请选择老师与学员', 'error')
      return
    }
    try {
      const res = await post(`${BASE()}/coaching/appointments`, {
        teacherId: tid,
        studentId: sid,
        scheduledDate: aDate,
        startTime: aStart,
        endTime: aEnd,
        title: aTitle || undefined,
      })
      if (res.code !== 200) throw new Error(res.msg)
      showAlert('已创建排课', 'success')
      void loadAppts()
    } catch (e: any) {
      showAlert(e?.msg || '创建失败', 'error')
    }
  }

  const removeAppt = async (id: number) => {
    if (!confirm('确定删除该排课？')) return
    try {
      const res = await del(`${BASE()}/coaching/appointments/${id}`)
      if (res.code !== 200) throw new Error(res.msg)
      void loadAppts()
    } catch (e: any) {
      showAlert(e?.msg || '删除失败', 'error')
    }
  }

  const shiftWeek = (delta: number) => {
    const next = new Date(weekAnchor)
    next.setDate(next.getDate() + delta * 7)
    setWeekAnchor(next)
    setRange(weekRange(next))
  }

  const setWeekFromDate = (date: Date | null) => {
    if (!date) return
    setWeekAnchor(date)
    setRange(weekRange(date))
  }

  const userLabel = (u?: { displayName?: string; email?: string; username?: string }, fallback = '') =>
    u?.displayName || u?.username || u?.email || fallback

  const teacherSelectOptions = useMemo(
    () =>
      teachers.map((u) => ({
        label: `${userLabel(u)}${u.role ? ` (${u.role})` : ''}`,
        value: String(u.id),
      })),
    [teachers]
  )

  const studentSelectOptions = useMemo(
    () => students.map((u) => ({ label: userLabel(u), value: String(u.id) })),
    [students]
  )

  const formatAuditDetail = (d?: Record<string, unknown>) => {
    if (!d || Object.keys(d).length === 0) return '—'
    try {
      return JSON.stringify(d)
    } catch {
      return '—'
    }
  }

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-teal-500" />
            一对一陪练
          </h1>
          <p className="text-sm text-slate-500 mt-1">额度、排课、老师周期用量/封顶（下课时学员扣减与计入老师用量分别见说明）</p>
        </div>

        <Tabs activeTab={tab} onChange={(k) => setTab(k as typeof tab)} type="rounded">
          <Tabs.TabPane key="quota" title="陪练额度">
            <Card className="p-6 space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <FieldLabel>老师</FieldLabel>
                <UserSelect
                  value={qTeacher}
                  onChange={setQTeacher}
                  options={teacherSelectOptions}
                  placeholder="选择老师"
                />
              </div>
              <div>
                <FieldLabel>学员</FieldLabel>
                <UserSelect
                  value={qStudent}
                  onChange={setQStudent}
                  options={studentSelectOptions}
                  placeholder="选择学员"
                />
              </div>
              <div>
                <FieldLabel>剩余时间（小时）</FieldLabel>
                <InputNumber
                  min={0}
                  value={Number(qMin) || 0}
                  onChange={(v) => setQMin(String(v ?? 0))}
                  style={{ width: '100%' }}
                />
              </div>
              <Button leftIcon={<Save className="w-4 h-4" />} onClick={() => void saveQuota()}>
                保存额度
              </Button>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => void loadQuotas()}>
                刷新
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                    <th className="p-2">老师</th>
                    <th className="p-2">学员</th>
                    <th className="p-2">剩余时间</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        加载中…
                      </td>
                    </tr>
                  ) : quotas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        暂无记录
                      </td>
                    </tr>
                  ) : (
                    quotas.map((q) => (
                      <tr key={q.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="p-2">{userLabel(q.teacher)}</td>
                        <td className="p-2">{userLabel(q.student)}</td>
                        <td className="p-2 font-medium">{formatHours(q.remainingMinutes)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane key="usage" title="老师计量">
            <Card className="p-6 space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="lg:col-span-2">
                <FieldLabel>老师</FieldLabel>
                <UserSelect
                  value={usageTeacher}
                  onChange={setUsageTeacher}
                  options={teacherSelectOptions}
                  placeholder="选择后加载历史周期"
                />
              </div>
              <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => void loadUsage()}>
                刷新列表
              </Button>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">编辑某月封顶 / 已用（0 封顶表示不限制）</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <FieldLabel>月份</FieldLabel>
                  <ArcoDatePicker.MonthPicker
                    value={usageMonth}
                    onChange={(v) => setUsageMonth(v || currentMonthStr())}
                    style={{ width: '100%' }}
                    allowClear={false}
                  />
                </div>
                <div>
                  <FieldLabel>封顶 cap（小时）</FieldLabel>
                  <InputNumber
                    min={0}
                    value={Number(usageCap) || 0}
                    onChange={(v) => setUsageCap(String(v ?? 0))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <FieldLabel>已用 used（小时）</FieldLabel>
                  <InputNumber
                    min={0}
                    value={Number(usageUsed) || 0}
                    onChange={(v) => setUsageUsed(String(v ?? 0))}
                    style={{ width: '100%' }}
                  />
                </div>
                <Button leftIcon={<Save className="w-4 h-4" />} onClick={() => void saveUsagePeriod()}>
                  保存该月
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                    <th className="p-2">周期起</th>
                    <th className="p-2">已用</th>
                    <th className="p-2">封顶</th>
                  </tr>
                </thead>
                <tbody>
                  {!usageTeacher ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        请选择老师
                      </td>
                    </tr>
                  ) : usageLoading ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        加载中…
                      </td>
                    </tr>
                  ) : usageRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        暂无周期记录（可在上方保存该月以创建）
                      </td>
                    </tr>
                  ) : (
                    usageRows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="p-2">{String(r.periodStart).slice(0, 10)}</td>
                        <td className="p-2">{r.usedMinutes}</td>
                        <td className="p-2">{r.capMinutes === 0 ? '不限制' : r.capMinutes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane key="audit" title="操作审计">
            <Card className="p-6 space-y-6 mt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="min-w-[240px]">
                <FieldLabel>action 筛选（可选）</FieldLabel>
                <ArcoInput
                  value={auditAction}
                  onChange={setAuditAction}
                  placeholder="如 session_start、quota_upsert"
                  allowClear
                />
              </div>
              <Button
                variant="outline"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={() => {
                  setAuditPage(1)
                  setAuditQueryNonce((n) => n + 1)
                }}
              >
                查询
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                    <th className="p-2 whitespace-nowrap">时间</th>
                    <th className="p-2">操作者</th>
                    <th className="p-2">action</th>
                    <th className="p-2">摘要</th>
                    <th className="p-2 whitespace-nowrap">排课ID</th>
                    <th className="p-2 min-w-[200px]">detail</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500">
                        加载中…
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500">
                        暂无记录
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 align-top">
                        <td className="p-2 whitespace-nowrap text-xs">
                          {row.createdAt ? String(row.createdAt).replace('T', ' ').slice(0, 19) : '—'}
                        </td>
                        <td className="p-2 text-xs">
                          {row.actorUsername || '—'}
                          <div className="text-slate-400">{row.actorRole}</div>
                        </td>
                        <td className="p-2 font-mono text-xs">{row.action}</td>
                        <td className="p-2 text-xs max-w-[220px]">{row.summary}</td>
                        <td className="p-2 font-mono text-xs">{row.appointmentId || '—'}</td>
                        <td className="p-2 text-xs text-slate-600 dark:text-slate-400 break-all max-w-md">
                          {formatAuditDetail(row.detail)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>
                共 {auditTotal} 条 · 第 {auditPage} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={auditPage <= 1 || auditLoading}
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  disabled={auditPage * auditPageSize >= auditTotal || auditLoading}
                  onClick={() => setAuditPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane key="appt" title="排课">
            <Card className="p-6 space-y-6 mt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex items-center gap-2">
                <ArcoButton icon={<ChevronLeft className="w-4 h-4" />} onClick={() => shiftWeek(-1)} />
                <ArcoButton icon={<ChevronRight className="w-4 h-4" />} onClick={() => shiftWeek(1)} />
              </div>
              <div className="min-w-[220px]">
                <FieldLabel>选择周（点选任意一天）</FieldLabel>
                <ArcoDatePicker
                  value={range.from}
                  onChange={(_, date) => date && setWeekFromDate(date.toDate())}
                  style={{ width: '100%' }}
                  allowClear={false}
                />
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 pb-2">
                当前周：<span className="font-medium">{range.from}</span> 至 <span className="font-medium">{range.to}</span>
              </div>
              <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => void loadAppts()}>
                刷新列表
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
              <div>
                <FieldLabel>老师</FieldLabel>
                <UserSelect
                  value={aTeacher}
                  onChange={setATeacher}
                  options={teacherSelectOptions}
                  placeholder="选择老师"
                />
              </div>
              <div>
                <FieldLabel>学员</FieldLabel>
                <UserSelect
                  value={aStudent}
                  onChange={setAStudent}
                  options={studentSelectOptions}
                  placeholder="选择学员"
                />
              </div>
              <div>
                <FieldLabel>上课日期</FieldLabel>
                <ArcoDatePicker
                  value={aDate}
                  onChange={(_, date) => date && setADate(fmtYMD(date.toDate()))}
                  style={{ width: '100%' }}
                  allowClear={false}
                />
              </div>
              <div>
                <FieldLabel>开始时间</FieldLabel>
                <ArcoTimePicker
                  format="HH:mm"
                  value={aStart}
                  onChange={(v) => setAStart(v || '09:00')}
                  step={{ minute: 5 }}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <FieldLabel>结束时间</FieldLabel>
                <ArcoTimePicker
                  format="HH:mm"
                  value={aEnd}
                  onChange={(v) => setAEnd(v || '10:00')}
                  step={{ minute: 5 }}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <FieldLabel>标题（可选）</FieldLabel>
                <ArcoInput value={aTitle} onChange={setATitle} allowClear placeholder="排课标题" />
              </div>
              <div className="flex items-end">
                <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => void createAppt()}>
                  新建排课
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                    <th className="p-2">日期</th>
                    <th className="p-2">时段</th>
                    <th className="p-2">状态</th>
                    <th className="p-2 w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {appts.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="p-2">{a.scheduledDate?.slice?.(0, 10) || a.scheduledDate}</td>
                      <td className="p-2">
                        {a.startTime}–{a.endTime}
                      </td>
                      <td className="p-2">{a.status}</td>
                      <td className="p-2">
                        <button
                          type="button"
                          className="text-red-600 hover:underline text-xs flex items-center gap-1"
                          onClick={() => void removeAppt(a.id)}
                        >
                          <Trash2 className="w-3 h-3" /> 删
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </Card>
          </Tabs.TabPane>
        </Tabs>
      </motion.div>
    </AdminLayout>
  )
}
