import { useCallback, useEffect, useState } from 'react'
import { ImageIcon, Loader2, Sparkles, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { get, post } from '@/lib/api'
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
import { Textarea } from '@/components/ui/textarea'

type WordBookBrief = {
  id: number
  name: string
  level?: string
  description?: string
  coverUrl?: string
}

type CoverDefaults = {
  promptTemplate: string
  prompt: string
  model: string
  baseUrl: string
  configured: boolean
  defaultSize: string
}

type GenerateCoverResult = {
  coverUrl?: string
  previewBase64?: string
  prompt?: string
  revisedPrompt?: string
}

export function WordbookCoverDialog({
  book,
  open,
  onOpenChange,
  onSaved,
}: {
  book: WordBookBrief | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (coverUrl: string) => void
}) {
  const [loadingDefaults, setLoadingDefaults] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [testing, setTesting] = useState(false)
  const [promptTemplate, setPromptTemplate] = useState('')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [preview, setPreview] = useState('')
  const [configured, setConfigured] = useState(false)
  const [model, setModel] = useState('')
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [referencePreview, setReferencePreview] = useState('')

  const loadDefaults = useCallback(async () => {
    if (!book) return
    setLoadingDefaults(true)
    try {
      const res = await get<CoverDefaults>('/wordbooks/cover-ai/defaults', {
        params: {
          name: book.name,
          level: book.level || '',
          description: book.description || '',
        },
      })
      const data = res.data
      setPromptTemplate(data?.promptTemplate || '')
      setPrompt(data?.prompt || '')
      setSize(data?.defaultSize || '1024x1024')
      setConfigured(Boolean(data?.configured))
      setModel(data?.model || '')
      setPreview(book.coverUrl || '')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载封面预设失败')
    } finally {
      setLoadingDefaults(false)
    }
  }, [book])

  useEffect(() => {
    if (!open || !book) return
    setReferenceFile(null)
    setReferencePreview('')
    void loadDefaults()
  }, [open, book, loadDefaults])

  const applyTemplate = () => {
    if (!book) return
    const filled = promptTemplate
      .replace(/\{\{name\}\}/g, book.name)
      .replace(/\{\{level\}\}/g, book.level || '')
      .replace(/\{\{description\}\}/g, (book.description || '').slice(0, 120))
    setPrompt(filled.trim())
  }

  const onReferenceChange = (file: File | null) => {
    setReferenceFile(file)
    if (!file) {
      setReferencePreview('')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setReferencePreview(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  const runTest = async () => {
    setTesting(true)
    try {
      const res = await post<Record<string, unknown>>('/wordbooks/cover-ai/test')
      toast.success(res.msg || '图片生成接口可用')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '接口测试失败')
    } finally {
      setTesting(false)
    }
  }

  const generate = async (save: boolean) => {
    if (!book) return
    if (!prompt.trim()) {
      toast.error('请填写提示词')
      return
    }
    setGenerating(true)
    try {
      const form = new FormData()
      form.append('prompt', prompt.trim())
      form.append('size', size.trim() || '1024x1024')
      form.append('save', save ? 'true' : 'false')
      if (referenceFile) {
        form.append('referenceImage', referenceFile)
      }
      const res = await post<GenerateCoverResult>(
        `/wordbooks/${book.id}/generate-cover`,
        form,
        { timeout: 180_000 }
      )
      const data = res.data
      if (data?.previewBase64) {
        setPreview(data.previewBase64)
      } else if (data?.coverUrl) {
        setPreview(data.coverUrl)
      }
      if (save && data?.coverUrl) {
        toast.success('封面已保存')
        onSaved?.(data.coverUrl)
      } else {
        toast.success('预览已生成')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='size-4' />
            AI 生成词库封面
          </DialogTitle>
        </DialogHeader>

        {book ? (
          <div className='space-y-4 py-2'>
            <p className='text-sm text-muted-foreground'>
              {book.name}
              {book.level ? ` · ${book.level}` : ''}
              {model ? ` · 模型 ${model}` : ''}
              {!configured ? ' · 未配置 IMAGE_GEN_API_KEY' : ''}
            </p>

            <div className='grid gap-1.5'>
              <Label>
                {'提示词模板（可编辑，支持 {{name}} / {{level}} / {{description}}）'}
              </Label>
              <Textarea
                rows={4}
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                disabled={loadingDefaults}
              />
              <Button type='button' variant='outline' size='sm' onClick={applyTemplate}>
                用模板填充下方提示词
              </Button>
            </div>

            <div className='grid gap-1.5'>
              <Label>本次生成提示词</Label>
              <Textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loadingDefaults || generating}
                placeholder='描述封面风格与主题，请勿要求仿冒真实教材封面'
              />
            </div>

            <div className='grid gap-1.5'>
              <Label>尺寸</Label>
              <Input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder='1024x1024'
                disabled={generating}
              />
            </div>

            <div className='grid gap-1.5'>
              <Label>参考图（可选，用于风格参考）</Label>
              <div className='flex flex-wrap items-center gap-3'>
                <Button type='button' variant='outline' size='sm' asChild>
                  <label className='cursor-pointer'>
                    <Upload className='size-4' />
                    选择图片
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={(e) =>
                        onReferenceChange(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </Button>
                {referenceFile ? (
                  <span className='text-xs text-muted-foreground'>
                    {referenceFile.name}
                  </span>
                ) : null}
              </div>
              {referencePreview ? (
                <img
                  src={referencePreview}
                  alt='参考图'
                  className='mt-2 max-h-32 rounded-md border object-contain'
                />
              ) : null}
            </div>

            <div className='grid gap-1.5'>
              <Label>预览</Label>
              <div
                className='flex min-h-[160px] items-center justify-center rounded-lg border bg-muted/30 p-3'
              >
                {preview ? (
                  <img
                    src={preview}
                    alt='封面预览'
                    className='max-h-56 rounded-md object-contain shadow-sm'
                  />
                ) : (
                  <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                    <ImageIcon className='size-8 opacity-50' />
                    <span className='text-sm'>生成后显示预览</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className='gap-2 sm:gap-2 flex-wrap'>
          <Button
            type='button'
            variant='outline'
            disabled={testing || !configured}
            onClick={() => void runTest()}
          >
            {testing ? <Loader2 className='animate-spin' /> : null}
            测试接口
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={generating || !configured}
            onClick={() => void generate(false)}
          >
            {generating ? <Loader2 className='animate-spin' /> : null}
            仅预览
          </Button>
          <Button
            type='button'
            disabled={generating || !configured}
            onClick={() => void generate(true)}
          >
            {generating ? <Loader2 className='animate-spin' /> : null}
            生成并保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
