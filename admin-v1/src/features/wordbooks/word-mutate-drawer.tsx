import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { get, post, put } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { generateWordAudioUrls } from './lingecho-tts'
import { type Word, type WordForm } from './types'
import {
  AUDIO_SLOT_LABELS,
  type AudioUrlParts,
  joinAudioUrls,
  mediaSrc,
  splitAudioUrls,
} from './word-audio'
import { emptyWordForm, wordToForm } from './word-form'
import { ExampleSentencesPreview } from './example-sentences-preview'

type WordMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookId: string
  word: Word | null
  onSaved: () => void
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <div className='grid gap-1.5'>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export function WordMutateDrawer({
  open,
  onOpenChange,
  bookId,
  word,
  onSaved,
}: WordMutateDrawerProps) {
  const isEdit = !!word
  const [form, setForm] = useState<WordForm>(emptyWordForm)
  const [audioParts, setAudioParts] = useState<AudioUrlParts>(['', ''])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const apply = (next: Word) => {
      setForm(wordToForm(next))
      setAudioParts(splitAudioUrls(next.audioUrl))
    }

    if (!word) {
      setForm(emptyWordForm())
      setAudioParts(['', ''])
      return
    }

    apply(word)
    setLoadingDetail(true)
    ;(async () => {
      try {
        const res = await get<Word>(`/words/${word.id}`)
        if (!cancelled) apply(res.data)
      } catch {
        // keep list-row fields when detail fetch fails
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, word])

  const setField = <K extends keyof WordForm>(key: K, value: WordForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const setAudioPart = (idx: 0 | 1, value: string) => {
    const next: AudioUrlParts = [...audioParts]
    next[idx] = value
    setAudioParts(next)
    setField('audioUrl', joinAudioUrls(next))
  }

  const save = async () => {
    if (!form.word.trim()) {
      toast.error('请填写单词')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        audioUrl: joinAudioUrls(audioParts),
        difficulty: Number(form.difficulty) || 1,
        sortOrder: Number(form.sortOrder) || 0,
        frequency: Number(form.frequency) || 1,
        importance: Number(form.importance) || 1,
      }
      if (word) await put(`/wordbooks/${bookId}/words/${word.id}`, payload)
      else await post(`/wordbooks/${bookId}/words`, payload)
      toast.success(word ? '更新成功' : '添加成功')
      onOpenChange(false)
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const generateAudio = async () => {
    if (!form.word.trim()) {
      toast.error('请先填写单词')
      return
    }
    setGenerating(true)
    try {
      const audioUrl = await generateWordAudioUrls(form.word, form.translation)
      setField('audioUrl', audioUrl)
      setAudioParts(splitAudioUrls(audioUrl))
      toast.success('音频已生成')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-6xl'>
        <SheetHeader className='text-start'>
          <SheetTitle>{isEdit ? '编辑单词' : '添加单词'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? '查看并修改词条信息、音标、释义和音频预览。'
              : '填写词条信息。音频可手动填写 URL，或生成后再预览。'}
          </SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 overflow-y-auto px-4'>
          {loadingDetail ? (
            <div className='mb-3 flex items-center gap-2 text-xs text-muted-foreground'>
              <Loader2 className='size-3.5 animate-spin' />
              正在加载完整词条…
            </div>
          ) : null}

          <div className='grid gap-6 pb-4 lg:grid-cols-2'>
            <div className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <Field id='word' label='单词 *'>
                  <Input
                    id='word'
                    value={form.word}
                    onChange={(e) => setField('word', e.target.value)}
                  />
                </Field>
                <Field id='lemma' label='词元 (lemma)'>
                  <Input
                    id='lemma'
                    value={form.lemma}
                    onChange={(e) => setField('lemma', e.target.value)}
                  />
                </Field>
              </div>

              <div className='grid gap-4 sm:grid-cols-3'>
                <Field id='phonetic' label='音标（通用）'>
                  <Input
                    id='phonetic'
                    className='font-mono'
                    value={form.phonetic}
                    onChange={(e) => setField('phonetic', e.target.value)}
                  />
                </Field>
                <Field id='phoneticUs' label='美音 IPA'>
                  <Input
                    id='phoneticUs'
                    className='font-mono'
                    value={form.phoneticUs}
                    onChange={(e) => setField('phoneticUs', e.target.value)}
                  />
                </Field>
                <Field id='phoneticUk' label='英音 IPA'>
                  <Input
                    id='phoneticUk'
                    className='font-mono'
                    value={form.phoneticUk}
                    onChange={(e) => setField('phoneticUk', e.target.value)}
                  />
                </Field>
              </div>

              <div className='grid gap-4 sm:grid-cols-3'>
                <Field id='partOfSpeech' label='词性'>
                  <Input
                    id='partOfSpeech'
                    placeholder='noun / verb …'
                    value={form.partOfSpeech}
                    onChange={(e) => setField('partOfSpeech', e.target.value)}
                  />
                </Field>
                <Field id='cefrLevel' label='CEFR'>
                  <Input
                    id='cefrLevel'
                    placeholder='A1–C2'
                    value={form.cefrLevel}
                    onChange={(e) => setField('cefrLevel', e.target.value)}
                  />
                </Field>
                <div className='grid gap-1.5'>
                  <Label>音节 / 重音</Label>
                  <div className='flex gap-2'>
                    <Input
                      id='syllables'
                      aria-label='音节'
                      placeholder='音节'
                      value={form.syllables}
                      onChange={(e) => setField('syllables', e.target.value)}
                    />
                    <Input
                      id='stressPattern'
                      aria-label='重音'
                      placeholder='重音'
                      value={form.stressPattern}
                      onChange={(e) => setField('stressPattern', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Field id='translation' label='释义（JSON 数组或文本）'>
                <Textarea
                  id='translation'
                  rows={5}
                  className='font-mono'
                  placeholder='如: ["n. 苹果"]'
                  value={form.translation}
                  onChange={(e) => setField('translation', e.target.value)}
                />
              </Field>
              <Field id='definition' label='英文释义'>
                <Textarea
                  id='definition'
                  rows={3}
                  value={form.definition}
                  onChange={(e) => setField('definition', e.target.value)}
                />
              </Field>
              <Field id='exampleSentence' label='例句'>
                <Textarea
                  id='exampleSentence'
                  rows={3}
                  value={form.exampleSentence}
                  onChange={(e) => setField('exampleSentence', e.target.value)}
                />
              </Field>
              <Field id='exampleSentences' label='多例句'>
                <ExampleSentencesPreview raw={form.exampleSentences} />
              </Field>

              <div className='grid gap-4 sm:grid-cols-2'>
                <Field id='difficulty' label='难度 (1-5)'>
                  <Input
                    id='difficulty'
                    type='number'
                    min={1}
                    max={5}
                    value={form.difficulty}
                    onChange={(e) =>
                      setField('difficulty', Number(e.target.value))
                    }
                  />
                </Field>
                <Field id='sortOrder' label='排序权重'>
                  <Input
                    id='sortOrder'
                    type='number'
                    value={form.sortOrder}
                    onChange={(e) =>
                      setField('sortOrder', Number(e.target.value))
                    }
                  />
                </Field>
                <Field id='frequency' label='频率 1–5'>
                  <Input
                    id='frequency'
                    type='number'
                    min={1}
                    max={5}
                    value={form.frequency}
                    onChange={(e) =>
                      setField('frequency', Number(e.target.value))
                    }
                  />
                </Field>
                <Field id='importance' label='重要度 1–5'>
                  <Input
                    id='importance'
                    type='number'
                    min={1}
                    max={5}
                    value={form.importance}
                    onChange={(e) =>
                      setField('importance', Number(e.target.value))
                    }
                  />
                </Field>
              </div>

              <details className='rounded-lg border p-3'>
                <summary className='cursor-pointer text-sm font-medium'>
                  更多词典字段（语体、词源、搭配、JSON 列表）
                </summary>
                <div className='mt-4 space-y-3'>
                  <Field id='register' label='语体 register（JSON 数组）'>
                    <Input
                      id='register'
                      className='font-mono'
                      placeholder='如 ["neutral","informal"]'
                      value={form.register}
                      onChange={(e) => setField('register', e.target.value)}
                    />
                  </Field>
                  <Field id='etymology' label='词源'>
                    <Textarea
                      id='etymology'
                      rows={2}
                      value={form.etymology}
                      onChange={(e) => setField('etymology', e.target.value)}
                    />
                  </Field>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <Field id='morphology' label='形态 morphology（JSON）'>
                      <Textarea
                        id='morphology'
                        rows={2}
                        className='font-mono'
                        value={form.morphology}
                        onChange={(e) => setField('morphology', e.target.value)}
                      />
                    </Field>
                    <Field id='derivations' label='派生 derivations（JSON 数组）'>
                      <Textarea
                        id='derivations'
                        rows={2}
                        className='font-mono'
                        value={form.derivations}
                        onChange={(e) => setField('derivations', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field id='mnemonic' label='联想记忆'>
                    <Textarea
                      id='mnemonic'
                      rows={2}
                      value={form.mnemonic}
                      onChange={(e) => setField('mnemonic', e.target.value)}
                    />
                  </Field>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <Field id='synonyms' label='同义词 synonyms（JSON）'>
                      <Textarea
                        id='synonyms'
                        rows={2}
                        className='font-mono'
                        value={form.synonyms}
                        onChange={(e) => setField('synonyms', e.target.value)}
                      />
                    </Field>
                    <Field id='antonyms' label='反义词 antonyms（JSON）'>
                      <Textarea
                        id='antonyms'
                        rows={2}
                        className='font-mono'
                        value={form.antonyms}
                        onChange={(e) => setField('antonyms', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field id='collocations' label='搭配 collocations（JSON）'>
                    <Textarea
                      id='collocations'
                      rows={2}
                      className='font-mono'
                      value={form.collocations}
                      onChange={(e) => setField('collocations', e.target.value)}
                    />
                  </Field>
                  <Field id='wordFamily' label='词族 wordFamily（JSON）'>
                    <Textarea
                      id='wordFamily'
                      rows={2}
                      className='font-mono'
                      value={form.wordFamily}
                      onChange={(e) => setField('wordFamily', e.target.value)}
                    />
                  </Field>
                  <Field id='homophones' label='同音词 homophones（JSON）'>
                    <Textarea
                      id='homophones'
                      rows={2}
                      className='font-mono'
                      value={form.homophones}
                      onChange={(e) => setField('homophones', e.target.value)}
                    />
                  </Field>
                  <Field id='usageNotes' label='用法辨析'>
                    <Textarea
                      id='usageNotes'
                      rows={2}
                      value={form.usageNotes}
                      onChange={(e) => setField('usageNotes', e.target.value)}
                    />
                  </Field>
                  <Field
                    id='grammarPatterns'
                    label='常用结构 grammarPatterns（JSON 数组）'
                  >
                    <Textarea
                      id='grammarPatterns'
                      rows={2}
                      className='font-mono'
                      value={form.grammarPatterns}
                      onChange={(e) =>
                        setField('grammarPatterns', e.target.value)
                      }
                    />
                  </Field>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <Field id='tags' label='标签 tags（JSON）'>
                      <Textarea
                        id='tags'
                        rows={2}
                        className='font-mono'
                        value={form.tags}
                        onChange={(e) => setField('tags', e.target.value)}
                      />
                    </Field>
                    <Field id='notes' label='备注 notes'>
                      <Textarea
                        id='notes'
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setField('notes', e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <Field id='imageUrl' label='配图 imageUrl'>
                      <Input
                        id='imageUrl'
                        value={form.imageUrl}
                        onChange={(e) => setField('imageUrl', e.target.value)}
                      />
                    </Field>
                    <Field id='videoUrl' label='视频 videoUrl'>
                      <Input
                        id='videoUrl'
                        value={form.videoUrl}
                        onChange={(e) => setField('videoUrl', e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </details>
            </div>

            <div className='space-y-4'>
              <div className='flex items-center justify-between gap-2'>
                <Label>音频预览</Label>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={generating || !form.word.trim()}
                  onClick={() => void generateAudio()}
                >
                  {generating ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <Volume2 />
                  )}
                  {generating ? '生成中…' : '生成音频'}
                </Button>
              </div>

              <div className='space-y-4'>
                {([0, 1] as const).map((idx) => {
                  const src = mediaSrc(audioParts[idx])
                  return (
                    <div key={idx} className='space-y-2 rounded-lg border p-3'>
                      <Field
                        id={`audio-${idx}`}
                        label={`${AUDIO_SLOT_LABELS[idx]} · URL ${idx + 1}`}
                      >
                        <Input
                          id={`audio-${idx}`}
                          value={audioParts[idx]}
                          onChange={(e) => setAudioPart(idx, e.target.value)}
                        />
                      </Field>
                      {src ? (
                        <audio
                          controls
                          preload='metadata'
                          src={src}
                          className='w-full'
                          aria-label={`${AUDIO_SLOT_LABELS[idx]} 预览`}
                        />
                      ) : (
                        <p className='text-xs text-muted-foreground'>
                          暂无音频，填写 URL 或点击生成后可预览。
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {form.imageUrl.trim() ? (
                <div className='space-y-2'>
                  <Label>配图预览</Label>
                  <img
                    src={mediaSrc(form.imageUrl)}
                    alt={form.word || '配图'}
                    className='max-h-40 rounded-md border object-contain'
                  />
                </div>
              ) : null}

              {form.videoUrl.trim() ? (
                <div className='space-y-2'>
                  <Label>视频预览</Label>
                  <video
                    controls
                    src={mediaSrc(form.videoUrl)}
                    className='max-h-48 w-full rounded-md border'
                    aria-label='视频预览'
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <SheetFooter className='flex-row justify-end gap-2'>
          <Button
            variant='outline'
            className='w-auto'
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button className='w-auto' disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className='animate-spin' /> : null}
            {saving ? '保存中…' : '保存'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
