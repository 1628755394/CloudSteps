import { createFileRoute } from '@tanstack/react-router'
import { UserClozePassagesPage } from '@/features/user-cloze-passages'

export const Route = createFileRoute('/_authenticated/user-cloze-passages/')({
  component: UserClozePassagesPage,
})
