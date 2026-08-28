import { useEffect, useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { get } from '@/lib/api'
import { formatDateTime } from '@/lib/datetime'
import { Badge } from '@/components/ui/badge'
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
import { LoginHistoryDetailSheet } from './detail-sheet'
import {
  loginHistoryQuery,
  loginPlace,
  loginTypeLabel,
  loginUserLabel,
  shortUserAgent,
  type LoginHistoryItem,
} from './display'

const ALL = 'all'

export function LoginHistoryPage() {
  const [list, setList] = useState<LoginHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [result, setResult] = useState(ALL)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<LoginHistoryItem | null>(null)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await get<{
        histories?: LoginHistoryItem[]
        total: number
      }>('/auth/login-history', {
        params: {
          page: nextPage,
          page_size: pageSize,
          search: search || undefined,
          ...loginHistoryQuery(result),
        },
      })
      setList(res.data.histories || [])
      setTotal(res.data.total || 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载登录历史失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, result])

  const openDetail = async (row: LoginHistoryItem) => {
    setDetail(row)
    try {
      const res = await get<{ history: LoginHistoryItem }>(
        `/auth/login-history/${row.id}`
      )
      if (res.data.history) setDetail({ ...row, ...res.data.history })
    } catch {
      // list row already has fields
    }
  }

  return (
    <AdminPage title='登录历史' description={`共 ${total} 条`}>
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
          placeholder='搜索邮箱 / IP / 地点'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={result}
          onValueChange={(value) => {
            setResult(value)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-32'>
            <SelectValue placeholder='结果' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部结果</SelectItem>
            <SelectItem value='success'>成功</SelectItem>
            <SelectItem value='failed'>失败</SelectItem>
            <SelectItem value='suspicious'>可疑</SelectItem>
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
              <TableHead>时间</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>IP / 地点</TableHead>
              <TableHead>方式 / 设备</TableHead>
              <TableHead>结果</TableHead>
              <TableHead className='w-24'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground'>
                  暂无记录
                </TableCell>
              </TableRow>
            ) : (
              list.map((i) => {
                const ok = i.success !== false
                return (
                  <TableRow key={i.id}>
                    <TableCell className='text-sm whitespace-nowrap'>
                      {formatDateTime(i.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p className='font-medium'>{loginUserLabel(i)}</p>
                      <p className='text-xs text-muted-foreground'>
                        ID {i.userId ?? '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className='font-mono text-xs'>{i.ipAddress || '—'}</p>
                      <p className='max-w-[200px] truncate text-xs text-muted-foreground'>
                        {loginPlace(i)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className='text-sm'>{loginTypeLabel(i.loginType)}</p>
                      <p className='max-w-[180px] truncate text-xs text-muted-foreground'>
                        {shortUserAgent(i.userAgent)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        <Badge variant={ok ? 'secondary' : 'destructive'}>
                          {ok ? '成功' : '失败'}
                        </Badge>
                        {i.isSuspicious ? (
                          <Badge variant='destructive'>可疑</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => void openDetail(i)}
                      >
                        <Eye />
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}
      <div className='mt-4 flex items-center justify-end gap-2 text-sm'>
        <Button
          variant='outline'
          size='sm'
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </Button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <Button
          variant='outline'
          size='sm'
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </Button>
      </div>
      <LoginHistoryDetailSheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
        item={detail}
      />
    </AdminPage>
  )
}
