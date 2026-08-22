import { useEffect, useState, type ReactNode } from 'react'
import { Eye, RefreshCw, Send } from 'lucide-react'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TestSendDialog } from '@/features/mail-templates/test-send-dialog'

export type MailLog = {
  id: number
  user_id: number
  provider: string
  channel_name: string
  to_email: string
  subject: string
  html_body?: string
  status: string
  error_msg?: string
  message_id?: string
  sent_at?: string
  created_at?: string
}

const ALL = 'all'

function statusVariant(status: string) {
  switch (status) {
    case 'delivered':
    case 'sent':
    case 'opened':
    case 'clicked':
      return 'default' as const
    case 'failed':
    case 'invalid':
    case 'spam':
    case 'soft_bounce':
      return 'destructive' as const
    default:
      return 'secondary' as const
  }
}

export function MailLogsPage() {
  const [list, setList] = useState<MailLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(ALL)
  const [provider, setProvider] = useState(ALL)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<MailLog | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await get<{ list: MailLog[]; total: number }>(
        '/admin/mail-logs',
        {
          params: {
            page: nextPage,
            pageSize,
            status: status === ALL ? undefined : status,
            provider: provider === ALL ? undefined : provider,
            search: search || undefined,
          },
        }
      )
      setList(res.data.list || [])
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
  }, [page, status, provider])

  const openDetail = async (row: MailLog) => {
    setDetail(row)
    try {
      const res = await get<MailLog>(`/admin/mail-logs/${row.id}`)
      if (res.data) setDetail(res.data)
    } catch {
      // list row already has fields
    }
  }

  return (
    <AdminPage
      title='邮件日志'
      description='查询邮件投递与回执；预检失败会以 provider=none 入库。'
      extra={
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => setTestOpen(true)}>
            <Send className='size-4' />
            测试发送
          </Button>
          <Button
            variant='outline'
            onClick={() => {
              setPage(1)
              void load(1)
            }}
          >
            <RefreshCw className='size-4' />
            刷新
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
          className='max-w-xs'
          placeholder='搜索收件人或标题'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-36'>
            <SelectValue placeholder='状态' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部状态</SelectItem>
            <SelectItem value='sent'>sent</SelectItem>
            <SelectItem value='delivered'>delivered</SelectItem>
            <SelectItem value='failed'>failed</SelectItem>
            <SelectItem value='soft_bounce'>soft_bounce</SelectItem>
            <SelectItem value='invalid'>invalid</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={provider}
          onValueChange={(value) => {
            setProvider(value)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='供应商' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部供应商</SelectItem>
            <SelectItem value='smtp'>smtp</SelectItem>
            <SelectItem value='sendcloud'>sendcloud</SelectItem>
            <SelectItem value='multi'>multi</SelectItem>
            <SelectItem value='none'>none</SelectItem>
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
              <TableHead>时间</TableHead>
              <TableHead>收件人</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>渠道</TableHead>
              <TableHead>状态</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground'>
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground'>
                  暂无日志
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className='text-muted-foreground'>
                    {formatDateTime(row.sent_at || row.created_at)}
                  </TableCell>
                  <TableCell>{row.to_email}</TableCell>
                  <TableCell className='max-w-xs truncate'>{row.subject}</TableCell>
                  <TableCell>
                    <div className='flex items-center gap-1.5'>
                      <Badge variant='outline'>{row.provider || '—'}</Badge>
                      <span className='text-xs text-muted-foreground'>
                        {row.channel_name || ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => void openDetail(row)}
                    >
                      <Eye className='size-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {total > pageSize ? (
        <div className='mt-4 flex justify-end gap-2'>
          <Button
            variant='outline'
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <Button
            variant='outline'
            disabled={page * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      ) : null}

      <Sheet open={Boolean(detail)} onOpenChange={(next) => !next && setDetail(null)}>
        <SheetContent className='overflow-y-auto sm:max-w-xl'>
          <SheetHeader>
            <SheetTitle>邮件日志详情</SheetTitle>
          </SheetHeader>
          {detail ? (
            <div className='grid gap-3 px-4 pb-4 text-sm'>
              <DetailRow label='ID' value={String(detail.id)} />
              <DetailRow
                label='状态'
                value={
                  <Badge variant={statusVariant(detail.status)}>
                    {detail.status}
                  </Badge>
                }
              />
              <DetailRow label='provider' value={detail.provider} />
              <DetailRow label='channel' value={detail.channel_name || '—'} />
              <DetailRow label='收件人' value={detail.to_email} />
              <DetailRow label='主题' value={detail.subject} />
              <DetailRow label='messageId' value={detail.message_id || '—'} />
              {detail.error_msg ? (
                <div className='rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive'>
                  <div className='mb-1 text-xs font-semibold'>错误信息</div>
                  <div className='break-all whitespace-pre-wrap'>
                    {detail.error_msg}
                  </div>
                </div>
              ) : null}
              {detail.html_body ? (
                <div>
                  <div className='mb-1 text-muted-foreground'>HTML 渲染</div>
                  <iframe
                    title='mail-html'
                    sandbox=''
                    className='h-80 w-full rounded-md border bg-white'
                    srcDoc={detail.html_body}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <TestSendDialog open={testOpen} onOpenChange={setTestOpen} />
    </AdminPage>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className='flex items-start gap-3'>
      <div className='w-24 shrink-0 text-muted-foreground'>{label}</div>
      <div className='flex-1 break-all'>{value}</div>
    </div>
  )
}
