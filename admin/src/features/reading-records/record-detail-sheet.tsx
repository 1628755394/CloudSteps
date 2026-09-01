import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type ReadingRecordRow = {
  id: number
  userId?: number
  username?: string
  email?: string
  passageId?: number
  title?: string
  level?: string
  content?: string
  questionCount?: number
  correctCount?: number
  score?: number
  durationSec?: number
  isLatest?: boolean
  completedAt?: string
  source?: 'system' | 'custom'
  answers?: string
}

export type ReadingAnswer = {
  questionId?: number
  answer?: string
  correct?: boolean
}

export function parseReadingAnswers(raw: string | undefined): ReadingAnswer[] {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => {
      const row = item && typeof item === 'object' ? (item as ReadingAnswer) : {}
      return {
        questionId: row.questionId,
        answer: row.answer,
        correct: Boolean(row.correct),
      }
    })
  } catch {
    return []
  }
}

function formatDate(value: string | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function formatDuration(sec: number | undefined): string {
  if (sec == null || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`
}

type ReadingRecordDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: ReadingRecordRow | null
}

export function ReadingRecordDetailSheet({
  open,
  onOpenChange,
  record,
}: ReadingRecordDetailSheetProps) {
  const answers = parseReadingAnswers(record?.answers)
  const questionCount = record?.questionCount ?? 0
  const correctCount = record?.correctCount ?? 0
  const rate =
    questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-xl'>
        <SheetHeader className='text-start'>
          <SheetTitle>阅读练习详情</SheetTitle>
          <SheetDescription>
            {record?.title || '—'} · {record?.level || '—'}
          </SheetDescription>
        </SheetHeader>
        <div className='flex-1 space-y-4 overflow-y-auto py-4 text-sm'>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <Label className='text-muted-foreground'>用户</Label>
              <p>{record?.username || record?.email || record?.userId || '—'}</p>
            </div>
            <div>
              <Label className='text-muted-foreground'>来源</Label>
              <p>{record?.source === 'custom' ? '用户自定义' : '系统文章'}</p>
            </div>
            <div>
              <Label className='text-muted-foreground'>得分</Label>
              <p>{record?.score != null ? `${record.score} 分` : '—'}</p>
            </div>
            <div>
              <Label className='text-muted-foreground'>正确率</Label>
              <p>
                {questionCount
                  ? `${correctCount}/${questionCount}（${rate}%）`
                  : '—'}
              </p>
            </div>
            <div>
              <Label className='text-muted-foreground'>用时</Label>
              <p>{formatDuration(record?.durationSec)}</p>
            </div>
            <div>
              <Label className='text-muted-foreground'>完成时间</Label>
              <p>{formatDate(record?.completedAt)}</p>
            </div>
          </div>
          {record?.isLatest && (
            <Badge variant='secondary'>该用户在此文章的最新记录</Badge>
          )}
          {record?.content && (
            <div>
              <Label className='text-muted-foreground'>正文</Label>
              <p className='mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs leading-relaxed'>
                {record.content}
              </p>
            </div>
          )}
          {answers.length > 0 && (
            <div>
              <Label className='text-muted-foreground'>答题明细</Label>
              <ul className='mt-2 space-y-2'>
                {answers.map((a, i) => (
                  <li
                    key={`${a.questionId ?? i}-${i}`}
                    className='rounded-md border px-3 py-2'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span>题目 #{a.questionId ?? i + 1}</span>
                      <Badge variant={a.correct ? 'default' : 'destructive'}>
                        {a.correct ? '正确' : '错误'}
                      </Badge>
                    </div>
                    {a.answer && (
                      <p className='mt-1 text-muted-foreground'>答案：{a.answer}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
