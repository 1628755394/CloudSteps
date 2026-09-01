import { useEffect, useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type ScenarioRow = {
  id: number
  slug?: string
  name: string
  description?: string
  icon?: string
  difficulty?: string
  aiRole?: string
  prompt?: string
  enabled?: boolean
  sortOrder?: number
  userId?: number
  reviewStatus?: string
  rejectReason?: string
  isCustom?: boolean
}

const reviewLabel: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
}

const reviewVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

const difficultyLabel: Record<string, string> = {
  easy: '入门',
  medium: '进阶',
  hard: '挑战',
}

type ScenarioDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  scenario: ScenarioRow | null
  reviewing?: boolean
  onEdit?: (row: ScenarioRow) => void
  onApprove?: () => void
  onReject?: (reason: string) => void
}

export function ScenarioDetailSheet({
  open,
  onOpenChange,
  scenario,
  reviewing,
  onEdit,
  onApprove,
  onReject,
}: ScenarioDetailSheetProps) {
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    setRejectReason('')
  }, [scenario?.id])

  const showReview =
    scenario?.isCustom && scenario.reviewStatus === 'pending' && onApprove && onReject
  const canEdit = scenario && !scenario.isCustom && onEdit

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <SheetHeader className='shrink-0 space-y-1 border-b px-6 py-4 pe-12'>
          <div className='flex items-start justify-between gap-3'>
            <SheetTitle className='text-left leading-snug'>{scenario?.name || '场景详情'}</SheetTitle>
            {canEdit ? (
              <Button
                variant='outline'
                size='sm'
                className='shrink-0'
                onClick={() => {
                  onEdit(scenario)
                  onOpenChange(false)
                }}
              >
                <Pencil className='size-3.5' />
                编辑
              </Button>
            ) : null}
          </div>
          {scenario?.description ? (
            <p className='text-sm text-muted-foreground text-left'>{scenario.description}</p>
          ) : null}
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-6 py-5'>
          <div className='space-y-6 text-sm'>
            <div className='flex flex-wrap gap-2'>
              {scenario?.reviewStatus && scenario.isCustom && (
                <Badge variant={reviewVariant[scenario.reviewStatus] || 'outline'}>
                  {reviewLabel[scenario.reviewStatus] || scenario.reviewStatus}
                </Badge>
              )}
              {scenario?.difficulty && (
                <Badge variant='outline'>
                  {difficultyLabel[scenario.difficulty] || scenario.difficulty}
                </Badge>
              )}
              {scenario?.enabled != null && (
                <Badge variant={scenario.enabled ? 'default' : 'outline'}>
                  {scenario.enabled ? '已启用' : '未启用'}
                </Badge>
              )}
            </div>

            <section className='space-y-2'>
              <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                基本信息
              </h4>
              <div className='grid grid-cols-2 gap-3 rounded-lg border px-4 py-3'>
                <div>
                  <Label className='text-muted-foreground text-xs'>Slug</Label>
                  <p className='mt-0.5 break-all'>{scenario?.slug || '—'}</p>
                </div>
                <div>
                  <Label className='text-muted-foreground text-xs'>排序</Label>
                  <p className='mt-0.5'>{scenario?.sortOrder ?? '—'}</p>
                </div>
                <div>
                  <Label className='text-muted-foreground text-xs'>来源</Label>
                  <p className='mt-0.5'>{scenario?.isCustom ? `用户 #${scenario.userId}` : '系统预设'}</p>
                </div>
                <div>
                  <Label className='text-muted-foreground text-xs'>图标</Label>
                  <p className='mt-0.5'>{scenario?.icon || '—'}</p>
                </div>
                <div className='col-span-2'>
                  <Label className='text-muted-foreground text-xs'>AI 角色</Label>
                  <p className='mt-0.5 leading-relaxed'>{scenario?.aiRole || '—'}</p>
                </div>
              </div>
            </section>

            {scenario?.prompt ? (
              <section className='space-y-2'>
                <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  系统提示词
                </h4>
                <pre className='whitespace-pre-wrap rounded-lg border bg-muted/20 px-4 py-3 text-xs leading-relaxed font-mono'>
                  {scenario.prompt}
                </pre>
              </section>
            ) : null}

            {scenario?.rejectReason ? (
              <section className='space-y-2'>
                <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  拒绝原因
                </h4>
                <p className='rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive'>
                  {scenario.rejectReason}
                </p>
              </section>
            ) : null}

            {showReview ? (
              <section className='space-y-2'>
                <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  审核备注
                </h4>
                <Textarea
                  rows={3}
                  placeholder='拒绝时可填写原因，告知用户'
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </section>
            ) : null}
          </div>
        </div>

        {showReview ? (
          <SheetFooter className='shrink-0 gap-2 border-t px-6 py-4 sm:justify-end'>
            <Button
              variant='destructive'
              disabled={reviewing}
              onClick={() => onReject(rejectReason.trim())}
            >
              拒绝
            </Button>
            <Button disabled={reviewing} onClick={onApprove}>
              {reviewing ? <Loader2 className='size-4 animate-spin' /> : '通过审核'}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
