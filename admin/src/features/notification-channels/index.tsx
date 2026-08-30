import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { del, get } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { TestSendDialog } from '@/features/mail-templates/test-send-dialog'
import { type NotificationChannel } from './types'

export function NotificationChannelsPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<NotificationChannel | null>(null)
  const [testOpen, setTestOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await get<{ list: NotificationChannel[] }>(
        '/admin/notification-channels',
        { params: { type: 'email', page: 1, pageSize: 100 } }
      )
      setList(res.data.list || [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载渠道失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <AdminPage
      title='通知渠道'
      description='管理邮件发送供应商，启用后按排序轮询与故障切换发送。'
      extra={
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => void load()}>
            <RefreshCw className='size-4' />
            刷新
          </Button>
          <Button variant='outline' onClick={() => setTestOpen(true)}>
            <Send className='size-4' />
            测试发送
          </Button>
          <Button
            onClick={() => void navigate({ to: '/notification-channels/new' })}
          >
            <Plus className='size-4' />
            新建邮件渠道
          </Button>
        </div>
      }
    >
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>备注</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className='text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className='text-muted-foreground'>
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-muted-foreground'>
                  暂无渠道
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className='font-medium'>{row.name}</TableCell>
                  <TableCell className='text-muted-foreground'>
                    {row.remark || '—'}
                  </TableCell>
                  <TableCell>{row.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant={row.enabled ? 'default' : 'secondary'}>
                      {row.enabled ? '启用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button variant='ghost' size='icon' asChild>
                      <Link
                        to='/notification-channels/$id'
                        params={{ id: String(row.id) }}
                      >
                        <Pencil className='size-4' />
                      </Link>
                    </Button>
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
        title='删除渠道'
        desc={`确定删除「${deleting?.name ?? ''}」？`}
        destructive
        handleConfirm={async () => {
          if (!deleting) return
          await del(`/admin/notification-channels/${deleting.id}`)
          toast.success('已删除')
          setDeleting(null)
          await load()
        }}
      />
      <TestSendDialog open={testOpen} onOpenChange={setTestOpen} />
    </AdminPage>
  )
}
