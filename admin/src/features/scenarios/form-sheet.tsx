import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { post, put } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import type { ScenarioRow } from './detail-sheet'

const DIFFICULTIES = [
  { value: 'easy', label: '入门' },
  { value: 'medium', label: '进阶' },
  { value: 'hard', label: '挑战' },
] as const

export function ScenarioFormSheet({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ScenarioRow | null
  onSaved: () => void
}) {
  const isEdit = !!editing?.id

  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('message-circle')
  const [difficulty, setDifficulty] = useState('medium')
  const [aiRole, setAiRole] = useState('')
  const [prompt, setPrompt] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!editing) {
      setSlug('')
      setName('')
      setDescription('')
      setIcon('message-circle')
      setDifficulty('medium')
      setAiRole('')
      setPrompt('')
      setEnabled(true)
      setSortOrder(0)
      return
    }
    setSlug(editing.slug || '')
    setName(editing.name || '')
    setDescription(editing.description || '')
    setIcon(editing.icon || 'message-circle')
    setDifficulty(editing.difficulty || 'medium')
    setAiRole(editing.aiRole || '')
    setPrompt(editing.prompt || '')
    setEnabled(editing.enabled ?? true)
    setSortOrder(editing.sortOrder ?? 0)
  }, [open, editing])

  const handleSave = async () => {
    if (!name.trim() || !slug.trim() || !aiRole.trim()) {
      toast.error('请填写 Slug、名称和 AI 角色')
      return
    }
    setSaving(true)
    try {
      const body = {
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim(),
        icon: icon.trim() || 'message-circle',
        difficulty,
        aiRole: aiRole.trim(),
        prompt: prompt.trim(),
        enabled,
        sortOrder,
      }
      if (isEdit && editing?.id) {
        await put(`/admin/scenarios/${editing.id}`, body)
        toast.success('已更新')
      } else {
        await post('/admin/scenarios', body)
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
      <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl'>
        <SheetHeader className='shrink-0 space-y-1 border-b px-6 py-4 pe-12'>
          <SheetTitle className='text-left'>{isEdit ? '编辑场景' : '新增系统场景'}</SheetTitle>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-6 py-5 space-y-4'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder='restaurant'
                disabled={isEdit}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>排序</Label>
              <Input
                type='number'
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className='space-y-1.5'>
            <Label>描述</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className='resize-none'
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>难度</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>图标 (lucide)</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder='utensils' />
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>AI 角色</Label>
            <Input
              value={aiRole}
              onChange={(e) => setAiRole(e.target.value)}
              placeholder='a friendly restaurant waiter'
            />
          </div>

          <div className='space-y-1.5'>
            <Label>系统提示词</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              className='resize-y font-mono text-xs leading-relaxed'
              placeholder='Flow: greet → take order → ...'
            />
          </div>

          <div className='flex items-center justify-between rounded-lg border px-4 py-3'>
            <Label htmlFor='scenario-enabled'>启用</Label>
            <Switch id='scenario-enabled' checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <SheetFooter className='shrink-0 border-t px-6 py-4'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={saving} onClick={() => void handleSave()}>
            {saving ? <Loader2 className='size-4 animate-spin' /> : '保存'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
