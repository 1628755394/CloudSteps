import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { get, put } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  capLabel,
  formatMinutes,
  monthFromPeriodStart,
  personLabel,
  type TeacherUsageRow,
} from './quota-display'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type EditState = {
  mode: 'create' | 'edit'
  teacherId: string
  month: string
  capMinutes: string
  usedMinutes: string
}

export function TeacherUsagePanel() {
  const [list, setList] = useState<TeacherUsageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [teacherFilter, setTeacherFilter] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<TeacherUsageRow[]>('/coaching/usage-periods', {
        params: {
          teacherId: teacherFilter.trim() || undefined,
          limit: 100,
        },
      })
      setList(Array.isArray(res.data) ? res.data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载老师额度失败')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [teacherFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEdit({
      mode: 'create',
      teacherId: teacherFilter.trim(),
      month: currentMonth(),
      capMinutes: '1000',
      usedMinutes: '0',
    })
  }

  const openEdit = (row: TeacherUsageRow) => {
    setEdit({
      mode: 'edit',
      teacherId: String(row.teacherId),
      month: monthFromPeriodStart(row.periodStart),
      capMinutes: String(row.capMinutes),
      usedMinutes: String(row.usedMinutes),
    })
  }

  const save = async () => {
    if (!edit) return
    const teacherId = Number(edit.teacherId)
    const month = edit.month.trim()
    if (!teacherId) {
      toast.error('请填写老师 ID')
      return
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      toast.error('月份格式应为 YYYY-MM')
      return
    }
    const capMinutes = Number(edit.capMinutes)
    const usedMinutes = Number(edit.usedMinutes)
    if (!Number.isFinite(capMinutes) || capMinutes < 0) {
      toast.error('授课上限不能为负')
      return
    }
    if (!Number.isFinite(usedMinutes) || usedMinutes < 0) {
      toast.error('已用分钟不能为负')
      return
    }
    setSaving(true)
    try {
      await put('/coaching/usage-periods', {
        teacherId,
        month,
        capMinutes,
        usedMinutes,
      })
      toast.success('已保存老师授课额度')
      setEdit(null)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='space-y-4'>
      <p className='text-sm text-muted-foreground'>
        老师历史上每月已授课分钟（仅统计，<strong>不限制</strong>
        开课）。开课限制请看「老师授课池」。
      </p>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='tu-teacher'>老师 ID</Label>
          <Input
            id='tu-teacher'
            className='w-28'
            placeholder='全部'
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
          />
        </div>
        <Button
          variant='outline'
          onClick={() => void load()}
          disabled={loading}
        >
          查询
        </Button>
        <Button onClick={openCreate}>
          <Plus className='size-4' />
          设置月份额度
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
              <TableHead>老师</TableHead>
              <TableHead>月份</TableHead>
              <TableHead>授课上限</TableHead>
              <TableHead>已用</TableHead>
              <TableHead>剩余</TableHead>
              <TableHead className='w-20'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-center text-muted-foreground'
                >
                  暂无老师授课额度记录
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => {
                const cap = row.capMinutes
                const used = row.usedMinutes
                const room = cap > 0 ? Math.max(0, cap - used) : null
                const full = cap > 0 && used >= cap
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className='font-medium'>
                        {personLabel(row.teacher, row.teacherId)}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        ID {row.teacherId}
                      </div>
                    </TableCell>
                    <TableCell className='tabular-nums'>
                      {monthFromPeriodStart(row.periodStart)}
                    </TableCell>
                    <TableCell>{capLabel(cap)}</TableCell>
                    <TableCell className='tabular-nums'>
                      {formatMinutes(used)}
                    </TableCell>
                    <TableCell>
                      {cap <= 0 ? (
                        <Badge variant='secondary'>不限</Badge>
                      ) : full ? (
                        <Badge variant='destructive'>已满</Badge>
                      ) : (
                        <span className='text-sm tabular-nums'>
                          {formatMinutes(room ?? 0)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className='size-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设置老师授课额度</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className='grid gap-3 py-2'>
              <div className='grid gap-1.5'>
                <Label>老师用户 ID</Label>
                <Input
                  value={edit.teacherId}
                  onChange={(e) =>
                    setEdit({ ...edit, teacherId: e.target.value })
                  }
                  disabled={edit.mode === 'edit'}
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>月份 (YYYY-MM)</Label>
                <Input
                  value={edit.month}
                  onChange={(e) => setEdit({ ...edit, month: e.target.value })}
                  disabled={edit.mode === 'edit'}
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>授课上限（分钟，0=不限制）</Label>
                <Input
                  type='number'
                  min={0}
                  value={edit.capMinutes}
                  onChange={(e) =>
                    setEdit({ ...edit, capMinutes: e.target.value })
                  }
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>已用分钟</Label>
                <Input
                  type='number'
                  min={0}
                  value={edit.usedMinutes}
                  onChange={(e) =>
                    setEdit({ ...edit, usedMinutes: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setEdit(null)}>
              取消
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
