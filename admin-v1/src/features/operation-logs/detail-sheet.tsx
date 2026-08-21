import { formatDateTime } from '@/lib/datetime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  clientSummary,
  httpMethod,
  methodVariant,
  operationTitle,
  operatorLabel,
  type OperationLog,
} from './display'

export type { OperationLog }

type OperationLogDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  log: OperationLog | null
}

function DetailField({
  label,
  value,
}: {
  label: string
  value?: string | number | null
}) {
  const text =
    value === undefined || value === null || value === '' ? '—' : String(value)
  return (
    <div className='grid gap-1.5'>
      <Label>{label}</Label>
      <p className='text-sm break-all'>{text}</p>
    </div>
  )
}

export function OperationLogDetailSheet({
  open,
  onOpenChange,
  log,
}: OperationLogDetailSheetProps) {
  const method = log ? httpMethod(log) : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader className='text-start'>
          <SheetTitle>{log ? operationTitle(log) : '操作详情'}</SheetTitle>
          <SheetDescription>
            {log
              ? `${operatorLabel(log)} · ${formatDateTime(log.created_at)}`
              : '查看请求路径、客户端和来源。'}
          </SheetDescription>
        </SheetHeader>
        {log ? (
          <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-4'>
            <div className='flex flex-wrap items-center gap-1.5'>
              {method ? (
                <Badge variant={methodVariant(method)}>{method}</Badge>
              ) : null}
              <Badge variant='outline'>#{log.id}</Badge>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <DetailField label='操作人' value={operatorLabel(log)} />
              <DetailField label='用户 ID' value={log.user_id} />
              <DetailField label='动作说明' value={operationTitle(log)} />
              <DetailField label='HTTP 方法' value={method || '—'} />
              <DetailField label='请求路径' value={log.target} />
              <DetailField label='IP' value={log.ip_address} />
              <DetailField label='地理位置' value={log.location} />
              <DetailField label='客户端' value={clientSummary(log)} />
              <DetailField label='来源页' value={log.referer} />
              <DetailField
                label='操作时间'
                value={formatDateTime(log.created_at)}
              />
            </div>
            <DetailField label='User-Agent' value={log.user_agent} />
          </div>
        ) : null}
        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
