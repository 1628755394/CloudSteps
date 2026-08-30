import { createFileRoute } from '@tanstack/react-router'
import { NotificationTemplatesPage } from '@/features/mail-templates'

export const Route = createFileRoute('/_authenticated/notification-templates/')(
  {
    component: NotificationTemplatesPage,
  }
)
