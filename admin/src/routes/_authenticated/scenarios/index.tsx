import { createFileRoute } from '@tanstack/react-router'
import { ScenariosPage } from '@/features/scenarios'

export const Route = createFileRoute('/_authenticated/scenarios/')({
  component: ScenariosPage,
})
