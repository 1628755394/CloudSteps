import { createFileRoute } from '@tanstack/react-router'
import { InboxNotificationsPage } from '@/features/inbox-notifications'

export const Route = createFileRoute('/_authenticated/inbox-notifications/')({
  component: InboxNotificationsPage,
})
