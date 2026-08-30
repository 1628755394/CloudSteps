import { createFileRoute } from '@tanstack/react-router'
import { OperationLogsPage } from '@/features/operation-logs'

export const Route = createFileRoute(
  '/_authenticated/settings/operation-logs/'
)({
  component: OperationLogsPage,
})
