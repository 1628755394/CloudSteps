import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Eye, Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import { get, post, put } from '@/lib/api'
import { applySampleVars } from '@/lib/template-preview'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { AdminPage } from '@/components/admin-page'
import { HtmlCodeEditor } from '@/components/html-code-editor'
import { MarkdownEditor } from '@/components/markdown-editor'
import { MarkdownView } from '@/components/markdown-view'
import { formatTemplateTrigger, getTemplateEventMeta } from './sig-events'
import { TestSendDialog } from './test-send-dialog'
import {
  channelTypeLabel,
  previewHtml,
  type NotificationTemplate,
  type NotificationTemplateType,
  type NotificationTemplateUpsertReq,
} from './types'

const empty: NotificationTemplateUpsertReq = {
  code: '',
  name: '',
  channelType: 'email',
  subject: '',
  htmlBody: '',
  inboxTitle: '',
  inboxBody: '',
  description: '',
  locale: '',
  enabled: true,
}

export function TemplateEditPage({ id }: { id?: string }) {
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NotificationTemplateUpsertReq>(empty)
  const [original, setOriginal] = useState<NotificationTemplate | null>(null)
  const [testOpen, setTestOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    get<NotificationTemplate>(`/admin/notification-templates/${id}`)
      .then((res) => {
        const tpl = res.data
        setOriginal(tpl)
        setForm({
          code: tpl.code,
          name: tpl.name,
          channelType: tpl.channelType,
          subject: tpl.subject,
          htmlBody: tpl.htmlBody,
          inboxTitle: tpl.inboxTitle,
          inboxBody: tpl.inboxBody,
          description: tpl.description,
          variables: tpl.variables,
          locale: tpl.locale,
          enabled: tpl.enabled,
        })
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : '读取模板失败')
      })
      .finally(() => setLoading(false))
  }, [id])

  const isEmail = (form.channelType ?? 'email') === 'email'
  const eventMeta = form.code ? getTemplateEventMeta(form.code) : undefined
  const previewSrcDoc = useMemo(
    () => previewHtml(form.htmlBody || ''),
    [form.htmlBody]
  )
  const inboxPreviewTitle = useMemo(
    () => applySampleVars(form.inboxTitle || '', eventMeta?.sampleVars),
    [form.inboxTitle, eventMeta?.sampleVars]
  )
  const inboxPreviewBody = useMemo(
    () => applySampleVars(form.inboxBody || '', eventMeta?.sampleVars),
    [form.inboxBody, eventMeta?.sampleVars]
  )

  const update = <K extends keyof NotificationTemplateUpsertReq>(
    key: K,
    value: NotificationTemplateUpsertReq[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error('请填写模板名称')
      return
    }
    if (!isEdit && !form.code?.trim()) {
      toast.error('请填写模板编码')
      return
    }
    if (isEmail && !form.htmlBody?.trim()) {
      toast.error('请填写 HTML 正文')
      return
    }
    if (!isEmail && (!form.inboxTitle?.trim() || !form.inboxBody?.trim())) {
      toast.error('请填写站内信标题和正文')
      return
    }
    setSaving(true)
    try {
      if (isEdit && id) {
        await put(`/admin/notification-templates/${id}`, form)
        toast.success('更新成功')
      } else {
        await post('/admin/notification-templates', form)
        toast.success('创建成功')
      }
      await navigate({ to: '/notification-templates' })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPage
      title={
        isEdit
          ? `编辑${channelTypeLabel(form.channelType)}模板：${original?.name || ''}`
          : '新建通知模板'
      }
      description='模板由 common.Sig 事件触发；邮件走渠道发送，站内信写入 inbox。'
      extra={
        <div className='flex gap-2'>
          <Button variant='outline' asChild>
            <Link to='/notification-templates'>
              <ArrowLeft className='size-4' />
              返回列表
            </Link>
          </Button>
          {isEdit && isEmail && form.code ? (
            <Button variant='outline' onClick={() => setTestOpen(true)}>
              <Send className='size-4' />
              测试邮件
            </Button>
          ) : null}
          <Button onClick={() => void save()} disabled={saving || loading}>
            <Save className='size-4' />
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className='text-sm text-muted-foreground'>加载中…</p>
      ) : (
        <div className='grid gap-4'>
          {form.code ? (
            <Card className='border-primary/30 bg-primary/5'>
              <CardHeader className='pb-2'>
                <CardTitle className='text-base'>触发方式</CardTitle>
              </CardHeader>
              <CardContent className='text-sm'>
                <p className='font-medium'>
                  {formatTemplateTrigger(form.code)}
                </p>
                {eventMeta?.trigger === 'sig' && eventMeta.sigEvent ? (
                  <p className='mt-2 text-xs text-muted-foreground'>
                    Sig 监听器会同时查找同 code 的{isEmail ? '邮件' : '站内信'}
                    模板并
                    {isEmail ? '走邮件渠道发送' : '写入用户 inbox'}。
                  </p>
                ) : eventMeta?.trigger === 'direct' ? (
                  <p className='mt-2 text-xs text-muted-foreground'>
                    此 code 由业务代码直接调用 Mailer，不经过 Sig 事件。
                  </p>
                ) : (
                  <p className='mt-2 text-xs text-amber-700 dark:text-amber-400'>
                    未在代码中登记触发关系，请确认 code 与监听器一致。
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
          <div className='grid gap-4 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle>模板内容</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4'>
                <Field label='类型' required>
                  <Select
                    value={form.channelType || 'email'}
                    disabled={isEdit}
                    onValueChange={(v) =>
                      update('channelType', v as NotificationTemplateType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='email'>邮件</SelectItem>
                      <SelectItem value='inbox'>站内信</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label='编码 code' required>
                  <Input
                    value={form.code || ''}
                    disabled={isEdit}
                    placeholder='例如：welcome、verification'
                    onChange={(e) => update('code', e.target.value)}
                  />
                </Field>
                <Field label='名称' required>
                  <Input
                    value={form.name}
                    placeholder='模板展示名'
                    onChange={(e) => update('name', e.target.value)}
                  />
                </Field>
                <Field label='语言（可选）'>
                  <Input
                    value={form.locale || ''}
                    placeholder='zh-CN / en-US'
                    onChange={(e) => update('locale', e.target.value)}
                  />
                </Field>
                {isEmail ? (
                  <>
                    <Field label='邮件主题 subject'>
                      <Input
                        value={form.subject || ''}
                        placeholder='支持 {{.Name}} 占位符'
                        onChange={(e) => update('subject', e.target.value)}
                      />
                    </Field>
                    <Field label='HTML 正文' required>
                      <HtmlCodeEditor
                        value={form.htmlBody || ''}
                        placeholder='<html>...</html>'
                        minHeight='480px'
                        onChange={(htmlBody) => update('htmlBody', htmlBody)}
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label='站内信标题' required>
                      <Input
                        value={form.inboxTitle || ''}
                        placeholder='支持 {{.Username}} 占位符'
                        onChange={(e) => update('inboxTitle', e.target.value)}
                      />
                    </Field>
                    <Field label='站内信正文（Markdown）' required>
                      <MarkdownEditor
                        value={form.inboxBody || ''}
                        placeholder='支持 Markdown 与 {{.Username}} 占位符'
                        minHeight='480px'
                        onChange={(inboxBody) => update('inboxBody', inboxBody)}
                      />
                    </Field>
                  </>
                )}
                <Field label='说明'>
                  <Input
                    value={form.description || ''}
                    placeholder='模板用途简介'
                    onChange={(e) => update('description', e.target.value)}
                  />
                </Field>
                <div className='flex items-center justify-between'>
                  <Label>启用</Label>
                  <Switch
                    checked={form.enabled !== false}
                    onCheckedChange={(enabled) => update('enabled', enabled)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className='overflow-hidden py-0'>
              <CardHeader className='px-6 pt-6'>
                <CardTitle className='inline-flex items-center gap-2'>
                  <Eye className='size-4' />
                  {isEmail ? 'HTML 预览' : '示例渲染预览'}
                </CardTitle>
              </CardHeader>
              <CardContent className='px-6 pb-6'>
                {isEmail ? (
                  <iframe
                    title='email-preview'
                    sandbox=''
                    className='h-[600px] w-full rounded-md border bg-white'
                    srcDoc={previewSrcDoc}
                  />
                ) : (
                  <div className='space-y-3 rounded-md border bg-muted/20 p-5'>
                    <p className='text-base font-semibold'>
                      {inboxPreviewTitle || '（标题）'}
                    </p>
                    <MarkdownView content={inboxPreviewBody} />
                    <p className='border-t pt-3 text-xs text-muted-foreground'>
                      预览使用示例变量填充 {'{{.Var}}'} 占位符；正文支持
                      Markdown。
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      <TestSendDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        defaultCode={form.code}
      />
    </AdminPage>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className='grid gap-1.5'>
      <Label>
        {label}
        {required ? <span className='ms-0.5 text-destructive'>*</span> : null}
      </Label>
      {children}
    </div>
  )
}
