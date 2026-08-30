import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { del, get } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { formatTemplateTrigger, UNBOUND_SIG_EVENTS } from './sig-events'
import { TestSendDialog } from './test-send-dialog'
import { channelTypeLabel, type NotificationTemplate } from './types'

const ALL = 'all'

export function NotificationTemplatesPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<NotificationTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<NotificationTemplate | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const [testCode, setTestCode] = useState<string | undefined>()
  const [channelType, setChannelType] = useState(ALL)

  const load = async () => {
    setLoading(true)
    try {
      const res = await get<{ list: NotificationTemplate[] }>(
        '/admin/notification-templates',
        {
          params: {
            page: 1,
            pageSize: 100,
            channelType: channelType === ALL ? undefined : channelType,
          },
        }
      )
      setList(res.data.list || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载模板失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelType])

  return (
    <AdminPage
      title='通知模板'
      description='按 code 被 Sig 事件监听器引用；邮件与站内信分模板，事件驱动发送。'
      extra={
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => void load()}>
            <RefreshCw className='size-4' />
            刷新
          </Button>
          <Button
            variant='outline'
            onClick={() => {
              setTestCode(undefined)
              setTestOpen(true)
            }}
          >
            <Send className='size-4' />
            测试邮件
          </Button>
          <Button
            onClick={() => void navigate({ to: '/notification-templates/new' })}
          >
            <Plus className='size-4' />
            新建模板
          </Button>
        </div>
      }
    >
      <Card className='mb-2'>
        <CardHeader>
          <CardTitle className='text-base'>Sig 事件对照</CardTitle>
        </CardHeader>
        {UNBOUND_SIG_EVENTS.length > 0 ? (
          <CardContent>
            <p className='mb-2 text-sm font-medium text-muted-foreground'>
              尚未绑定通知模板的 Sig 事件
            </p>
            <ul className='space-y-2 text-sm'>
              {UNBOUND_SIG_EVENTS.map((item) => (
                <li key={item.event} className='flex flex-wrap gap-x-2 gap-y-1'>
                  <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>
                    {item.event}
                  </code>
                  <span>{item.label}</span>
                  <span className='text-muted-foreground'>{item.note}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        ) : (
          <CardContent className='text-sm text-muted-foreground'>
            当前已定义的认证类 Sig 事件均已绑定通知模板（邮件 + 站内信）。
          </CardContent>
        )}
      </Card>

      <div className='mb-4'>
        <Select value={channelType} onValueChange={setChannelType}>
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='类型' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部类型</SelectItem>
            <SelectItem value='email'>邮件</SelectItem>
            <SelectItem value='inbox'>站内信</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>code</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>触发</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className='text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className='text-muted-foreground'>
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className='text-muted-foreground'>
                  暂无模板
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className='font-mono text-xs'>
                    {row.code}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.channelType === 'inbox' ? 'secondary' : 'outline'
                      }
                    >
                      {channelTypeLabel(row.channelType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className='font-medium'>{row.name}</div>
                    {row.description ? (
                      <div className='text-xs text-muted-foreground'>
                        {row.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className='min-w-[180px] text-xs'>
                    <span className='text-muted-foreground'>
                      {formatTemplateTrigger(row.code)}
                    </span>
                  </TableCell>
                  <TableCell className='max-w-xs truncate text-muted-foreground'>
                    {row.channelType === 'inbox' ? row.inboxTitle : row.subject}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.enabled ? 'default' : 'secondary'}>
                      {row.enabled ? '启用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button variant='ghost' size='icon' asChild>
                      <Link
                        to='/notification-templates/$id'
                        params={{ id: String(row.id) }}
                      >
                        <Pencil className='size-4' />
                      </Link>
                    </Button>
                    {row.channelType === 'email' ? (
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          setTestCode(row.code)
                          setTestOpen(true)
                        }}
                      >
                        <Send className='size-4' />
                      </Button>
                    ) : null}
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2 className='size-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title='删除模板'
        desc={`确定删除「${deleting?.name ?? ''}」？`}
        destructive
        cancelBtnText='取消'
        confirmText='删除'
        handleConfirm={async () => {
          if (!deleting) return
          await del(`/admin/notification-templates/${deleting.id}`)
          toast.success('已删除')
          setDeleting(null)
          await load()
        }}
      />
      <TestSendDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        defaultCode={testCode}
      />
    </AdminPage>
  )
}

export const MailTemplatesPage = NotificationTemplatesPage
