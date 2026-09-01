import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { get } from '@/lib/api'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type UserReadingRow = {
  id: number
  userId: number
  username?: string
  email?: string
  title: string
  level: string
  summary?: string
  source?: string
  wordCount?: number
  createdAt?: string
}

type ReadingQuestion = {
  id: number
  stem: string
  options: Array<{ key: string; text: string }>
  answer: string
  explanation?: string
}

export function UserReadingDetailSheet({
  passage,
  onClose,
}: {
  passage: UserReadingRow | null
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<ReadingQuestion[]>([])
  const [content, setContent] = useState('')
  const [user, setUser] = useState<{ username?: string; email?: string }>({})

  useEffect(() => {
    if (!passage?.id) {
      setQuestions([])
      setContent('')
      setUser({})
      return
    }
    setLoading(true)
    void get<{
      passage: { content?: string; title?: string; level?: string; summary?: string }
      user?: { username?: string; email?: string }
      questions: ReadingQuestion[]
    }>(`/reading/admin/custom/passages/${passage.id}`)
      .then((res) => {
        setContent(res.data.passage?.content || '')
        setQuestions(res.data.questions || [])
        setUser(res.data.user || {})
      })
      .catch(() => {
        setQuestions([])
        setContent('')
      })
      .finally(() => setLoading(false))
  }, [passage?.id])

  return (
    <Sheet open={!!passage} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <SheetHeader className='shrink-0 space-y-1 border-b px-6 py-4 pe-12'>
          <SheetTitle className='text-left leading-snug'>{passage?.title}</SheetTitle>
          {passage ? (
            <p className='text-sm text-muted-foreground'>
              {user.username || passage.username} · #{passage.userId} · {passage.level} · {passage.source}
            </p>
          ) : null}
        </SheetHeader>

        {loading ? (
          <div className='flex flex-1 items-center justify-center py-16'>
            <Loader2 className='size-6 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <div className='flex-1 overflow-y-auto px-6 py-5'>
            <div className='space-y-6 text-sm'>
              {passage?.summary ? (
                <section className='space-y-2'>
                  <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>摘要</h4>
                  <p className='text-foreground'>{passage.summary}</p>
                </section>
              ) : null}
              <section className='space-y-2'>
                <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>正文</h4>
                <div className='whitespace-pre-wrap rounded-lg border bg-muted/20 px-4 py-3 leading-relaxed'>
                  {content || '—'}
                </div>
              </section>
              <section className='space-y-3'>
                <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  题目（{questions.length}）
                </h4>
                <div className='space-y-3'>
                  {questions.map((q, i) => (
                    <div key={q.id} className='rounded-lg border px-4 py-3'>
                      <p className='font-medium'>{i + 1}. {q.stem}</p>
                      <ul className='mt-2 space-y-1 text-muted-foreground'>
                        {(q.options || []).map((o) => (
                          <li
                            key={o.key}
                            className={o.key === q.answer ? 'font-medium text-emerald-700' : undefined}
                          >
                            {o.key}. {o.text}
                            {o.key === q.answer ? ' ✓' : ''}
                          </li>
                        ))}
                      </ul>
                      {q.explanation ? (
                        <p className='mt-2 text-xs text-muted-foreground'>{q.explanation}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
