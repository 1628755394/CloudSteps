import { createFileRoute } from '@tanstack/react-router'
import { wordbooksSearchSchema } from '@/features/wordbooks/search'
import { WordBookWordsPage } from '@/features/wordbooks/words'

export const Route = createFileRoute('/_authenticated/wordbooks/$bookId')({
  validateSearch: wordbooksSearchSchema,
  component: WordBookWordsRoute,
})

function WordBookWordsRoute() {
  const { bookId } = Route.useParams()
  return <WordBookWordsPage bookId={bookId} />
}
