import { createFileRoute } from '@tanstack/react-router'
import { StorageStatsPage } from '@/features/storage-stats'

export const Route = createFileRoute('/_authenticated/storage-stats/')({
  component: StorageStatsPage,
})
