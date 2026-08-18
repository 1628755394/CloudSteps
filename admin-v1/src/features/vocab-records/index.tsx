import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Eye, Loader2 } from 'lucide-react'
import { get } from '@/lib/api'
import { AdminPage } from '@/components/admin-page'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  VocabRecordDetailSheet,
  type VocabRecord,
} from './record-detail-sheet'

export function VocabRecordsPage() {
  const [list, setList] = useState<VocabRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<VocabRecord | null>(null)
  const pageSize = 20

  const load = async () => {
    setLoading(true)
    try {
      const res = await get<{
        list?: VocabRecord[]
        records?: VocabRecord[]
        total: number
      }>(`/vocab/records?page=${page}&pageSize=${pageSize}`)
      setList(res.data.list || res.data.records || [])
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
  }, [page])

  const openDetail = async (row: VocabRecord) => {
    setDetail(row)
    try {
      const res = await get<VocabRecord>(`/vocab/records/${row.id}`)
      setDetail({ ...row, ...res.data })
    } catch {
      // list row already has summary fields; keep it if detail fetch fails
    }
  }

  return (
    <AdminPage title='词汇测试记录' description={`共 ${total} 条`}>
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
              <TableHead>级别</TableHead>
              <TableHead>词汇量</TableHead>
              <TableHead>正确率</TableHead>
              <TableHead>完成时间</TableHead>
              <TableHead className='w-24'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.userDisplayName || r.userEmail || r.id}</TableCell>
                <TableCell>{r.estimatedLevel || '—'}</TableCell>
                <TableCell>{r.estimatedVocab ?? '—'}</TableCell>
                <TableCell>
                  {r.questionCount
                    ? `${r.correctCount ?? 0}/${r.questionCount}`
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
      <VocabRecordDetailSheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
        record={detail}
      />
    </AdminPage>
  )
}
