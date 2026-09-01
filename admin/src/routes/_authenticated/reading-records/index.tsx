import { createFileRoute } from '@tanstack/react-router'
import { ReadingRecordsPage } from '@/features/reading-records'

export const Route = createFileRoute('/_authenticated/reading-records/')({
  component: ReadingRecordsPage,
})
