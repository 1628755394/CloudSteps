import { useNavigate, useLocation } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { get } from '@/lib/api'
import { currentPath } from '@/lib/current-path'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { auth } = useAuthStore()

  const handleSignOut = async () => {
    try {
      await get('/auth/logout')
    } catch {
      // ignore logout API errors
    }
    auth.reset()
    const currentPathValue = currentPath(location)
    navigate({
      to: '/sign-in',
      search: { redirect: currentPathValue },
      replace: true,
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='退出登录'
      desc='确定退出管理后台吗？再次访问需要重新登录。'
      confirmText='退出登录'
      cancelBtnText='取消'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
