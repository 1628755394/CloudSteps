import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { post, put } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  parseQuestionOptions,
  type VocabQuestion,
} from './question-detail-sheet'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

export type VocabQuestionFormValues = {
  word: string
  level: string
  difficultyScore: number
  options: string[]
  correctAnswer: string
  audioUrl: string
}

const emptyForm = (): VocabQuestionFormValues => ({
  word: '',
  level: 'A1',
  difficultyScore: 1,
  options: ['', '', '', ''],
  correctAnswer: '',
  audioUrl: '',
})

function fromQuestion(q: VocabQuestion): VocabQuestionFormValues {
  const parsed = parseQuestionOptions(q.options)
  const options = [...parsed]
  while (options.length < 4) options.push('')
  return {
    word: q.word || '',
    level: q.level || 'A1',
    difficultyScore: q.difficultyScore && q.difficultyScore > 0 ? q.difficultyScore : 1,
    options: options.slice(0, 8),
    correctAnswer: q.correctAnswer || '',
    audioUrl: q.audioUrl || '',
  }
}

type VocabQuestionFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: VocabQuestion | null
  onSaved: () => void | Promise<void>
}

export function VocabQuestionFormDialog({
  open,
  onOpenChange,
  question,
  onSaved,
}: VocabQuestionFormDialogProps) {
  const isEdit = Boolean(question?.id)
  const [form, setForm] = useState<VocabQuestionFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(question ? fromQuestion(question) : emptyForm())
  }, [open, question])

  const filledOptions = useMemo(
    () => form.options.map((o) => o.trim()).filter(Boolean),
    [form.options]
  )

  const setOption = (index: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.options]
      next[index] = value
      const trimmed = value.trim()
      const correctStillValid =
        !prev.correctAnswer ||
        next.map((o) => o.trim()).includes(prev.correctAnswer)
      return {
        ...prev,
        options: next,
        correctAnswer: correctStillValid
          ? prev.correctAnswer
          : trimmed || '',
      }
    })
  }

  const save = async () => {
    const word = form.word.trim()
    const level = form.level.trim()
    const correctAnswer = form.correctAnswer.trim()
    const options = form.options.map((o) => o.trim()).filter(Boolean)

    if (!word) {
      toast.error('请填写单词')
      return
    }
    if (!level) {
      toast.error('请选择级别')
      return
    }
    if (options.length < 2) {
      toast.error('至少填写 2 个选项')
      return
    }
    if (!correctAnswer) {
      toast.error('请选择正确答案')
      return
    }
    if (!options.includes(correctAnswer)) {
      toast.error('正确答案必须在选项中')
      return
    }
    if (form.difficultyScore < 1 || form.difficultyScore > 20) {
      toast.error('难度分需在 1–20')
      return
    }

    const payload = {
      word,
      level,
      difficultyScore: form.difficultyScore,
      options: JSON.stringify(options),
      correctAnswer,
      audioUrl: form.audioUrl.trim(),
    }

    setSaving(true)
    try {
      if (isEdit && question) {
        await put(`/vocab/questions/${question.id}`, payload)
        toast.success('题目已更新')
      } else {
        await post('/vocab/questions', payload)
        toast.success('题目已创建')
      }
      onOpenChange(false)
      await onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑题目' : '新增题目'}</DialogTitle>
        </DialogHeader>
        <div className='grid gap-3'>
          <div className='grid gap-1.5'>
            <Label htmlFor='vq-word'>单词</Label>
            <Input
              id='vq-word'
              value={form.word}
              placeholder='如 apple'
              onChange={(e) => setForm((f) => ({ ...f, word: e.target.value }))}
            />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-1.5'>
              <Label>级别</Label>
              <Select
                value={form.level}
                onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='选择级别' />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((lv) => (
                    <SelectItem key={lv} value={lv}>
                      {lv}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='vq-diff'>难度分 (1–20)</Label>
              <Input
                id='vq-diff'
                type='number'
                min={1}
                max={20}
                value={form.difficultyScore}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    difficultyScore: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>
          </div>
          <div className='grid gap-1.5'>
            <Label>选项（至少 2 个）</Label>
            <div className='grid gap-2'>
              {form.options.map((opt, i) => (
                <Input
                  key={i}
                  value={opt}
                  placeholder={`选项 ${i + 1}`}
                  onChange={(e) => setOption(i, e.target.value)}
                />
              ))}
            </div>
            {form.options.length < 8 ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='w-fit'
                onClick={() =>
                  setForm((f) => ({ ...f, options: [...f.options, ''] }))
                }
              >
                添加选项
              </Button>
            ) : null}
          </div>
          <div className='grid gap-1.5'>
            <Label>正确答案</Label>
            <Select
              value={form.correctAnswer || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, correctAnswer: v }))}
              disabled={filledOptions.length === 0}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='从选项中选择' />
              </SelectTrigger>
              <SelectContent>
                {filledOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='vq-audio'>音频 URL（可选）</Label>
            <Input
              id='vq-audio'
              value={form.audioUrl}
              placeholder='/uploads/... 或 https://...'
              onChange={(e) =>
                setForm((f) => ({ ...f, audioUrl: e.target.value }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button type='button' onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className='animate-spin' /> : null}
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
