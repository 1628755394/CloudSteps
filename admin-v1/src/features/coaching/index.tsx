import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { get } from '@/lib/api'
import { AdminPage } from '@/components/admin-page'
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

function weekRange() {
  const x = new Date()
  const fromMon = (x.getDay() + 6) % 7
  const mon = new Date(x)
  mon.setDate(x.getDate() - fromMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(mon), to: fmt(sun) }
}

export function CoachingPage() {
  const [list, setList] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const range = weekRange()

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await get<Appointment[] | { list?: Appointment[] }>(
          `/coaching/appointments?from=${range.from}&to=${range.to}`
        )
        const data = res.data
        setList(Array.isArray(data) ? data : data.list || [])
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : '加载陪练失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [range.from, range.to])

  return (
    <AdminPage
      title='一对一陪练'
      description={`${range.from} ~ ${range.to} 本周预约`}
    >
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
                  本周暂无预约
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
