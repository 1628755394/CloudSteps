import { createFileRoute } from '@tanstack/react-router'
import { MailLogsPage } from '@/features/mail-logs'

export const Route = createFileRoute('/_authenticated/mail-logs/')({
  component: MailLogsPage,
})
