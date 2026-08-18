import { createFileRoute, redirect } from '@tanstack/react-router'
import { WordBooksPage } from '@/features/wordbooks'
import {
  defaultWordbooksSearch,
  missingWordbooksPaging,
  wordbooksSearchSchema,
} from '@/features/wordbooks/search'

export const Route = createFileRoute('/_authenticated/wordbooks/')({
  validateSearch: wordbooksSearchSchema,
  beforeLoad: ({ location }) => {
    if (!missingWordbooksPaging(location.searchStr)) return
    throw redirect({
      to: '/wordbooks',
      search: defaultWordbooksSearch(),
      replace: true,
    })
  },
  component: WordBooksPage,
})
