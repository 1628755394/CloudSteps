import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatDateTime } from '@/lib/datetime'
import {
  appointmentTitle,
  formatScheduleDate,
  personLabel,
  slotLabel,
  statusBadge,
  type CoachingAppointment,
} from './appointment-display'

function minutes(n?: number) {
  return n == null ? '—' : `${n} 分钟`
}

function personBlock(
  label: string,
  person: CoachingAppointment['teacher'],
  id?: number
) {
  return (
    <div className='rounded-md border p-3'>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='mt-1 font-medium'>{personLabel(person, id)}</p>
      <p className='text-xs text-muted-foreground'>
        {[person?.username ? `@${person.username}` : '', id ? `#${id}` : '']
          .filter(Boolean)
          .join(' · ') || '—'}
      </p>
    </div>
  )
}

export function AppointmentDetailSheet({
  open,
  onOpenChange,
  appointment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: CoachingAppointment | null
}) {
  const badge = statusBadge(appointment?.status)
  const session = appointment?.session

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-xl'>
        <SheetHeader className='text-start'>
          <SheetTitle>陪练详情</SheetTitle>
          <SheetDescription>
            {appointment ? appointmentTitle(appointment) : '排课记录'}
          </SheetDescription>
        </SheetHeader>
        {appointment ? (
          <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              <span className='text-xs text-muted-foreground'>
                #{appointment.id}
              </span>
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div className='rounded-md border p-3'>
                <p className='text-xs text-muted-foreground'>日期</p>
                <p className='mt-1 font-medium'>
                  {formatScheduleDate(appointment.scheduledDate)}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-xs text-muted-foreground'>时段</p>
                <p className='mt-1 font-medium'>
                  {slotLabel(appointment.startTime, appointment.endTime)}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-xs text-muted-foreground'>计划时长</p>
                <p className='mt-1 font-medium'>
                  {minutes(appointment.durationMinutes)}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-xs text-muted-foreground'>实际上课</p>
                <p className='mt-1 font-medium'>
                  {formatDateTime(appointment.actualStartedAt)}
                </p>
              </div>
              {personBlock('老师', appointment.teacher, appointment.teacherId)}
              {personBlock('学员', appointment.student, appointment.studentId)}
            </div>
            {appointment.notes?.trim() ? (
              <div className='rounded-md border p-3'>
                <p className='text-xs text-muted-foreground'>备注</p>
                <p className='mt-1 whitespace-pre-wrap text-sm'>
                  {appointment.notes}
                </p>
              </div>
            ) : null}
            <div className='rounded-md border p-3 space-y-2'>
              <p className='text-xs text-muted-foreground'>课时结算</p>
              {session && session.id ? (
                <>
                  <div className='flex justify-between text-sm'>
                    <span>实际时长</span>
                    <span className='tabular-nums'>
                      {minutes(session.actualMinutes)}
                    </span>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span>学员扣减</span>
                    <span className='tabular-nums'>
                      {minutes(session.billedMinutes)}
                    </span>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span>计入老师</span>
                    <span className='tabular-nums'>
                      {minutes(session.teacherCreditedMinutes)}
                    </span>
                  </div>
                  <div className='flex justify-between border-t pt-2 text-xs text-muted-foreground'>
                    <span>开始 {formatDateTime(session.startedAt)}</span>
                    <span>结束 {formatDateTime(session.endedAt)}</span>
                  </div>
                </>
              ) : (
                <p className='text-sm text-muted-foreground'>尚未完课，暂无结算</p>
              )}
            </div>
          </div>
        ) : null}
        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
