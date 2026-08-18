import { createFileRoute } from '@tanstack/react-router'
import { VocabQuestionsPage } from '@/features/vocab-questions'

export const Route = createFileRoute('/_authenticated/vocab-questions/')({
  component: VocabQuestionsPage,
})
