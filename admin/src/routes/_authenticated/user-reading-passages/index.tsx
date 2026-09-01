import { createFileRoute } from '@tanstack/react-router'
import { UserReadingPassagesPage } from '@/features/user-reading-passages'

export const Route = createFileRoute('/_authenticated/user-reading-passages/')({
  component: UserReadingPassagesPage,
})
