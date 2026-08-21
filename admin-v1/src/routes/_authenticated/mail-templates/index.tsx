import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/mail-templates/')({
  beforeLoad: () => {
    throw redirect({ to: '/notification-templates' })
  },
})
