import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Eye, Loader2 } from 'lucide-react'
import { get } from '@/lib/api'
import { AdminPage } from '@/components/admin-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  VocabQuestionDetailSheet,
  type VocabQuestion,
} from './question-detail-sheet'

export function VocabQuestionsPage() {
  const [list, setList] = useState<VocabQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<VocabQuestion | null>(null)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
      })
      if (keyword) params.append('word', keyword)
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
  }, [page])

  return (
    <AdminPage title='词汇测评题库' description={`共 ${total} 题`}>
      <form
        className='mb-4 flex gap-2'
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
              <TableHead>音频</TableHead>
              <TableHead className='w-24'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((q) => (
              <TableRow key={q.id}>
                <TableCell>{q.id}</TableCell>
                <TableCell className='font-medium'>{q.word}</TableCell>
                <TableCell className='max-w-xs truncate'>
                  {q.correctAnswer || '—'}
                </TableCell>
                <TableCell>{q.level}</TableCell>
                <TableCell>{q.audioUrl ? '有' : '无'}</TableCell>
                <TableCell>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => setDetail(q)}
                  >
                    <Eye />
                    详情
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
      />
    </AdminPage>
  )
}
