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

type Item = {
  id: number
  userId?: number
  email?: string
  ipAddress?: string
  userAgent?: string
  createdAt?: string
  success?: boolean
}

export function LoginHistoryPage() {
  const [list, setList] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const pageSize = 20

  const load = async () => {
    setLoading(true)
    try {
      const res = await get<{ histories?: Item[]; history?: Item[]; list?: Item[]; total: number }>(
        '/auth/login-history',
        { params: { page, page_size: pageSize } }
      )
      setList(res.data.histories || res.data.history || res.data.list || [])
      setTotal(res.data.total || 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载登录历史失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  return (
    <AdminPage title='登录历史' description={`共 ${total} 条`}>
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
              <TableHead>IP</TableHead>
              <TableHead>结果</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.createdAt || '—'}</TableCell>
                <TableCell>{i.email || i.userId || '—'}</TableCell>
                <TableCell>{i.ipAddress || '—'}</TableCell>
                <TableCell>{i.success === false ? '失败' : '成功'}</TableCell>
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
