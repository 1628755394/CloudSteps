import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { get, post } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from '@/components/ui/textarea'
import { defaultVarsJSON, getTemplateEventMeta } from './sig-events'
import { type NotificationTemplate } from './types'

type TestSendDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Prefer matching an email template by code. */
  defaultCode?: string
}

export function TestSendDialog({
  open,
  onOpenChange,
  defaultCode,
}: TestSendDialogProps) {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [to, setTo] = useState('')
  const [mode, setMode] = useState<'template' | 'text'>('template')
  const [selectedId, setSelectedId] = useState('')
  const [varsText, setVarsText] = useState('{}')
  const [subject, setSubject] = useState('CloudSteps 测试邮件')
  const [body, setBody] = useState('这是一封测试邮件。')
  const [sending, setSending] = useState(false)

  const selected = useMemo(
    () => templates.find((t) => String(t.id) === selectedId),
    [templates, selectedId]
  )

  useEffect(() => {
    if (!open) return
    setMode('template')
    get<{ list: NotificationTemplate[] }>('/admin/notification-templates', {
      params: { page: 1, pageSize: 100, channelType: 'email' },
    })
      .then((res) => {
        const list = (res.data.list || []).filter(
          (t) => t.channelType === 'email'
        )
        setTemplates(list)
        const byCode = defaultCode
          ? list.find((t) => t.code === defaultCode)
          : undefined
        const pick = byCode ?? list[0]
        if (pick) {
          setSelectedId(String(pick.id))
          setVarsText(defaultVarsJSON(pick.code))
        } else {
          setSelectedId('')
          setVarsText('{}')
        }
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : '加载邮件模板失败')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCode])

  useEffect(() => {
    if (!open || !selected?.code) return
    setVarsText(defaultVarsJSON(selected.code))
  }, [open, selected?.code, selected?.id])

  const send = async () => {
    let vars: Record<string, unknown> | undefined
    if (mode === 'template' && varsText.trim()) {
      try {
        vars = JSON.parse(varsText) as Record<string, unknown>
      } catch {
        toast.error('模板变量必须是合法 JSON 对象')
        return
      }
    }
    if (mode === 'template' && !selected?.code) {
      toast.error('请选择邮件模板')
      return
    }
    setSending(true)
    try {
      await post('/admin/mail/test', {
        to,
        mode,
        code: mode === 'template' ? selected?.code : undefined,
        vars: mode === 'template' ? vars : undefined,
        subject: mode === 'text' ? subject : undefined,
        body: mode === 'text' ? body : undefined,
      })
      toast.success(`已发送到 ${to}`)
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '测试发送失败')
    } finally {
      setSending(false)
    }
  }

  const triggerHint = selected?.code
    ? getTemplateEventMeta(selected.code)
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>测试发送邮件</DialogTitle>
          <DialogDescription>
            仅测试<strong>邮件</strong>模板，走当前已启用的邮件渠道。站内信由
            Sig 触发后写入 inbox，不支持在此对话框测试。
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-1.5'>
            <Label>收件邮箱</Label>
            <Input
              type='email'
              value={to}
              placeholder='you@example.com'
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>内容</Label>
            <Select
              value={mode}
              onValueChange={(value: 'template' | 'text') => setMode(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='template'>邮件模板</SelectItem>
                <SelectItem value='text'>纯文本</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === 'template' ? (
            <>
              <div className='grid gap-1.5'>
                <Label>邮件模板</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder='选择模板' />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value='__empty' disabled>
                        暂无邮件模板
                      </SelectItem>
                    ) : (
                      templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={String(tpl.id)}>
                          {tpl.code} · {tpl.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {triggerHint ? (
                  <p className='text-xs text-muted-foreground'>
                    线上触发：
                    {triggerHint.trigger === 'sig' && triggerHint.sigEvent
                      ? ` common.Sig · ${triggerHint.sigEvent}`
                      : ` ${triggerHint.directNote}`}
                  </p>
                ) : null}
              </div>
              <div className='grid gap-1.5'>
                <Label>变量 JSON（可选）</Label>
                <Textarea
                  className='min-h-24 font-mono text-xs'
                  value={varsText}
                  placeholder='{"Username":"测试","Code":"123456"}'
                  onChange={(e) => setVarsText(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className='grid gap-1.5'>
                <Label>标题</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>正文</Label>
                <Textarea
                  className='min-h-32'
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => void send()}
            disabled={
              sending ||
              !to.trim() ||
              (mode === 'template' && (!selectedId || templates.length === 0))
            }
          >
            {sending ? '发送中…' : '发送'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
