import { createFileRoute } from '@tanstack/react-router'
import { WordBookWordsPage } from '@/features/wordbooks/words'
import { wordbooksSearchSchema } from '@/features/wordbooks/search'

export const Route = createFileRoute('/_authenticated/wordbooks/$bookId')({
  validateSearch: wordbooksSearchSchema,
  component: WordBookWordsRoute,
})

function WordBookWordsRoute() {
  const { bookId } = Route.useParams()
  return <WordBookWordsPage bookId={bookId} />
}
