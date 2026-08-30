import { createFileRoute } from '@tanstack/react-router'
import { NotificationChannelsPage } from '@/features/notification-channels'

export const Route = createFileRoute('/_authenticated/notification-channels/')({
  component: NotificationChannelsPage,
})
