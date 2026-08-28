import { createFileRoute } from '@tanstack/react-router'
import { UserWordsPage } from '@/features/user-words'

export const Route = createFileRoute('/_authenticated/user-words/')({
  component: UserWordsPage,
})
