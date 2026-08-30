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
import { OperationLogDetailSheet } from './detail-sheet'
import {
  clientSummary,
  httpMethod,
  methodVariant,
  operationTitle,
  operatorLabel,
  shortPath,
  type OperationLog,
} from './display'

const ALL = 'all'

export function OperationLogsPage() {
  const [list, setList] = useState<OperationLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState('')
  const [method, setMethod] = useState(ALL)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<OperationLog | null>(null)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await get<{ logs: OperationLog[]; total: number }>(
        '/security/operation-logs',
        {
          params: {
            page: nextPage,
            page_size: pageSize,
            target: target || undefined,
            action: method === ALL ? undefined : method,
          },
        }
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
    void load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, method])

  const openDetail = async (row: OperationLog) => {
    setDetail(row)
    try {
      const res = await get<{ log: OperationLog }>(
        `/security/operation-logs/${row.id}`
      )
      if (res.data.log) setDetail({ ...row, ...res.data.log })
    } catch {
      // list row already has fields
    }
  }

  return (
    <AdminPage title='操作日志' description={`共 ${total} 条`}>
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
          placeholder='搜索请求路径'
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <Select
          value={method}
          onValueChange={(value) => {
            setMethod(value)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-32'>
            <SelectValue placeholder='方法' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部方法</SelectItem>
            <SelectItem value='GET'>GET</SelectItem>
            <SelectItem value='POST'>POST</SelectItem>
            <SelectItem value='PUT'>PUT</SelectItem>
            <SelectItem value='PATCH'>PATCH</SelectItem>
            <SelectItem value='DELETE'>DELETE</SelectItem>
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
              <TableHead>操作人</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>路径</TableHead>
              <TableHead>客户端</TableHead>
              <TableHead className='w-24'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground'>
                  暂无日志
                </TableCell>
              </TableRow>
            ) : (
              list.map((l) => {
                const verb = httpMethod(l)
                return (
                  <TableRow key={l.id}>
                    <TableCell className='text-sm whitespace-nowrap'>
                      {formatDateTime(l.created_at)}
                    </TableCell>
                    <TableCell>
                      <p className='font-medium'>{operatorLabel(l)}</p>
                      <p className='text-xs text-muted-foreground'>
                        ID {l.user_id ?? '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap items-center gap-1.5'>
                        {verb ? (
                          <Badge variant={methodVariant(verb)}>{verb}</Badge>
                        ) : null}
                        <span className='text-sm'>{operationTitle(l)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className='max-w-[220px] truncate font-mono text-xs'>
                        {shortPath(l.target)}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {l.ip_address || '—'}
                        {l.location ? ` · ${l.location}` : ''}
                      </p>
                    </TableCell>
                    <TableCell className='max-w-[180px] truncate text-sm text-muted-foreground'>
                      {clientSummary(l)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => void openDetail(l)}
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
      <OperationLogDetailSheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
        log={detail}
      />
    </AdminPage>
  )
}
