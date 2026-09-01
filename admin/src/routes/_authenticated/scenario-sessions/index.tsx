import { createFileRoute } from '@tanstack/react-router'
import { ScenarioSessionsPage } from '@/features/scenario-sessions'

export const Route = createFileRoute('/_authenticated/scenario-sessions/')({
  component: ScenarioSessionsPage,
})
