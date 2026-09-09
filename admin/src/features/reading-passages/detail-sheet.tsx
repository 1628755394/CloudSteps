import { useEffect, useState } from 'react'
import { BookMarked, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { get, post } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type {
  GenerateAnalysisResult,
  ReadingAnalysisSentence,
  ReadingPassageRow,
} from './types'
import type { ReadingQuestionRow } from './question-types'

const ANALYSIS_TIMEOUT_MS = 180_000

export function ReadingPassageDetailSheet({
  passage,
  onClose,
  onRefresh,
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
  const [analysis, setAnalysis] = useState<ReadingAnalysisSentence[]>([])
  const [generating, setGenerating] = useState(false)

  const loadDetail = async (id: number) => {
    setLoading(true)
    try {
      const res = await get<{
        passage: ReadingPassageRow
        questions: ReadingQuestionRow[]
        analysis?: ReadingAnalysisSentence[]
      }>(`/reading/admin/passages/${id}`)
      setDetail(res.data.passage)
      setContent(res.data.passage?.content || '')
      setQuestions(res.data.questions || [])
      setAnalysis(res.data.analysis || [])
    } catch {
      setDetail(passage)
      setContent(passage?.content || '')
      setQuestions([])
      setAnalysis([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!passage?.id) {
      setDetail(null)
      setQuestions([])
      setContent('')
      setAnalysis([])
      return
    }
    void loadDetail(passage.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage?.id])

  const row = detail || passage
  const analysisReady = Boolean(row?.analysisReady) || analysis.length > 0

  const handleGenerate = async (force = false) => {
    if (!row?.id || generating) return
    setGenerating(true)
    try {
      const qs = force ? '?force=1' : ''
      const res = await post<GenerateAnalysisResult>(
        `/reading/admin/passages/${row.id}/analysis${qs}`,
        undefined,
        { timeout: ANALYSIS_TIMEOUT_MS }
      )
      const items = res.data.items || []
      setAnalysis(items)
      setDetail((prev) =>
        prev ? { ...prev, analysisReady: true } : { ...row, analysisReady: true }
      )
      toast.success(
        res.data.skipped
          ? '细学已就绪'
          : `细学已生成（${res.data.sentenceCount ?? items.length} 句）`
      )
      onRefresh?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '生成细学失败')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Sheet open={!!passage} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <SheetHeader className='shrink-0 space-y-1 border-b px-6 py-4 pe-12'>
          <div className='flex items-start justify-between gap-3'>
            <SheetTitle className='text-left leading-snug'>{row?.title}</SheetTitle>
            <div className='flex shrink-0 items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={generating || loading}
                onClick={() => void handleGenerate(analysisReady)}
              >
                {generating ? (
                  <Loader2 className='size-3.5 animate-spin' />
                ) : (
                  <BookMarked className='size-3.5' />
                )}
                {analysisReady ? '重新生成细学' : '生成细学'}
              </Button>
              {row && onEdit ? (
                <Button
                  variant='outline'
                  size='sm'
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
          </div>
          {row ? (
            <p className='text-sm text-muted-foreground'>
              {row.level} · {row.status}
              {row.summary ? ` · ${row.summary}` : ''}
              {` · 细学${analysisReady ? `已生成（${analysis.length} 句）` : '未生成'}`}
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
                <div className='flex items-center justify-between gap-2'>
                  <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                    细学（逐句解析）
                  </h4>
                  {!analysisReady && !generating ? (
                    <Button
                      size='sm'
                      variant='secondary'
                      onClick={() => void handleGenerate(false)}
                    >
                      <BookMarked className='size-3.5' />
                      立即生成
                    </Button>
                  ) : null}
                </div>
                {generating ? (
                  <div className='flex items-center gap-2 rounded-lg border px-4 py-6 text-muted-foreground'>
                    <Loader2 className='size-4 animate-spin' />
                    正在生成细学，可能需要一分钟…
                  </div>
                ) : analysis.length === 0 ? (
                  <p className='rounded-lg border border-dashed px-4 py-6 text-muted-foreground'>
                    尚未生成细学。生成后可在此预览每句翻译、成分与重点短语。
                  </p>
                ) : (
                  <div className='space-y-3'>
                    {analysis.map((item, i) => (
                      <div
                        key={`${item.sentence}-${i}`}
                        className='rounded-lg border px-4 py-3 space-y-2'
                      >
                        <p className='text-[11px] font-semibold text-primary'>
                          第 {i + 1} 句
                        </p>
                        <p className='font-medium text-foreground leading-relaxed'>
                          {item.sentence}
                        </p>
                        <p className='text-muted-foreground leading-relaxed'>
                          {item.translation || '—'}
                        </p>
                        {(item.components || []).length > 0 ? (
                          <div className='flex flex-wrap gap-1.5 pt-1'>
                            {(item.components || []).map((c, ci) => (
                              <span
                                key={`${c.label}-${ci}`}
                                className='inline-flex items-baseline gap-1 rounded-md bg-muted px-2 py-1 text-xs'
                              >
                                <span className='font-semibold text-muted-foreground'>
                                  {c.label}
                                </span>
                                <span>{c.text}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {(item.keyPhrases || []).length > 0 ? (
                          <div className='space-y-1.5 pt-1'>
                            {(item.keyPhrases || []).map((p, pi) => (
                              <div
                                key={`${p.text}-${pi}`}
                                className='rounded-md border border-amber-200/70 bg-amber-50/60 px-2.5 py-2 dark:border-amber-900/40 dark:bg-amber-950/20'
                              >
                                <p className='font-medium'>{p.text}</p>
                                {p.explanation ? (
                                  <p className='mt-0.5 text-xs text-muted-foreground'>
                                    {p.explanation}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
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
                                o.key === q.answer
                                  ? 'font-medium text-emerald-700'
                                  : undefined
                              }
                            >
                              {o.key}. {o.text}
                              {o.key === q.answer ? ' ✓' : ''}
                            </li>
                          ))}
                        </ul>
                        {q.explanation ? (
                          <p className='mt-2 text-xs text-muted-foreground'>
                            {q.explanation}
                          </p>
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
