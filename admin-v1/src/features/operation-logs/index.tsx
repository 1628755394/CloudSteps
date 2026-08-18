import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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

type LogItem = {
  id: number
  user_id?: number
  username?: string
  action?: string
  target?: string
  request_method?: string
  created_at?: string
}

export function OperationLogsPage() {
  const [list, setList] = useState<LogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const pageSize = 20

  const load = async () => {
    setLoading(true)
    try {
      const res = await get<{ logs: LogItem[]; total: number }>(
        '/security/operation-logs',
        { params: { page, page_size: pageSize } }
      )
      setList(res.data.logs || [])
      setTotal(res.data.total || 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  return (
    <AdminPage title='操作日志' description={`共 ${total} 条`}>
      {loading ? (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          加载中…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>动作</TableHead>
              <TableHead>目标</TableHead>
              <TableHead>方法</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.created_at || '—'}</TableCell>
                <TableCell>{l.username || l.user_id || '—'}</TableCell>
                <TableCell>{l.action || '—'}</TableCell>
                <TableCell>{l.target || '—'}</TableCell>
                <TableCell>{l.request_method || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className='mt-4 flex justify-end gap-2'>
        <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
    </AdminPage>
  )
}
