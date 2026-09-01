import { createFileRoute } from '@tanstack/react-router'
import { ReadingPassagesPage } from '@/features/reading-passages'

export const Route = createFileRoute('/_authenticated/reading-passages/')({
  component: ReadingPassagesPage,
})
