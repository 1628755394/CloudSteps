import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { get, put } from '@/lib/api'
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
  formatMinutes,
  personLabel,
  type StudentQuotaRow,
} from './quota-display'

type EditState = {
  mode: 'create' | 'edit'
  teacherId: string
  studentId: string
  remainingMinutes: string
}

export function StudentQuotasPanel() {
  const [list, setList] = useState<StudentQuotaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [teacherFilter, setTeacherFilter] = useState('')
  const [studentFilter, setStudentFilter] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<StudentQuotaRow[]>('/coaching/quotas', {
        params: {
          teacherId: teacherFilter.trim() || undefined,
          studentId: studentFilter.trim() || undefined,
        },
      })
      setList(Array.isArray(res.data) ? res.data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载学员额度失败')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [teacherFilter, studentFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEdit({
      mode: 'create',
      teacherId: teacherFilter.trim(),
      studentId: studentFilter.trim(),
      remainingMinutes: '60',
    })
  }

  const openEdit = (row: StudentQuotaRow) => {
    setEdit({
      mode: 'edit',
      teacherId: String(row.teacherId),
      studentId: String(row.studentId),
      remainingMinutes: String(row.remainingMinutes),
    })
  }

  const save = async () => {
    if (!edit) return
    const teacherId = Number(edit.teacherId)
    const studentId = Number(edit.studentId)
    const remainingMinutes = Number(edit.remainingMinutes)
    if (!teacherId || !studentId) {
      toast.error('请填写老师 ID 与学员 ID')
      return
    }
    if (!Number.isFinite(remainingMinutes) || remainingMinutes < 0) {
      toast.error('剩余分钟不能为负')
      return
    }
    setSaving(true)
    try {
      await put('/coaching/quotas', {
        teacherId,
        studentId,
        remainingMinutes,
      })
      toast.success(edit.mode === 'create' ? '已创建额度' : '已更新额度')
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
        学员在某老师名下的陪练剩余时长。开始上课时会从学员剩余分钟中扣减。
      </p>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='sq-teacher'>老师 ID</Label>
          <Input
            id='sq-teacher'
            className='w-28'
            placeholder='全部'
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='sq-student'>学员 ID</Label>
          <Input
            id='sq-student'
            className='w-28'
            placeholder='全部'
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
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
          新建 / 调整
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
              <TableHead>学员</TableHead>
              <TableHead>剩余</TableHead>
              <TableHead>累计分配</TableHead>
              <TableHead className='w-20'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='text-center text-muted-foreground'
                >
                  暂无师生额度记录
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className='font-medium'>
                      {personLabel(row.teacher, row.teacherId)}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      ID {row.teacherId}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='font-medium'>
                      {personLabel(row.student, row.studentId)}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      ID {row.studentId}
                    </div>
                  </TableCell>
                  <TableCell className='tabular-nums'>
                    {formatMinutes(row.remainingMinutes)}
                  </TableCell>
                  <TableCell className='text-muted-foreground tabular-nums'>
                    {formatMinutes(row.totalAllocatedMinutes)}
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
              ))
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.mode === 'create' ? '新建师生额度' : '调整学员剩余时长'}
            </DialogTitle>
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
                <Label>学员用户 ID</Label>
                <Input
                  value={edit.studentId}
                  onChange={(e) =>
                    setEdit({ ...edit, studentId: e.target.value })
                  }
                  disabled={edit.mode === 'edit'}
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>剩余分钟</Label>
                <Input
                  type='number'
                  min={0}
                  value={edit.remainingMinutes}
                  onChange={(e) =>
                    setEdit({ ...edit, remainingMinutes: e.target.value })
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
