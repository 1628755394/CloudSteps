import { createFileRoute } from '@tanstack/react-router'
import { CloudUsersPage } from '@/features/cloud-users'

export const Route = createFileRoute('/_authenticated/users/')({
  component: CloudUsersPage,
})
