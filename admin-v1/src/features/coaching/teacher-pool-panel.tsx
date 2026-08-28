import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { get, put } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  formatMinutes,
  personLabel,
} from './quota-display'

export type TeacherPoolRow = {
  id: number
  teacherId: number
  remainingMinutes: number
  totalAllocatedMinutes: number
  teacher?: {
    id?: number
    username?: string
    displayName?: string
    email?: string
  }
}

export function TeacherPoolPanel() {
  const [list, setList] = useState<TeacherPoolRow[]>([])
  const [loading, setLoading] = useState(false)
  const [teacherFilter, setTeacherFilter] = useState('')
  const [edit, setEdit] = useState<TeacherPoolRow | null>(null)
  const [remaining, setRemaining] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<TeacherPoolRow[]>('/coaching/teacher-pools', {
        params: {
          teacherId: teacherFilter.trim() || undefined,
        },
      })
      setList(Array.isArray(res.data) ? res.data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载失败')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [teacherFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = (row: TeacherPoolRow) => {
    setEdit(row)
    setRemaining(String(row.remainingMinutes))
  }

  const save = async () => {
    if (!edit) return
    const remainingMinutes = Number(remaining)
    if (!Number.isFinite(remainingMinutes) || remainingMinutes < 0) {
      toast.error('剩余分钟不能为负')
      return
    }
    setSaving(true)
    try {
      await put('/coaching/teacher-pools', {
        teacherId: edit.teacherId,
        remainingMinutes,
      })
      toast.success('已保存老师授课池')
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
        老师可授课<strong>总池</strong>：默认 0；公开注册赠送 1000 分钟（跨所有学员合计扣减）。
        开始上课需老师池 &gt; 0，且对应学员也有陪练剩余。下方「月度统计」仅供对账参考，不限制开课。
      </p>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='tp-teacher'>老师 ID</Label>
          <Input
            id='tp-teacher'
            className='w-28'
            placeholder='全部'
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
          />
        </div>
        <Button variant='outline' onClick={() => void load()} disabled={loading}>
          查询
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
              <TableHead>剩余可授</TableHead>
              <TableHead>累计分配</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className='w-20'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-center text-muted-foreground'>
                  暂无授课池记录（未开课的老师可能尚未生成行，注册后会自动创建）
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => {
                const empty = row.remainingMinutes <= 0
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
                    <TableCell className='tabular-nums font-medium'>
                      {formatMinutes(row.remainingMinutes)}
                    </TableCell>
                    <TableCell className='tabular-nums text-muted-foreground'>
                      {formatMinutes(row.totalAllocatedMinutes)}
                    </TableCell>
                    <TableCell>
                      {empty ? (
                        <Badge variant='destructive'>已用尽</Badge>
                      ) : (
                        <Badge variant='secondary'>可用</Badge>
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
            <DialogTitle>调整老师授课池</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className='grid gap-3 py-2'>
              <p className='text-sm text-muted-foreground'>
                {personLabel(edit.teacher, edit.teacherId)}（ID {edit.teacherId}）
              </p>
              <div className='grid gap-1.5'>
                <Label>剩余可授课分钟</Label>
                <Input
                  type='number'
                  min={0}
                  value={remaining}
                  onChange={(e) => setRemaining(e.target.value)}
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
