import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/mail-templates/$id')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/notification-templates/$id',
      params: { id: params.id },
    })
  },
})
