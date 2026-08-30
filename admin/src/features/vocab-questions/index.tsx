import { useEffect, useState } from 'react'
import { Eye, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { del, get } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { AdminPage } from '@/components/admin-page'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  VocabQuestionDetailSheet,
  type VocabQuestion,
} from './question-detail-sheet'
import { VocabQuestionFormDialog } from './question-form-dialog'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

export function VocabQuestionsPage() {
  const [list, setList] = useState<VocabQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [level, setLevel] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<VocabQuestion | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<VocabQuestion | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VocabQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
      })
      if (keyword.trim()) params.append('word', keyword.trim())
      if (level !== 'all') params.append('level', level)
      const res = await get<{
        list?: VocabQuestion[]
        questions?: VocabQuestion[]
        total: number
      }>(`/vocab/questions?${params}`)
      setList(res.data.list || res.data.questions || [])
      setTotal(res.data.total || 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载题库失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, level])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (q: VocabQuestion) => {
    setEditing(q)
    setFormOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await del(`/vocab/questions/${deleteTarget.id}`)
      toast.success('已删除题目')
      setDeleteOpen(false)
      setDeleteTarget(null)
      if (detail?.id === deleteTarget.id) setDetail(null)
      await load(page)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AdminPage
      title='词汇测评题库'
      description={`共 ${total} 题`}
      extra={
        <Button onClick={openCreate}>
          <Plus />
          新增题目
        </Button>
      }
    >
      <form
        className='mb-4 flex flex-wrap gap-2'
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          void load(1)
        }}
      >
        <Input
          className='max-w-xs'
          value={keyword}
          placeholder='搜索单词'
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select
          value={level}
          onValueChange={(v) => {
            setLevel(v)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-[120px]'>
            <SelectValue placeholder='级别' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>全部级别</SelectItem>
            {LEVELS.map((lv) => (
              <SelectItem key={lv} value={lv}>
                {lv}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type='submit' variant='secondary'>
          搜索
        </Button>
      </form>
      {loading ? (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          加载中…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>单词</TableHead>
              <TableHead>正确答案</TableHead>
              <TableHead>级别</TableHead>
              <TableHead>难度</TableHead>
              <TableHead>音频</TableHead>
              <TableHead className='w-48'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-center text-muted-foreground'
                >
                  暂无题目
                </TableCell>
              </TableRow>
            ) : (
              list.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>{q.id}</TableCell>
                  <TableCell className='font-medium'>{q.word}</TableCell>
                  <TableCell className='max-w-xs truncate'>
                    {q.correctAnswer || '—'}
                  </TableCell>
                  <TableCell>{q.level}</TableCell>
                  <TableCell>{q.difficultyScore ?? '—'}</TableCell>
                  <TableCell>{q.audioUrl ? '有' : '无'}</TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-1'>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => setDetail(q)}
                      >
                        <Eye />
                        详情
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => openEdit(q)}
                      >
                        <Pencil />
                        编辑
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='text-destructive hover:text-destructive'
                        onClick={() => {
                          setDeleteTarget(q)
                          setDeleteOpen(true)
                        }}
                      >
                        <Trash2 />
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
      <div className='mt-4 flex justify-end gap-2 text-sm'>
        <Button
          variant='outline'
          size='sm'
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </Button>
      </div>

      <VocabQuestionDetailSheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
        question={detail}
        onEdit={(q) => {
          setDetail(null)
          openEdit(q)
        }}
      />

      <VocabQuestionFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        question={editing}
        onSaved={() => load(page)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          setDeleteOpen(v)
          if (!v) setDeleteTarget(null)
        }}
        destructive
        isLoading={deleting}
        title='确认删除题目？'
        desc={
          deleteTarget
            ? `将永久删除单词「${deleteTarget.word}」（ID ${deleteTarget.id}）。此操作不可撤销。`
            : '将永久删除该题目。'
        }
        confirmText='删除'
        cancelBtnText='取消'
        handleConfirm={handleDeleteConfirm}
      />
    </AdminPage>
  )
}
