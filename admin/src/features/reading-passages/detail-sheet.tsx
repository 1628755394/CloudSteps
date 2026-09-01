import { useEffect, useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { get } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ReadingPassageRow } from './types'
import type { ReadingQuestionRow } from './question-types'

export function ReadingPassageDetailSheet({
  passage,
  onClose,
  onEdit,
}: {
  passage: ReadingPassageRow | null
  onClose: () => void
  onRefresh?: () => void
  onEdit?: (row: ReadingPassageRow) => void
}) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<ReadingPassageRow | null>(null)
  const [questions, setQuestions] = useState<ReadingQuestionRow[]>([])
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!passage?.id) {
      setDetail(null)
      setQuestions([])
      setContent('')
      return
    }
    setLoading(true)
    void get<{ passage: ReadingPassageRow; questions: ReadingQuestionRow[] }>(
      `/reading/admin/passages/${passage.id}`
    )
      .then((res) => {
        setDetail(res.data.passage)
        setContent(res.data.passage?.content || '')
        setQuestions(res.data.questions || [])
      })
      .catch(() => {
        setDetail(passage)
        setContent(passage.content || '')
        setQuestions([])
      })
      .finally(() => setLoading(false))
  }, [passage])

  const row = detail || passage

  return (
    <Sheet open={!!passage} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <SheetHeader className='shrink-0 space-y-1 border-b px-6 py-4 pe-12'>
          <div className='flex items-start justify-between gap-3'>
            <SheetTitle className='text-left leading-snug'>{row?.title}</SheetTitle>
            {row && onEdit ? (
              <Button
                variant='outline'
                size='sm'
                className='shrink-0'
                onClick={() => {
                  onEdit(row)
                  onClose()
                }}
              >
                <Pencil className='size-3.5' />
                编辑
              </Button>
            ) : null}
          </div>
          {row ? (
            <p className='text-sm text-muted-foreground'>
              {row.level} · {row.status}
              {row.summary ? ` · ${row.summary}` : ''}
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
              <section className='space-y-2'>
                <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  正文
                </h4>
                <div className='whitespace-pre-wrap rounded-lg border bg-muted/20 px-4 py-3 leading-relaxed'>
                  {content || '—'}
                </div>
              </section>

              <section className='space-y-3'>
                <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  题目（{questions.length}）
                </h4>
                {questions.length === 0 ? (
                  <p className='text-muted-foreground'>暂无题目</p>
                ) : (
                  <div className='space-y-3'>
                    {questions.map((q, i) => (
                      <div key={q.id ?? i} className='rounded-lg border px-4 py-3'>
                        <p className='font-medium text-foreground'>
                          {i + 1}. {q.stem}
                        </p>
                        <ul className='mt-2 space-y-1 text-muted-foreground'>
                          {(q.options || []).map((o) => (
                            <li
                              key={o.key}
                              className={
                                o.key === q.answer ? 'font-medium text-emerald-700' : undefined
                              }
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
                )}
              </section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
