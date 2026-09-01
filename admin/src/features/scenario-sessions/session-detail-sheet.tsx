import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type ScenarioTurn = {
  id?: number
  role?: string
  content?: string
  turnIndex?: number
  hasCorrection?: boolean
}

export type ScenarioSessionRow = {
  id: number
  userId?: number
  username?: string
  email?: string
  scenarioId?: number
  scenarioName?: string
  status?: string
  startedAt?: string
  endedAt?: string
  durationSec?: number
  overallScore?: number
  fluencyScore?: number
  accuracyScore?: number
  pronunciationScore?: number
  turnCount?: number
  correctionCount?: number
  reviewSummary?: string
  turns?: ScenarioTurn[]
  scenario?: { name?: string; description?: string }
}

export function ScenarioSessionDetailSheet({
  open,
  onOpenChange,
  session,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: ScenarioSessionRow | null
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <SheetHeader className='shrink-0 space-y-1 border-b px-6 py-4 pe-12'>
          <SheetTitle className='text-left leading-snug'>
            训练记录 #{session?.id}
          </SheetTitle>
          <p className='text-sm text-muted-foreground text-left'>
            {session?.scenarioName || session?.scenario?.name || '—'} ·{' '}
            {session?.username || session?.email || session?.userId}
          </p>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-6 py-5'>
          <div className='space-y-6 text-sm'>
            <section className='space-y-2'>
              <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                评分概览
              </h4>
              <div className='grid grid-cols-2 gap-3 rounded-lg border px-4 py-3'>
                <div>
                  <Label className='text-muted-foreground text-xs'>综合分</Label>
                  <p className='mt-0.5'>{session?.overallScore ?? '—'}</p>
                </div>
                <div>
                  <Label className='text-muted-foreground text-xs'>状态</Label>
                  <p className='mt-0.5'>{session?.status || '—'}</p>
                </div>
                <div>
                  <Label className='text-muted-foreground text-xs'>流利度</Label>
                  <p className='mt-0.5'>{session?.fluencyScore ?? '—'}</p>
                </div>
                <div>
                  <Label className='text-muted-foreground text-xs'>准确度</Label>
                  <p className='mt-0.5'>{session?.accuracyScore ?? '—'}</p>
                </div>
                <div>
                  <Label className='text-muted-foreground text-xs'>发音</Label>
                  <p className='mt-0.5'>{session?.pronunciationScore ?? '—'}</p>
                </div>
                <div>
                  <Label className='text-muted-foreground text-xs'>纠错次数</Label>
                  <p className='mt-0.5'>{session?.correctionCount ?? '—'}</p>
                </div>
              </div>
            </section>

            {session?.reviewSummary ? (
              <section className='space-y-2'>
                <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  复盘摘要
                </h4>
                <p className='whitespace-pre-wrap rounded-lg border bg-muted/20 px-4 py-3 text-xs leading-relaxed'>
                  {session.reviewSummary}
                </p>
              </section>
            ) : null}

            {session?.turns && session.turns.length > 0 ? (
              <section className='space-y-3'>
                <h4 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  对话轮次（{session.turns.length}）
                </h4>
                <ul className='space-y-3'>
                  {session.turns.map((t, i) => (
                    <li key={t.id ?? i} className='rounded-lg border px-4 py-3'>
                      <div className='mb-2 flex items-center gap-2'>
                        <Badge variant={t.role === 'user' ? 'default' : 'secondary'}>
                          {t.role === 'user' ? '用户' : 'AI'}
                        </Badge>
                        {t.hasCorrection ? (
                          <Badge variant='outline'>含纠错</Badge>
                        ) : null}
                      </div>
                      <p className='whitespace-pre-wrap text-xs leading-relaxed'>
                        {t.content}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
