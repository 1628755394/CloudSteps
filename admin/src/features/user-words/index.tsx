import { useEffect, useState } from 'react'
import { Eye, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { get, post } from '@/lib/api'
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
import { AdminPage } from '@/components/admin-page'

type UserWordFields = {
  word?: string
  phonetic?: string
  phoneticUs?: string
  phoneticUk?: string
  translationShort?: string
  translation?: string
  partOfSpeech?: string
  definition?: string
  exampleSentence?: string
  notes?: string
}

type AdminUserWord = {
  id: number
  userId: number
  userName?: string
  userEmail?: string
  wordId: number
  wordBookId: number
  wordBookName?: string
  status: string
  notes?: string
  overlay: UserWordFields
  canonical: UserWordFields
  createdAt?: string
  updatedAt?: string
}

const ALL = 'all'

function statusBadge(status: string) {
  if (status === 'adopted')
    return { label: '已写入词库', variant: 'outline' as const }
  if (status === 'dismissed')
    return { label: '已忽略', variant: 'secondary' as const }
  return { label: '待审核', variant: 'default' as const }
}

function pretty(raw?: string) {
  if (!raw) return '—'
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed.map(String).join('；')
    return String(parsed)
  } catch {
    return raw
  }
}

export function UserWordsPage() {
  const [list, setList] = useState<AdminUserWord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(ALL)
  const [userId, setUserId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<AdminUserWord | null>(null)
  const [saving, setSaving] = useState(false)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await get<{ list: AdminUserWord[]; total: number }>(
        '/admin/user-words',
        {
          params: {
            page: nextPage,
            pageSize,
            status: status === ALL ? undefined : status,
            userId: userId.trim() || undefined,
            keyword: keyword.trim() || undefined,
          },
        }
      )
      setList(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status])

  const openDetail = async (id: number) => {
    try {
      const res = await get<AdminUserWord>(`/admin/user-words/${id}`)
      setDetail(res.data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  const runAction = async (id: number, action: 'adopt' | 'dismiss') => {
    setSaving(true)
    try {
      const res = await post<AdminUserWord>(`/admin/user-words/${id}/${action}`)
      setDetail(res.data)
      toast.success(action === 'adopt' ? '已写入词库' : '已忽略')
      await load(page)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminPage
      title='用户单词'
      description='用户对词库单词的修正。展示时用这份覆盖原文；确认无误后再写入共享词库。'
      extra={
        <Button
          variant='outline'
          disabled={loading}
          onClick={() => void load(page)}
        >
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
          placeholder='单词 / 释义 / 备注'
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className='w-36'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部</SelectItem>
            <SelectItem value='pending'>待审核</SelectItem>
            <SelectItem value='adopted'>已写入词库</SelectItem>
            <SelectItem value='dismissed'>已忽略</SelectItem>
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
              <TableHead>修正</TableHead>
              <TableHead>词库原文</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className='text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground'>
                  <span className='inline-flex items-center gap-2'>
                    <Loader2 className='size-4 animate-spin' />
                    加载中…
                  </span>
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground'>
                  暂无记录
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => {
                const badge = statusBadge(row.status)
                const overlayWord =
                  row.overlay.word || row.canonical.word || `#${row.wordId}`
                const wordChanged =
                  Boolean(row.overlay.word) &&
                  row.overlay.word !== row.canonical.word
                const transShortChanged =
                  Boolean(row.overlay.translationShort) &&
                  pretty(row.overlay.translationShort) !==
                    pretty(row.canonical.translationShort)
                const transChanged =
                  Boolean(row.overlay.translation) &&
                  pretty(row.overlay.translation) !==
                    pretty(row.canonical.translation)
                const overlayTrans = pretty(
                  row.overlay.translationShort ||
                    row.overlay.translation ||
                    row.overlay.definition
                )
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
                      <div
                        className={`truncate font-medium ${
                          wordChanged
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : ''
                        }`}
                      >
                        {overlayWord}
                      </div>
                      <div
                        className={`truncate text-xs ${
                          transShortChanged || transChanged
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {overlayTrans}
                      </div>
                    </TableCell>
                    <TableCell className='max-w-xs'>
                      <div
                        className={`truncate ${
                          wordChanged ? 'text-rose-700 dark:text-rose-400' : ''
                        }`}
                      >
                        {row.canonical.word || '—'}
                      </div>
                      <div className='truncate text-xs text-muted-foreground'>
                        {row.wordBookName || `词库 #${row.wordBookId}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className='text-sm whitespace-nowrap text-muted-foreground'>
                      {formatDateTime(row.updatedAt || row.createdAt)}
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
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Button
            variant='outline'
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </Button>
        </div>
      </div>

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className='flex w-full flex-col sm:max-w-xl'>
          <SheetHeader>
            <SheetTitle>
              {detail?.overlay.word || detail?.canonical.word || '用户单词'}
            </SheetTitle>
            <SheetDescription>
              {detail
                ? `${detail.userName || `用户 #${detail.userId}`} · ${detail.wordBookName || `词库 #${detail.wordBookId}`}`
                : ''}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
              {detail.notes ? (
                <div className='rounded-md border bg-muted/40 p-3 text-sm'>
                  <div className='mb-1 text-xs text-muted-foreground'>
                    用户备注
                  </div>
                  {detail.notes}
                </div>
              ) : null}
              <CompareTable
                overlay={detail.overlay}
                canonical={detail.canonical}
              />
            </div>
          ) : null}
          <SheetFooter className='gap-2'>
            <Button variant='outline' onClick={() => setDetail(null)}>
              关闭
            </Button>
            {detail && detail.status !== 'dismissed' ? (
              <Button
                variant='secondary'
                disabled={saving}
                onClick={() => void runAction(detail.id, 'dismiss')}
              >
                忽略
              </Button>
            ) : null}
            {detail && detail.status !== 'adopted' ? (
              <Button
                disabled={saving}
                onClick={() => void runAction(detail.id, 'adopt')}
              >
                写入词库
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AdminPage>
  )
}

const COMPARE_ROWS: Array<{ key: keyof UserWordFields; label: string }> = [
  { key: 'word', label: '单词' },
  { key: 'phonetic', label: '音标' },
  { key: 'phoneticUs', label: '美音' },
  { key: 'phoneticUk', label: '英音' },
  { key: 'partOfSpeech', label: '词性' },
  { key: 'translationShort', label: '简译' },
  { key: 'translation', label: '完整释义' },
  { key: 'definition', label: '英文释义' },
  { key: 'exampleSentence', label: '例句' },
]

function CompareTable({
  overlay,
  canonical,
}: {
  overlay: UserWordFields
  canonical: UserWordFields
}) {
  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap gap-3 text-xs text-muted-foreground'>
        <span className='inline-flex items-center gap-1.5'>
          <span className='size-2.5 rounded-sm bg-rose-400' />
          词库原文
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <span className='size-2.5 rounded-sm bg-emerald-500' />
          用户修正
        </span>
      </div>
      <div className='overflow-hidden rounded-md border text-sm'>
        <div className='grid grid-cols-3 bg-muted/50 px-3 py-2 text-xs text-muted-foreground'>
          <div>字段</div>
          <div>词库原文</div>
          <div>用户修正</div>
        </div>
        {COMPARE_ROWS.map((row) => {
          const left = pretty(canonical[row.key])
          const hasOverlay = Boolean(overlay[row.key])
          const right = hasOverlay ? pretty(overlay[row.key]) : '（未改）'
          const changed = hasOverlay && pretty(overlay[row.key]) !== left
          return (
            <div
              key={row.key}
              className={`grid grid-cols-3 gap-2 border-t px-3 py-2 ${
                changed ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''
              }`}
            >
              <div
                className={
                  changed
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }
              >
                {row.label}
              </div>
              <div
                className={`rounded-md px-1.5 py-0.5 break-all ${
                  changed
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                    : ''
                }`}
              >
                {left}
              </div>
              <div
                className={`rounded-md px-1.5 py-0.5 break-all ${
                  changed
                    ? 'bg-emerald-100 font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                    : 'text-muted-foreground'
                }`}
              >
                {right}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
