import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { get, post, put } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ReadingPassageRow } from './types'
import {
  emptyQuestion,
  fromApiQuestion,
  toApiQuestions,
  type QuestionForm,
  type ReadingQuestionRow,
} from './question-types'

const LEVELS = ['初阶', '中阶', '高阶'] as const
const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

export function ReadingPassageFormSheet({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ReadingPassageRow | null
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<string>('初阶')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('published')
  const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!editing?.id) {
      setTitle('')
      setLevel('初阶')
      setSummary('')
      setContent('')
      setStatus('published')
      setQuestions([emptyQuestion()])
      return
    }
    setLoading(true)
    void get<{ passage: ReadingPassageRow; questions: ReadingQuestionRow[] }>(
      `/reading/admin/passages/${editing.id}`
    )
      .then((res) => {
        const p = res.data.passage
        setTitle(p.title || '')
        setLevel(p.level || '初阶')
        setSummary(p.summary || '')
        setContent(p.content || '')
        setStatus(p.status || 'published')
        const qs = (res.data.questions || []).map(fromApiQuestion)
        setQuestions(qs.length ? qs : [emptyQuestion()])
      })
      .catch(() => {
        toast.error('加载文章详情失败')
        setTitle(editing.title || '')
        setLevel(editing.level || '初阶')
        setSummary(editing.summary || '')
        setContent(editing.content || '')
        setStatus(editing.status || 'published')
        setQuestions([emptyQuestion()])
      })
      .finally(() => setLoading(false))
  }, [open, editing])

  const updateQuestion = (clientId: string, patch: Partial<QuestionForm>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.clientId === clientId ? { ...q, ...patch } : q))
    )
  }

  const updateOption = (
    clientId: string,
    key: (typeof OPTION_KEYS)[number],
    value: string
  ) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.clientId === clientId
          ? { ...q, options: { ...q.options, [key]: value } }
          : q
      )
    )
  }

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()])

  const removeQuestion = (clientId: string) => {
    setQuestions((prev) => (prev.length <= 1 ? prev : prev.filter((q) => q.clientId !== clientId)))
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('标题和正文不能为空')
      return
    }
    const apiQuestions = toApiQuestions(questions)
    if (apiQuestions.length === 0) {
      toast.error('请至少添加一道完整题目（题干、2 个以上选项、正确答案）')
      return
    }

    setSaving(true)
    try {
      if (editing?.id) {
        await put(`/reading/admin/passages/${editing.id}`, {
          title: title.trim(),
          level,
          summary,
          content,
          status,
        })
        await post(`/reading/admin/passages/${editing.id}/questions`, {
          replace: true,
          questions: apiQuestions,
        })
        toast.success('已更新')
      } else {
        await post('/reading/admin/passages', {
          title: title.trim(),
          level,
          summary,
          content,
          status,
          questions: apiQuestions,
        })
        toast.success('已创建')
      }
      onOpenChange(false)
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <SheetHeader className='shrink-0 border-b px-6 py-4 pe-12'>
          <SheetTitle>{editing ? '编辑阅读理解' : '新增阅读理解'}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className='flex flex-1 items-center justify-center py-16'>
            <Loader2 className='size-6 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <div className='flex-1 overflow-y-auto px-6 py-5'>
            <div className='space-y-6'>
              <section className='space-y-4'>
                <h3 className='text-sm font-semibold'>文章信息</h3>
                <div className='space-y-2'>
                  <Label>标题</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label>等级</Label>
                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((lv) => (
                          <SelectItem key={lv} value={lv}>{lv}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label>状态</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value='published'>已发布</SelectItem>
                        <SelectItem value='draft'>草稿</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label>摘要</Label>
                  <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
                </div>
                <div className='space-y-2'>
                  <Label>正文</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className='min-h-[160px] resize-y'
                  />
                </div>
              </section>

              <section className='space-y-3'>
                <div className='flex items-center justify-between gap-2'>
                  <h3 className='text-sm font-semibold'>选择题</h3>
                  <Button type='button' variant='outline' size='sm' onClick={addQuestion}>
                    <Plus className='size-4' />
                    添加题目
                  </Button>
                </div>
                <div className='space-y-4'>
                  {questions.map((q, idx) => (
                    <div
                      key={q.clientId}
                      className='space-y-3 rounded-lg border bg-muted/20 p-4'
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <span className='text-sm font-medium'>第 {idx + 1} 题</span>
                        {questions.length > 1 && (
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='size-8 text-muted-foreground hover:text-destructive'
                            onClick={() => removeQuestion(q.clientId)}
                          >
                            <Trash2 className='size-4' />
                          </Button>
                        )}
                      </div>
                      <div className='space-y-2'>
                        <Label>题干</Label>
                        <Input
                          value={q.stem}
                          onChange={(e) => updateQuestion(q.clientId, { stem: e.target.value })}
                        />
                      </div>
                      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                        {OPTION_KEYS.map((key) => (
                          <div key={key} className='space-y-1'>
                            <Label className='text-xs text-muted-foreground'>选项 {key}</Label>
                            <Input
                              value={q.options[key]}
                              onChange={(e) => updateOption(q.clientId, key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                        <div className='space-y-2'>
                          <Label>正确答案</Label>
                          <Select
                            value={q.answer}
                            onValueChange={(v) =>
                              updateQuestion(q.clientId, {
                                answer: v as QuestionForm['answer'],
                              })
                            }
                          >
                            <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {OPTION_KEYS.map((key) => (
                                <SelectItem key={key} value={key}>{key}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className='space-y-2'>
                          <Label>解析</Label>
                          <Input
                            value={q.explanation}
                            onChange={(e) =>
                              updateQuestion(q.clientId, { explanation: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        <SheetFooter className='shrink-0 flex-row justify-end gap-2 border-t bg-muted/30 px-6 py-4'>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
