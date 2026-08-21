import { createFileRoute } from '@tanstack/react-router'
import { LoginHistoryPage } from '@/features/login-history'

export const Route = createFileRoute('/_authenticated/settings/login-history/')({
  component: LoginHistoryPage,
})
