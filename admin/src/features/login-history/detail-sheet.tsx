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
  loginPlace,
  loginResultLabel,
  loginTypeLabel,
  loginUserLabel,
  type LoginHistoryItem,
} from './display'

export type { LoginHistoryItem }

type LoginHistoryDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: LoginHistoryItem | null
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

export function LoginHistoryDetailSheet({
  open,
  onOpenChange,
  item,
}: LoginHistoryDetailSheetProps) {
  const ok = item?.success !== false

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader className='text-start'>
          <SheetTitle>{item ? loginUserLabel(item) : '登录详情'}</SheetTitle>
          <SheetDescription>
            {item
              ? formatDateTime(item.createdAt)
              : '查看登录结果、设备和地理位置。'}
          </SheetDescription>
        </SheetHeader>
        {item ? (
          <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-4'>
            <div className='flex flex-wrap items-center gap-1.5'>
              <Badge variant={ok ? 'secondary' : 'destructive'}>
                {loginResultLabel(item)}
              </Badge>
              {item.isSuspicious ? (
                <Badge variant='destructive'>可疑登录</Badge>
              ) : null}
              <Badge variant='outline'>{loginTypeLabel(item.loginType)}</Badge>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <DetailField label='记录 ID' value={item.id} />
              <DetailField label='用户 ID' value={item.userId} />
              <DetailField label='邮箱' value={item.email} />
              <DetailField
                label='登录方式'
                value={loginTypeLabel(item.loginType)}
              />
              <DetailField label='IP' value={item.ipAddress} />
              <DetailField label='地理位置' value={loginPlace(item)} />
              <DetailField label='国家' value={item.country} />
              <DetailField label='城市' value={item.city} />
              <DetailField label='设备 ID' value={item.deviceId} />
              <DetailField label='失败原因' value={item.failureReason} />
              <DetailField
                label='登录时间'
                value={formatDateTime(item.createdAt)}
              />
            </div>
            <DetailField label='User-Agent' value={item.userAgent} />
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
