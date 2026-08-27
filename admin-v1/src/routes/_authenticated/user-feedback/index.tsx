import { createFileRoute } from '@tanstack/react-router'
import { UserFeedbackPage } from '@/features/user-feedback'

export const Route = createFileRoute('/_authenticated/user-feedback/')({
  component: UserFeedbackPage,
})
