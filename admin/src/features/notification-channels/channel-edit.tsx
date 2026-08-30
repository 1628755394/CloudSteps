import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'sonner'
import { get, post, put } from '@/lib/api'
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
import {
  type EmailChannelForm,
  type NotificationChannel,
  type UpsertChannelReq,
} from './types'

const emptyForm = (): UpsertChannelReq => ({
  channelType: 'email',
  name: '',
  sortOrder: 0,
  enabled: true,
  remark: '',
  driver: 'smtp',
  smtpPort: 587,
})

export function ChannelEditPage({ id }: { id?: string }) {
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [form, setForm] = useState<UpsertChannelReq>(emptyForm())

  useEffect(() => {
    if (!id) return
    setLoading(true)
    get<{ channel: NotificationChannel; emailForm?: EmailChannelForm }>(
      `/admin/notification-channels/${id}`
    )
      .then((res) => {
        const channel = res.data.channel
        const email = res.data.emailForm
        setChannelName(channel.name)
        setForm({
          channelType: 'email',
          name: channel.name,
          sortOrder: channel.sortOrder,
          enabled: channel.enabled,
          remark: channel.remark || '',
          driver: email?.driver || 'smtp',
          smtpHost: email?.smtpHost,
          smtpPort: email?.smtpPort || 587,
          smtpUsername: email?.smtpUsername,
          smtpFrom: email?.smtpFrom,
          fromDisplayName: email?.fromDisplayName,
          sendcloudApiUser: email?.sendcloudApiUser,
          sendcloudFrom: email?.sendcloudFrom,
        })
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : '读取渠道失败')
      })
      .finally(() => setLoading(false))
  }, [id])

  const update = <K extends keyof UpsertChannelReq>(
    key: K,
    value: UpsertChannelReq[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('请填写渠道名称')
      return
    }
    setSaving(true)
    try {
      if (isEdit && id) {
        await put(`/admin/notification-channels/${id}`, form)
        toast.success('更新成功')
      } else {
        await post('/admin/notification-channels', form)
        toast.success('创建成功')
      }
      await navigate({ to: '/notification-channels' })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPage
      title={isEdit ? `编辑渠道：${channelName || ''}` : '新建邮件渠道'}
      description='配置发送供应商凭据。密钥留空表示保持原值。'
      extra={
        <div className='flex gap-2'>
          <Button variant='outline' asChild>
            <Link to='/notification-channels'>
              <ArrowLeft className='size-4' />
              返回列表
            </Link>
          </Button>
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
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
              <Field label='渠道名称' required>
                <Input
                  value={form.name}
                  placeholder='主邮箱 / 备用 SMTP'
                  onChange={(e) => update('name', e.target.value)}
                />
              </Field>
              <Field label='排序权重'>
                <Input
                  type='number'
                  value={form.sortOrder ?? 0}
                  onChange={(e) =>
                    update('sortOrder', Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field label='备注'>
                <Input
                  value={form.remark || ''}
                  onChange={(e) => update('remark', e.target.value)}
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

          <Card>
            <CardHeader>
              <CardTitle>邮件供应商配置</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
              <Field label='驱动'>
                <Select
                  value={form.driver || 'smtp'}
                  onValueChange={(driver: 'smtp' | 'sendcloud') =>
                    update('driver', driver)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='smtp'>SMTP</SelectItem>
                    <SelectItem value='sendcloud'>SendCloud</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label='发件人显示名'>
                <Input
                  value={form.fromDisplayName || ''}
                  onChange={(e) => update('fromDisplayName', e.target.value)}
                />
              </Field>
              {form.driver === 'sendcloud' ? (
                <>
                  <Field label='API User'>
                    <Input
                      value={form.sendcloudApiUser || ''}
                      onChange={(e) =>
                        update('sendcloudApiUser', e.target.value)
                      }
                    />
                  </Field>
                  <Field label={isEdit ? 'API Key（留空则保留）' : 'API Key'}>
                    <Input
                      type='password'
                      value={form.sendcloudApiKey || ''}
                      onChange={(e) =>
                        update('sendcloudApiKey', e.target.value)
                      }
                    />
                  </Field>
                  <Field label='发件地址'>
                    <Input
                      value={form.sendcloudFrom || ''}
                      onChange={(e) => update('sendcloudFrom', e.target.value)}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label='SMTP Host'>
                    <Input
                      value={form.smtpHost || ''}
                      onChange={(e) => update('smtpHost', e.target.value)}
                    />
                  </Field>
                  <Field label='SMTP Port'>
                    <Input
                      type='number'
                      value={form.smtpPort ?? 587}
                      onChange={(e) =>
                        update('smtpPort', Number(e.target.value) || 587)
                      }
                    />
                  </Field>
                  <Field label='SMTP 用户名'>
                    <Input
                      value={form.smtpUsername || ''}
                      onChange={(e) => update('smtpUsername', e.target.value)}
                    />
                  </Field>
                  <Field
                    label={isEdit ? 'SMTP 密码（留空则保留）' : 'SMTP 密码'}
                  >
                    <Input
                      type='password'
                      value={form.smtpPassword || ''}
                      onChange={(e) => update('smtpPassword', e.target.value)}
                    />
                  </Field>
                  <Field label='发件地址'>
                    <Input
                      value={form.smtpFrom || ''}
                      onChange={(e) => update('smtpFrom', e.target.value)}
                    />
                  </Field>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
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
