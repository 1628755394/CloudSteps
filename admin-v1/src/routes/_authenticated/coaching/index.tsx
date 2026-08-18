import { createFileRoute } from '@tanstack/react-router'
import { CoachingPage } from '@/features/coaching'

export const Route = createFileRoute('/_authenticated/coaching/')({
  component: CoachingPage,
})
