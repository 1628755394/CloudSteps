import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { get, post } from '@/lib/api'
import { formatDateTime } from '@/lib/datetime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import { AdminPage } from '@/components/admin-page'

type FeedbackReply = {
  id: number
  role: string
  content: string
  createdAt?: string
}

type FeedbackTicket = {
  id: number
  userId: number
  userName?: string
  userEmail?: string
  content: string
  contact?: string
  status: string
  lastRepliedAt?: string
  lastReplierRole?: string
  lastReplyPreview?: string
  replyCount: number
  createdAt?: string
  replies?: FeedbackReply[]
}

const ALL = 'all'
const POLL_MS = 4000

function ticketBadge(row: FeedbackTicket) {
  if (row.status === 'closed') {
    return { label: '已关闭', variant: 'secondary' as const }
  }
  if (row.lastReplierRole === 'admin') {
    return { label: '已回复', variant: 'outline' as const }
  }
  return { label: '待回应', variant: 'default' as const }
}

export function UserFeedbackPage() {
  const [list, setList] = useState<FeedbackTicket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(ALL)
  const [userId, setUserId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<FeedbackTicket | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const pageSize = 20
  const pageRef = useRef(page)
  const statusRef = useRef(status)
  const userIdRef = useRef(userId)
  const keywordRef = useRef(keyword)
  const detailIdRef = useRef<number | null>(null)
  pageRef.current = page
  statusRef.current = status
  userIdRef.current = userId
  keywordRef.current = keyword
  detailIdRef.current = detail?.id ?? null

  const load = async (nextPage = pageRef.current, silent = false) => {
    if (!silent) setLoading(true)
    try {
      const currentStatus = statusRef.current
      const res = await get<{ list: FeedbackTicket[]; total: number }>(
        '/admin/feedbacks',
        {
          params: {
            page: nextPage,
            pageSize,
            status: currentStatus === ALL ? undefined : currentStatus,
            userId: userIdRef.current.trim() || undefined,
            keyword: keywordRef.current.trim() || undefined,
          },
        }
      )
      setList(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch (e: unknown) {
      if (!silent) {
        toast.error(e instanceof Error ? e.message : '加载工单失败')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    let inFlight = false

    const refresh = async (silent: boolean) => {
      if (inFlight || cancelled) return
      inFlight = true
      try {
        await load(pageRef.current, silent)
        const ticketId = detailIdRef.current
        if (ticketId) {
          const res = await get<FeedbackTicket>(`/admin/feedbacks/${ticketId}`)
          if (!cancelled && detailIdRef.current === ticketId) setDetail(res.data)
        }
      } catch {
        /* keep previous snapshot on background poll */
      } finally {
        inFlight = false
      }
    }

    void refresh(false)
    const timer = window.setInterval(() => {
      if (document.hidden) return
      void refresh(true)
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status])

  const openDetail = async (id: number) => {
    setDetailLoading(true)
    setReply('')
    try {
      const res = await get<FeedbackTicket>(`/admin/feedbacks/${id}`)
      setDetail(res.data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载对话失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const sendReply = async () => {
    if (!detail || !reply.trim()) {
      toast.error('请填写回复内容')
      return
    }
    setSaving(true)
    try {
      const res = await post<FeedbackTicket>(
        `/admin/feedbacks/${detail.id}/replies`,
        { content: reply.trim() }
      )
      setDetail(res.data)
      setReply('')
      toast.success('已回复，用户会收到站内信提醒')
      await load(page)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '回复失败')
    } finally {
      setSaving(false)
    }
  }

  const closeTicket = async () => {
    if (!detail) return
    setSaving(true)
    try {
      const res = await post<FeedbackTicket>(`/admin/feedbacks/${detail.id}/close`)
      setDetail(res.data)
      toast.success('工单已关闭')
      await load(page)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '关闭失败')
    } finally {
      setSaving(false)
    }
  }

  const thread = useMemo(() => {
    if (!detail) return []
    return [
      {
        id: 0,
        role: 'user',
        content: detail.content,
        createdAt: detail.createdAt,
      },
      ...(detail.replies ?? []),
    ]
  }, [detail])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminPage
      title='用户反馈'
      description='用户工单对话。回复写在工单里，同时给用户发一条站内信提醒。'
      extra={
        <Button variant='outline' disabled={loading} onClick={() => void load(page)}>
          <RefreshCw className='size-4' />
          刷新
        </Button>
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
          className='w-36'
          placeholder='用户 ID'
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <Input
          className='w-56'
          placeholder='内容关键词'
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className='w-32'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部</SelectItem>
            <SelectItem value='open'>未关闭</SelectItem>
            <SelectItem value='closed'>已关闭</SelectItem>
          </SelectContent>
        </Select>
        <Button type='submit' variant='secondary'>
          筛选
        </Button>
      </form>

      <div className='overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>最新内容</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className='text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className='text-muted-foreground'>
                  <span className='inline-flex items-center gap-2'>
                    <Loader2 className='size-4 animate-spin' />
                    加载中…
                  </span>
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-muted-foreground'>
                  暂无工单
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => {
                const badge = ticketBadge(row)
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className='font-medium'>
                        {row.userName || `用户 #${row.userId}`}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        ID {row.userId}
                        {row.userEmail ? ` · ${row.userEmail}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className='max-w-xs'>
                      <div className='truncate font-medium'>
                        {row.lastReplyPreview || row.content}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        #{row.id}
                        {row.replyCount > 0 ? ` · ${row.replyCount} 条回复` : ''}
                        {row.contact ? ` · ${row.contact}` : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className='whitespace-nowrap text-sm text-muted-foreground'>
                      {formatDateTime(row.lastRepliedAt || row.createdAt)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => void openDetail(row.id)}
                      >
                        <Eye className='size-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className='mt-4 flex items-center justify-between text-sm text-muted-foreground'>
        <span>共 {total} 条</span>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className='self-center tabular-nums'>
            {page} / {totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>

      <Sheet
        open={Boolean(detail) || detailLoading}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null)
            setReply('')
          }
        }}
      >
        <SheetContent className='overflow-y-auto sm:max-w-lg'>
          <SheetHeader>
            <SheetTitle>
              {detail ? `工单 #${detail.id}` : '工单'}
            </SheetTitle>
            <SheetDescription>
              {detail
                ? `${detail.userName || `用户 #${detail.userId}`} · ${formatDateTime(detail.createdAt)}`
                : '加载中'}
            </SheetDescription>
          </SheetHeader>
          {detailLoading && !detail ? (
            <div className='mt-6 flex items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              加载对话…
            </div>
          ) : detail ? (
            <>
              <div className='mt-4 space-y-3 px-1'>
                {detail.contact ? (
                  <p className='text-xs text-muted-foreground'>
                    联系方式：{detail.contact}
                  </p>
                ) : null}
                {thread.map((item) => {
                  const adminMsg = item.role === 'admin'
                  return (
                    <div
                      key={`${item.role}-${item.id}`}
                      className={`rounded-lg border p-3 text-sm ${
                        adminMsg ? 'bg-muted/40' : 'bg-background'
                      }`}
                    >
                      <div className='mb-1 text-xs text-muted-foreground'>
                        {adminMsg ? '管理员' : detail.userName || '用户'} ·{' '}
                        {formatDateTime(item.createdAt)}
                      </div>
                      <p className='whitespace-pre-wrap leading-relaxed'>
                        {item.content}
                      </p>
                    </div>
                  )
                })}
              </div>
              {detail.status === 'closed' ? (
                <p className='mt-4 px-1 text-sm text-muted-foreground'>
                  工单已关闭
                </p>
              ) : (
                <div className='mt-4 space-y-3 px-1'>
                  <div className='grid gap-1.5'>
                    <Label htmlFor='feedback-reply'>回复（写入工单）</Label>
                    <Textarea
                      id='feedback-reply'
                      rows={5}
                      value={reply}
                      placeholder='直接回复这条工单，用户会在对话里看到，并收到站内信提醒'
                      onChange={(e) => setReply(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <SheetFooter className='mt-6'>
                {detail.status === 'closed' ? null : (
                  <>
                    <Button
                      variant='outline'
                      disabled={saving}
                      onClick={() => void closeTicket()}
                    >
                      关闭工单
                    </Button>
                    <Button
                      disabled={saving || !reply.trim()}
                      onClick={() => void sendReply()}
                    >
                      {saving ? '发送中…' : '发送回复'}
                    </Button>
                  </>
                )}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminPage>
  )
}
