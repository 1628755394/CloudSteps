import { createFileRoute } from '@tanstack/react-router'
import { PrivacyPage } from '@/features/legal/privacy'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})
