import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { get } from '@/lib/api'
import { AdminPage } from '@/components/admin-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Appointment = {
  id: number
  teacherId?: number
  studentId?: number
  scheduledDate?: string
  startTime?: string
  endTime?: string
  status?: string
  title?: string
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function weekRange(): { from: string; to: string } {
  const x = new Date()
  const fromMon = (x.getDay() + 6) % 7
  const mon = new Date(x)
  mon.setDate(x.getDate() - fromMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: fmtDate(mon), to: fmtDate(sun) }
}

function monthRange(): { from: string; to: string } {
  const x = new Date()
  const from = new Date(x.getFullYear(), x.getMonth(), 1)
  const to = new Date(x.getFullYear(), x.getMonth() + 1, 0)
  return { from: fmtDate(from), to: fmtDate(to) }
}

export function CoachingPage() {
  const [list, setList] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState(weekRange().from)
  const [to, setTo] = useState(weekRange().to)

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
      const res = await get<Appointment[] | { list?: Appointment[] }>(
        `/coaching/appointments?from=${from}&to=${to}`
      )
      const data = res.data
      setList(Array.isArray(data) ? data : data.list || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载陪练失败')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <AdminPage
      title='一对一陪练'
      description={`${from} ~ ${to} 预约记录`}
    >
      <div className='mb-4 flex flex-wrap items-end gap-4'>
        <div className='grid gap-1.5'>
          <Label htmlFor='coaching-from'>开始日期</Label>
          <Input
            id='coaching-from'
            type='date'
            className='w-40'
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='coaching-to'>结束日期</Label>
          <Input
            id='coaching-to'
            type='date'
            className='w-40'
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button variant='outline' onClick={() => void load()} disabled={loading}>
          查询
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => {
            const r = weekRange()
            setFrom(r.from)
            setTo(r.to)
          }}
        >
          本周
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => {
            const r = monthRange()
            setFrom(r.from)
            setTo(r.to)
          }}
        >
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
              <TableHead>学员 ID</TableHead>
              <TableHead>老师 ID</TableHead>
              <TableHead>开始</TableHead>
              <TableHead>结束</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-center text-muted-foreground'>
                  该日期范围内暂无预约
                </TableCell>
              </TableRow>
            ) : (
              list.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.studentId ?? '—'}</TableCell>
                  <TableCell>{a.teacherId ?? '—'}</TableCell>
                  <TableCell>
                    {[a.scheduledDate, a.startTime].filter(Boolean).join(' ') || '—'}
                  </TableCell>
                  <TableCell>
                    {[a.scheduledDate, a.endTime].filter(Boolean).join(' ') || '—'}
                  </TableCell>
                  <TableCell>{a.status || a.title || '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </AdminPage>
  )
}
