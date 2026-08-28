import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type VocabRecord = {
  id: number
  userId?: number
  userEmail?: string
  userDisplayName?: string
  estimatedLevel?: string
  estimatedVocab?: number
  questionCount?: number
  correctCount?: number
  isLatest?: boolean
  completedAt?: string
  createdAt?: string
  answers?: string
}

export type VocabAnswer = {
  questionId?: number
  level?: string
  answer?: string
  correct?: boolean
}

export function parseRecordAnswers(answers: string | undefined): VocabAnswer[] {
  if (!answers?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(answers)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => {
      const row = item && typeof item === 'object' ? (item as VocabAnswer) : {}
      return {
        questionId: row.questionId,
        level: row.level,
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

type VocabRecordDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: VocabRecord | null
}

export function VocabRecordDetailSheet({
  open,
  onOpenChange,
  record,
}: VocabRecordDetailSheetProps) {
  const answers = parseRecordAnswers(record?.answers)
  const questionCount = record?.questionCount ?? 0
  const correctCount = record?.correctCount ?? 0
  const rate =
    questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-xl'>
        <SheetHeader className='text-start'>
          <SheetTitle>测试记录详情</SheetTitle>
          <SheetDescription>
            {record?.userDisplayName || record?.userEmail || `记录 #${record?.id ?? ''}`}
          </SheetDescription>
        </SheetHeader>
        {record ? (
          <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4'>
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              <div className='rounded-md border p-3'>
                <p className='text-xs text-muted-foreground'>测评等级</p>
                <Badge className='mt-1'>{record.estimatedLevel || '—'}</Badge>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-xs text-muted-foreground'>估算词汇量</p>
                <p className='mt-1 text-lg font-semibold'>
                  {record.estimatedVocab?.toLocaleString() ?? '—'}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-xs text-muted-foreground'>正确率</p>
                <p className='mt-1 text-lg font-semibold'>{rate}%</p>
                <p className='text-xs text-muted-foreground'>
                  {correctCount}/{questionCount}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-xs text-muted-foreground'>完成时间</p>
                <p className='mt-1 text-sm'>
                  {formatDate(record.completedAt || record.createdAt)}
                </p>
              </div>
            </div>

            <div className='grid gap-1.5'>
              <Label>答题详情</Label>
              {answers.length === 0 ? (
                <p className='text-sm text-muted-foreground'>暂无答题快照</p>
              ) : (
                <ul className='space-y-1.5'>
                  {answers.map((a, i) => (
                    <li
                      key={`${a.questionId ?? i}-${i}`}
                      className={
                        a.correct
                          ? 'flex items-center gap-3 rounded-md bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30'
                          : 'flex items-center gap-3 rounded-md bg-red-50 px-3 py-2 text-sm dark:bg-red-950/30'
                      }
                    >
                      <span className='w-4 shrink-0 text-center text-xs font-bold'>
                        {a.correct ? '✓' : '✗'}
                      </span>
                      <span className='w-8 shrink-0 text-xs text-muted-foreground'>
                        {a.level || '—'}
                      </span>
                      <span>题目 #{a.questionId ?? i + 1}</span>
                      <span className='ms-auto text-xs text-muted-foreground'>
                        答: {a.answer || '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
