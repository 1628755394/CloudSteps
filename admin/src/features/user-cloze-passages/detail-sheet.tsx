import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { get } from '@/lib/api'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type UserClozeRow = {
  id: number
  userId: number
  username?: string
  email?: string
  title: string
  level: string
  summary?: string
  blankCount?: number
  source?: string
}

type ClozeBlank = {
  id: number
  blankNo: number
  options: Array<{ key: string; text: string }>
  answer: string
  explanation?: string
}

export function UserClozeDetailSheet({
  passage,
  onClose,
}: {
  passage: UserClozeRow | null
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [blanks, setBlanks] = useState<ClozeBlank[]>([])
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!passage?.id) {
      setBlanks([])
      setContent('')
      return
    }
    setLoading(true)
    void get<{
      passage: { content?: string }
      blanks: ClozeBlank[]
    }>(`/cloze/admin/custom/passages/${passage.id}`)
      .then((res) => {
        setContent(res.data.passage?.content || '')
        setBlanks(res.data.blanks || [])
      })
      .catch(() => {
        setBlanks([])
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
              {passage.username || passage.email} · #{passage.userId} · {passage.level}
            </p>
          ) : null}
        </SheetHeader>
        {loading ? (
          <div className='flex flex-1 items-center justify-center py-16'>
            <Loader2 className='size-6 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <div className='flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm'>
            <section>
              <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2'>正文</h4>
              <div className='whitespace-pre-wrap rounded-lg border bg-muted/20 px-4 py-3 leading-relaxed'>
                {content || '—'}
              </div>
            </section>
            <section>
              <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2'>
                空位（{blanks.length}）
              </h4>
              <div className='space-y-3'>
                {blanks.map((b) => (
                  <div key={b.id} className='rounded-lg border px-4 py-3'>
                    <p className='font-medium'>空位 {b.blankNo}</p>
                    <ul className='mt-2 space-y-1 text-muted-foreground'>
                      {(b.options || []).map((o) => (
                        <li
                          key={o.key}
                          className={o.key === b.answer ? 'font-medium text-emerald-700' : undefined}
                        >
                          {o.key}. {o.text}
                          {o.key === b.answer ? ' ✓' : ''}
                        </li>
                      ))}
                    </ul>
                    {b.explanation ? (
                      <p className='mt-2 text-xs text-muted-foreground'>{b.explanation}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
