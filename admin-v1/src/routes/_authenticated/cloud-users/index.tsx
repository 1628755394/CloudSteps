import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/cloud-users/')({
  beforeLoad: () => {
    throw redirect({ to: '/users' })
  },
  component: () => null,
})
