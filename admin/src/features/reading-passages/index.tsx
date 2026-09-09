import { useEffect, useRef, useState } from 'react'
import {
  BookMarked,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { del, get, post } from '@/lib/api'
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
import { ReadingPassageDetailSheet } from './detail-sheet'
import { ReadingPassageFormSheet } from './form-sheet'
import type { GenerateAnalysisResult, ReadingPassageRow } from './types'

const LEVELS = ['初阶', '中阶', '高阶'] as const
const ANALYSIS_TIMEOUT_MS = 180_000

export function ReadingPassagesPage() {
  const [list, setList] = useState<ReadingPassageRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [level, setLevel] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<ReadingPassageRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ReadingPassageRow | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ReadingPassageRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pageBatching, setPageBatching] = useState(false)
  const [batchProgress, setBatchProgress] = useState('')
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const abortBatchRef = useRef(false)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
      })
      if (keyword.trim()) params.append('keyword', keyword.trim())
      if (level !== 'all') params.append('level', level)
      if (status !== 'all') params.append('status', status)
      const res = await get<{ list: ReadingPassageRow[]; total: number }>(
        `/reading/admin/passages?${params}`
      )
      setList(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, level, status])

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await del(`/reading/admin/passages/${deleteTarget.id}`)
      toast.success('已删除')
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

  const generateOne = async (
    row: ReadingPassageRow,
    force = false
  ): Promise<GenerateAnalysisResult> => {
    const qs = force ? '?force=1' : ''
    const res = await post<GenerateAnalysisResult>(
      `/reading/admin/passages/${row.id}/analysis${qs}`,
      undefined,
      { timeout: ANALYSIS_TIMEOUT_MS }
    )
    return res.data
  }

  const markReady = (id: number) => {
    setList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, analysisReady: true } : item))
    )
  }

  const handleGenerateOne = async (row: ReadingPassageRow, force = false) => {
    if (generatingId != null || pageBatching) return
    setGeneratingId(row.id)
    try {
      const result = await generateOne(row, force)
      markReady(row.id)
      if (result.skipped) {
        toast.success(`「${row.title}」细学已就绪（跳过）`)
      } else {
        toast.success(
          `「${row.title}」细学已生成（${result.sentenceCount ?? 0} 句）`
        )
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '生成细学失败')
      await load(page)
    } finally {
      setGeneratingId(null)
    }
  }

  const startPageBatchAnalysis = async () => {
    if (pageBatching || loading || list.length === 0) return
    const targets = list.filter((row) => !row.analysisReady)
    if (targets.length === 0) {
      toast.message('当前页文章细学均已就绪')
      return
    }
    abortBatchRef.current = false
    setPageBatching(true)
    let ok = 0
    let fail = 0
    let skipped = 0
    try {
      for (let i = 0; i < targets.length; i += 1) {
        if (abortBatchRef.current) break
        const row = targets[i]
        setBatchProgress(`${i + 1}/${targets.length} · ${row.title}`)
        setGeneratingId(row.id)
        try {
          const result = await generateOne(row, false)
          markReady(row.id)
          if (result.skipped) skipped += 1
          else ok += 1
        } catch {
          fail += 1
        }
      }
      if (abortBatchRef.current) {
        toast.message(`已停止：成功 ${ok}，跳过 ${skipped}，失败 ${fail}`)
      } else {
        toast.success(`批量完成：成功 ${ok}，跳过 ${skipped}，失败 ${fail}`)
      }
      await load(page)
    } finally {
      setPageBatching(false)
      setBatchProgress('')
      setGeneratingId(null)
    }
  }

  return (
    <AdminPage
      title='系统阅读理解'
      description={`共 ${total} 篇系统文章。管理官方阅读理解题库。`}
      extra={
        <div className='flex flex-wrap items-center gap-2'>
          {pageBatching ? (
            <Button
              variant='outline'
              onClick={() => {
                abortBatchRef.current = true
              }}
            >
              停止批量
            </Button>
          ) : null}
          <Button
            variant='outline'
            disabled={pageBatching || loading || list.length === 0}
            onClick={() => void startPageBatchAnalysis()}
          >
            {pageBatching ? <Loader2 className='animate-spin' /> : <Wand2 />}
            {pageBatching
              ? batchProgress || '批量生成细学中…'
              : '批量生成当前页细学'}
          </Button>
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus />
            新增文章
          </Button>
        </div>
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
          placeholder='搜索标题/摘要'
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className='max-w-xs'
        />
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className='w-32'>
            <SelectValue placeholder='等级' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>全部等级</SelectItem>
            {LEVELS.map((lv) => (
              <SelectItem key={lv} value={lv}>
                {lv}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className='w-32'>
            <SelectValue placeholder='状态' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>全部状态</SelectItem>
            <SelectItem value='published'>已发布</SelectItem>
            <SelectItem value='draft'>草稿</SelectItem>
          </SelectContent>
        </Select>
        <Button type='submit' variant='secondary'>
          搜索
        </Button>
      </form>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>等级</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>词数</TableHead>
              <TableHead>细学</TableHead>
              <TableHead className='text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className='h-24 text-center'>
                  <Loader2 className='mx-auto size-5 animate-spin' />
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='h-24 text-center text-muted-foreground'
                >
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell className='max-w-[240px] truncate font-medium'>
                    {row.title}
                  </TableCell>
                  <TableCell>{row.level}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.wordCount ?? 0}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.analysisReady
                          ? 'text-emerald-600'
                          : 'text-muted-foreground'
                      }
                    >
                      {row.analysisReady ? '已生成' : '未生成'}
                    </span>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='ghost'
                      size='sm'
                      title={row.analysisReady ? '重新生成细学' : '生成细学'}
                      disabled={pageBatching || generatingId != null}
                      onClick={() =>
                        void handleGenerateOne(row, Boolean(row.analysisReady))
                      }
                    >
                      {generatingId === row.id ? (
                        <Loader2 className='animate-spin' />
                      ) : (
                        <BookMarked />
                      )}
                      细学
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => setDetail(row)}
                    >
                      <Eye />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => {
                        setEditing(row)
                        setFormOpen(true)
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => {
                        setDeleteTarget(row)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className='mt-4 flex items-center justify-between text-sm text-muted-foreground'>
        <span>
          第 {page} 页 · 共 {total} 条
        </span>
        <div className='flex gap-2'>
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
      </div>

      <ReadingPassageDetailSheet
        passage={detail}
        onClose={() => setDetail(null)}
        onRefresh={() => void load(page)}
        onEdit={(row) => {
          setEditing(row)
          setFormOpen(true)
        }}
      />
      <ReadingPassageFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => void load(page)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='删除文章'
        desc={`确定删除「${deleteTarget?.title}」？关联题目将一并删除。`}
        confirmText='删除'
        destructive
        isLoading={deleting}
        handleConfirm={() => void handleDeleteConfirm()}
      />
    </AdminPage>
  )
}
