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
import { mediaSrc } from '@/features/wordbooks/word-audio'

export type VocabQuestion = {
  id: number
  word: string
  options?: string
  correctAnswer?: string
  level?: string
  difficultyScore?: number
  audioUrl?: string
}

export function parseQuestionOptions(options: string | undefined): string[] {
  if (!options?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(options)
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
  } catch {
    return options
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

type VocabQuestionDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: VocabQuestion | null
  onEdit?: (question: VocabQuestion) => void
}

export function VocabQuestionDetailSheet({
  open,
  onOpenChange,
  question,
  onEdit,
}: VocabQuestionDetailSheetProps) {
  const options = parseQuestionOptions(question?.options)
  const audio = question?.audioUrl ? mediaSrc(question.audioUrl) : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader className='text-start'>
          <SheetTitle>{question?.word || '题目详情'}</SheetTitle>
          <SheetDescription>查看选项、正确答案和音频预览。</SheetDescription>
        </SheetHeader>
        {question ? (
          <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge>{question.level || '—'}</Badge>
              <span className='text-sm text-muted-foreground'>
                难度 {question.difficultyScore ?? '—'}
              </span>
              <span className='text-sm text-muted-foreground'>
                ID {question.id}
              </span>
            </div>
            <div className='grid gap-1.5'>
              <Label>正确答案</Label>
              <p className='text-sm'>{question.correctAnswer || '—'}</p>
            </div>
            <div className='grid gap-1.5'>
              <Label>选项</Label>
              {options.length === 0 ? (
                <p className='text-sm text-muted-foreground'>暂无选项</p>
              ) : (
                <ul className='space-y-1.5'>
                  {options.map((opt) => (
                    <li
                      key={opt}
                      className={
                        opt === question.correctAnswer
                          ? 'rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm'
                          : 'rounded-md border px-3 py-2 text-sm'
                      }
                    >
                      {opt}
                      {opt === question.correctAnswer ? (
                        <span className='ms-2 text-xs text-muted-foreground'>
                          正确
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className='grid gap-1.5'>
              <Label>音频</Label>
              {audio ? (
                <audio
                  controls
                  preload='metadata'
                  src={audio}
                  className='w-full'
                  aria-label='题目音频预览'
                />
              ) : (
                <p className='text-sm text-muted-foreground'>暂无音频</p>
              )}
            </div>
          </div>
        ) : null}
        <SheetFooter>
          {question && onEdit ? (
            <Button
              onClick={() => {
                onEdit(question)
              }}
            >
              编辑
            </Button>
          ) : null}
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
