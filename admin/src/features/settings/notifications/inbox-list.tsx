import { useEffect, useState } from 'react'
import {
  CheckCheck,
  ExternalLink,
  Eye,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { del, get, post, put } from '@/lib/api'
import { formatDateTime } from '@/lib/datetime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { MarkdownView } from '@/components/markdown-view'

export type MyInboxMessage = {
  id: number
  title: string
  content: string
  actionUrl?: string
  actionLabel?: string
  read: boolean
  createdAt?: string
  updatedAt?: string
}

const ALL = 'all'

export function SettingsInboxList() {
  const [list, setList] = useState<MyInboxMessage[]>([])
  const [total, setTotal] = useState(0)
  const [totalUnread, setTotalUnread] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState(ALL)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<MyInboxMessage | null>(null)
  const [deleting, setDeleting] = useState<MyInboxMessage | null>(null)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await get<{
        list: MyInboxMessage[]
        total: number
        totalUnread: number
      }>('/admin/me/inbox-messages', {
        params: {
          page: nextPage,
          pageSize,
          filter: filter === ALL ? undefined : filter,
        },
      })
      setList(res.data.list || [])
      setTotal(res.data.total || 0)
      setTotalUnread(res.data.totalUnread || 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载通知失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter])

  const markRead = async (row: MyInboxMessage) => {
    if (row.read) return
    try {
      await put(`/admin/me/inbox-messages/${row.id}/read`)
      setList((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, read: true } : item
        )
      )
      setTotalUnread((n) => Math.max(0, n - 1))
      setDetail((d) => (d?.id === row.id ? { ...d, read: true } : d))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '标记已读失败')
    }
  }

  const markAllRead = async () => {
    try {
      await post('/admin/me/inbox-messages/read-all')
      setList((prev) => prev.map((item) => ({ ...item, read: true })))
      setTotalUnread(0)
      toast.success('已全部标记为已读')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  const openDetail = async (row: MyInboxMessage) => {
    setDetail(row)
    await markRead(row)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await del(`/admin/me/inbox-messages/${deleting.id}`)
      toast.success('已删除')
      setDeleting(null)
      if (detail?.id === deleting.id) setDetail(null)
      void load(page)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-[120px]'>
            <SelectValue placeholder='筛选' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部</SelectItem>
            <SelectItem value='unread'>未读</SelectItem>
            <SelectItem value='read'>已读</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant='outline'
          size='sm'
          disabled={loading}
          onClick={() => void load(page)}
        >
          {loading ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <RefreshCw className='size-4' />
          )}
          刷新
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={totalUnread === 0}
          onClick={() => void markAllRead()}
        >
          <CheckCheck className='size-4' />
          全部已读
        </Button>
        <span className='ms-auto text-sm text-muted-foreground'>
          {totalUnread > 0 ? `${totalUnread} 条未读` : '暂无未读'}
        </span>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[100px]'>状态</TableHead>
              <TableHead>标题</TableHead>
              <TableHead className='hidden md:table-cell'>时间</TableHead>
              <TableHead className='w-[100px] text-end'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='h-24 text-center text-muted-foreground'
                >
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='h-24 text-center text-muted-foreground'
                >
                  暂无通知
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => (
                <TableRow
                  key={row.id}
                  className={row.read ? undefined : 'bg-muted/30'}
                >
                  <TableCell>
                    <Badge variant={row.read ? 'secondary' : 'default'}>
                      {row.read ? '已读' : '未读'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      type='button'
                      className='text-start font-medium hover:text-primary'
                      onClick={() => void openDetail(row)}
                    >
                      {row.title}
                    </button>
                    <p className='mt-0.5 line-clamp-1 text-sm text-muted-foreground'>
                      {row.content}
                    </p>
                  </TableCell>
                  <TableCell className='hidden text-sm text-muted-foreground md:table-cell'>
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                  <TableCell className='text-end'>
                    <div className='flex justify-end gap-1'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => void openDetail(row)}
                      >
                        <Eye className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setDeleting(row)}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className='flex items-center justify-end gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <span className='text-sm text-muted-foreground'>
            {page} / {pageCount}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl'>
          <SheetHeader className='shrink-0 space-y-2 border-b px-6 py-5 text-start'>
            <div className='flex items-start gap-2 pe-8'>
              <SheetTitle className='text-lg leading-snug'>
                {detail?.title}
              </SheetTitle>
              {detail ? (
                <Badge
                  variant={detail.read ? 'secondary' : 'default'}
                  className='shrink-0'
                >
                  {detail.read ? '已读' : '未读'}
                </Badge>
              ) : null}
            </div>
            <SheetDescription>
              {formatDateTime(detail?.createdAt)}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className='min-h-0 flex-1'>
            <div className='px-6 py-5'>
              <MarkdownView content={detail?.content ?? ''} />
            </div>
          </ScrollArea>

          {detail?.actionUrl ? (
            <SheetFooter className='shrink-0 border-t px-6 py-4'>
              <Button asChild variant='outline' className='w-full sm:w-auto'>
                <a href={detail.actionUrl} target='_blank' rel='noreferrer'>
                  <ExternalLink className='size-4' />
                  {detail.actionLabel || '查看详情'}
                </a>
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title='删除通知'
        desc={`确定删除「${deleting?.title ?? ''}」？此操作不可撤销。`}
        confirmText='删除'
        destructive
        handleConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
