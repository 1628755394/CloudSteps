import { createFileRoute } from '@tanstack/react-router'
import { VocabRecordsPage } from '@/features/vocab-records'

export const Route = createFileRoute('/_authenticated/vocab-records/')({
  component: VocabRecordsPage,
})
