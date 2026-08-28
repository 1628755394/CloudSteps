import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { del } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { UserAvatar } from './user-avatar'
import {
  formatDateTime,
  formatLocation,
  genderLabel,
  roleLabel,
  sourceLabel,
  userDisplayName,
  type CloudUser,
} from './user-display'

export type { CloudUser }

type UserDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: CloudUser | null
  onDeleted?: () => void
}

function DetailField({
  label,
  value,
}: {
  label: string
  value?: string | number | null
}) {
  const text =
    value === undefined || value === null || value === '' ? '—' : String(value)
  return (
    <div className='grid gap-1.5'>
      <Label>{label}</Label>
      <p className='text-sm break-all'>{text}</p>
    </div>
  )
}

export function UserDetailSheet({
  open,
  onOpenChange,
  user,
  onDeleted,
}: UserDetailSheetProps) {
  const name = user ? userDisplayName(user) : '用户详情'
  const enabled = user?.enabled !== false
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!user) return
    setDeleting(true)
    try {
      await del(`/users/${user.id}`)
      toast.success('已注销该账号')
      setConfirmOpen(false)
      onOpenChange(false)
      onDeleted?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '注销失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader className='text-start'>
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>
            查看账号资料、登录记录和学习概况。
          </SheetDescription>
        </SheetHeader>
        {user ? (
          <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-4'>
            <div className='flex items-center gap-3'>
              <UserAvatar user={user} className='size-14' />
              <div className='min-w-0'>
                <p className='truncate font-medium'>{name}</p>
                <p className='truncate text-sm text-muted-foreground'>
                  {user.email || user.account || user.username || '—'}
                </p>
                <div className='mt-2 flex flex-wrap gap-1.5'>
                  <Badge variant='outline'>{roleLabel(user.role)}</Badge>
                  {user.isDeleted ? (
                    <Badge variant='destructive'>已注销</Badge>
                  ) : (
                    <Badge variant={enabled ? 'secondary' : 'destructive'}>
                      {enabled ? '正常' : '禁用'}
                    </Badge>
                  )}
                  {user.isStaff ? <Badge>管理员账号</Badge> : null}
                </div>
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <DetailField label='用户 ID' value={user.id} />
              <DetailField label='邮箱' value={user.email || '未绑定'} />
              <DetailField label='账号' value={user.account || user.username} />
              <DetailField label='手机号' value={user.phone} />
              <DetailField label='姓' value={user.lastName} />
              <DetailField label='名' value={user.firstName} />
              <DetailField label='性别' value={genderLabel(user.gender)} />
              <DetailField label='语言' value={user.locale} />
              <DetailField label='地区' value={formatLocation(user)} />
              <DetailField label='来源' value={sourceLabel(user.source)} />
              <DetailField
                label='上次登录'
                value={formatDateTime(user.lastLogin)}
              />
              <DetailField label='登录 IP' value={user.lastLoginIP} />
              <DetailField label='登录次数' value={user.loginCount ?? 0} />
              <DetailField
                label='连续学习'
                value={`${user.streakDays ?? 0} 天`}
              />
              <DetailField
                label='最近学习'
                value={formatDateTime(user.lastStudyDate)}
              />
              <DetailField
                label='注册时间'
                value={formatDateTime(user.createdAt)}
              />
              <DetailField
                label='更新时间'
                value={formatDateTime(user.updatedAt)}
              />
            </div>
          </div>
        ) : null}
        <SheetFooter className='flex-row items-center justify-between gap-2'>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <Button
              variant='destructive'
              onClick={() => setConfirmOpen(true)}
              disabled={deleting || user?.isDeleted}
            >
              <Trash2 className='size-4' />
              {user?.isDeleted ? '已注销' : '注销此账号'}
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认注销此账号？</AlertDialogTitle>
                <AlertDialogDescription>
                  注销后该用户将无法登录，数据保留但标记为已停用。此操作可恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    void handleDelete()
                  }}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className='size-4 animate-spin' />
                      注销中…
                    </>
                  ) : (
                    '确认注销'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
