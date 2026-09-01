import { useEffect, useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { get } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminPage } from '@/components/admin-page'
import {
  ReadingRecordDetailSheet,
  type ReadingRecordRow,
} from './record-detail-sheet'

type SourceTab = 'system' | 'custom'

export function ReadingRecordsPage() {
  const [tab, setTab] = useState<SourceTab>('system')
  const [list, setList] = useState<ReadingRecordRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<ReadingRecordRow | null>(null)
  const pageSize = 20

  const basePath =
    tab === 'system' ? '/reading/admin/records' : '/reading/admin/custom/records'

  const load = async () => {
    setLoading(true)
    try {
      const res = await get<{ list: ReadingRecordRow[]; total: number }>(
        `${basePath}?page=${page}&pageSize=${pageSize}`
      )
      setList(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tab])

  const openDetail = async (row: ReadingRecordRow) => {
    setDetail({ ...row, source: tab })
    try {
      const res = await get<ReadingRecordRow>(`${basePath}/${row.id}`)
      setDetail({ ...row, ...res.data, source: tab })
    } catch {
      // keep summary row
    }
  }

  return (
    <AdminPage title='阅读练习记录' description={`共 ${total} 条`}>
      <div className='mb-4 flex gap-2'>
        {(['system', 'custom'] as SourceTab[]).map((key) => (
          <Button
            key={key}
            size='sm'
            variant={tab === key ? 'default' : 'outline'}
            onClick={() => {
              setTab(key)
              setPage(1)
            }}
          >
            {key === 'system' ? '系统文章' : '用户自定义'}
          </Button>
        ))}
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
              <TableHead>用户</TableHead>
              <TableHead>文章</TableHead>
              <TableHead>等级</TableHead>
              <TableHead>得分</TableHead>
              <TableHead>正确率</TableHead>
              <TableHead>用时</TableHead>
              <TableHead>完成时间</TableHead>
              <TableHead className='w-24'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.username || r.email || r.userId}</TableCell>
                <TableCell className='max-w-[200px] truncate'>
                  {r.title || `#${r.passageId}`}
                </TableCell>
                <TableCell>{r.level || '—'}</TableCell>
                <TableCell>{r.score ?? '—'}</TableCell>
                <TableCell>
                  {r.questionCount
                    ? `${r.correctCount ?? 0}/${r.questionCount}`
                    : '—'}
                </TableCell>
                <TableCell>
                  {r.durationSec != null && r.durationSec > 0
                    ? `${Math.round(r.durationSec / 60)} 分`
                    : '—'}
                </TableCell>
                <TableCell>{r.completedAt || '—'}</TableCell>
                <TableCell>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => void openDetail(r)}
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

      <div className='mt-4 flex justify-end gap-2'>
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

      <ReadingRecordDetailSheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
        record={detail}
      />
    </AdminPage>
  )
}
