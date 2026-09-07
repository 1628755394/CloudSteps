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
  formatLessons,
  personLabel,
  type StudentQuotaRow,
} from './quota-display'

type EditState = {
  mode: 'create' | 'edit'
  teacherId: string
  studentId: string
  remainingLessons: string
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
      remainingLessons: '2',
    })
  }

  const openEdit = (row: StudentQuotaRow) => {
    setEdit({
      mode: 'edit',
      teacherId: String(row.teacherId),
      studentId: String(row.studentId),
      remainingLessons: String(row.remainingLessons),
    })
  }

  const save = async () => {
    if (!edit) return
    const teacherId = Number(edit.teacherId)
    const studentId = Number(edit.studentId)
    const remainingLessons = Number(edit.remainingLessons)
    if (!teacherId || !studentId) {
      toast.error('请填写老师 ID 与学员 ID')
      return
    }
    if (!Number.isFinite(remainingLessons) || remainingLessons < 0 || !Number.isInteger(remainingLessons)) {
      toast.error('剩余课时须为非负整数')
      return
    }
    setSaving(true)
    try {
      await put('/coaching/quotas', {
        teacherId,
        studentId,
        remainingLessons,
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
        学员在某老师名下的陪练剩余课时（节）。排课上课并完成训后检测时扣 1 节；首页练习不扣学员课时。
      </p>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='quota-teacher'>老师 ID</Label>
          <Input
            id='quota-teacher'
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            placeholder='可选'
            className='w-40'
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='quota-student'>学员 ID</Label>
          <Input
            id='quota-student'
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            placeholder='可选'
            className='w-40'
          />
        </div>
        <Button type='button' variant='secondary' onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className='size-4 animate-spin' /> : '刷新'}
        </Button>
        <Button type='button' onClick={openCreate}>
          <Plus className='size-4' />
          新建
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>老师</TableHead>
              <TableHead>学员</TableHead>
              <TableHead>剩余课时</TableHead>
              <TableHead>累计分配</TableHead>
              <TableHead className='w-24'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-center text-muted-foreground'>
                  {loading ? '加载中…' : '暂无数据'}
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{personLabel(row.teacher, row.teacherId)}</TableCell>
                  <TableCell>{personLabel(row.student, row.studentId)}</TableCell>
                  <TableCell>{formatLessons(row.remainingLessons)}</TableCell>
                  <TableCell>{formatLessons(row.totalAllocatedLessons)}</TableCell>
                  <TableCell>
                    <Button type='button' variant='ghost' size='icon' onClick={() => openEdit(row)}>
                      <Pencil className='size-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && !saving && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.mode === 'create' ? '新建学员课时' : '编辑学员课时'}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className='grid gap-3 py-2'>
              <div className='grid gap-1.5'>
                <Label>老师 ID</Label>
                <Input
                  value={edit.teacherId}
                  disabled={edit.mode === 'edit'}
                  onChange={(e) => setEdit({ ...edit, teacherId: e.target.value })}
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>学员 ID</Label>
                <Input
                  value={edit.studentId}
                  disabled={edit.mode === 'edit'}
                  onChange={(e) => setEdit({ ...edit, studentId: e.target.value })}
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>剩余课时（节）</Label>
                <Input
                  value={edit.remainingLessons}
                  onChange={(e) => setEdit({ ...edit, remainingLessons: e.target.value })}
                  inputMode='numeric'
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type='button' variant='secondary' disabled={saving} onClick={() => setEdit(null)}>
              取消
            </Button>
            <Button type='button' disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className='size-4 animate-spin' /> : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
