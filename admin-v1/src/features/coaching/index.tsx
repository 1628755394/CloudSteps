import { useCallback, useEffect, useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { get } from '@/lib/api'
import { AdminPage } from '@/components/admin-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AppointmentDetailSheet } from './appointment-detail-sheet'
import {
  appointmentTitle,
  formatScheduleDate,
  monthRange,
  personLabel,
  slotLabel,
  statusBadge,
  weekRange,
  type CoachingAppointment,
} from './appointment-display'

const ALL = 'all'
const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: ALL, label: '全部状态' },
  { value: 'scheduled', label: '已排课' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
  { value: 'no_show', label: '未到课' },
] as const

export function CoachingPage() {
  const initial = weekRange()
  const [list, setList] = useState<CoachingAppointment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [status, setStatus] = useState(ALL)
  const [detail, setDetail] = useState<CoachingAppointment | null>(null)

  const load = useCallback(async () => {
    if (!from || !to) {
      toast.error('请选择开始和结束日期')
      return
    }
    if (from > to) {
      toast.error('开始日期不能晚于结束日期')
      return
    }
    setLoading(true)
    try {
      const res = await get<
        CoachingAppointment[] | { list?: CoachingAppointment[]; total?: number }
      >('/coaching/appointments', {
        params: {
          from,
          to,
          page,
          pageSize: PAGE_SIZE,
          status: status === ALL ? undefined : status,
        },
      })
      const data = res.data
      const rows = Array.isArray(data) ? data : data.list || []
      setList(rows)
      setTotal(Array.isArray(data) ? rows.length : data.total ?? rows.length)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载陪练失败')
    } finally {
      setLoading(false)
    }
  }, [from, to, page, status])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (row: CoachingAppointment) => {
    setDetail(row)
    try {
      const res = await get<CoachingAppointment>(
        `/coaching/appointments/${row.id}`
      )
      setDetail({ ...row, ...res.data })
    } catch {
      // list row already has summary fields
    }
  }

  const applyRange = (range: { from: string; to: string }) => {
    setFrom(range.from)
    setTo(range.to)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <AdminPage
      title='一对一陪练'
      description={`${from} ~ ${to} · 共 ${total} 条`}
    >
      <div className='mb-4 flex flex-wrap items-end gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='coaching-from'>开始日期</Label>
          <Input
            id='coaching-from'
            type='date'
            className='w-40'
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='coaching-to'>结束日期</Label>
          <Input
            id='coaching-to'
            type='date'
            className='w-40'
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>状态</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger className='w-36'>
              <SelectValue placeholder='全部状态' />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant='outline' onClick={() => void load()} disabled={loading}>
          查询
        </Button>
        <Button variant='ghost' size='sm' onClick={() => applyRange(weekRange())}>
          本周
        </Button>
        <Button variant='ghost' size='sm' onClick={() => applyRange(monthRange())}>
          本月
        </Button>
      </div>

      {loading ? (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          加载中…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead>
              <TableHead>时段</TableHead>
              <TableHead>老师</TableHead>
              <TableHead>学员</TableHead>
              <TableHead>课程</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className='w-24'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-center text-muted-foreground'
                >
                  该筛选条件下暂无排课
                </TableCell>
              </TableRow>
            ) : (
              list.map((a) => {
                const badge = statusBadge(a.status)
                return (
                  <TableRow
                    key={a.id}
                    className='cursor-pointer'
                    onClick={() => void openDetail(a)}
                  >
                    <TableCell className='whitespace-nowrap'>
                      {formatScheduleDate(a.scheduledDate)}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {slotLabel(a.startTime, a.endTime)}
                    </TableCell>
                    <TableCell>{personLabel(a.teacher, a.teacherId)}</TableCell>
                    <TableCell>{personLabel(a.student, a.studentId)}</TableCell>
                    <TableCell className='max-w-48 truncate'>
                      {appointmentTitle(a)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={(e) => {
                          e.stopPropagation()
                          void openDetail(a)
                        }}
                      >
                        <Eye />
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}

      <div className='mt-4 flex items-center justify-end gap-2'>
        <span className='text-xs text-muted-foreground tabular-nums'>
          第 {page}/{totalPages} 页
        </span>
        <Button
          variant='outline'
          size='sm'
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={page >= totalPages || loading || total === 0}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </Button>
      </div>

      <AppointmentDetailSheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
        appointment={detail}
      />
    </AdminPage>
  )
}
