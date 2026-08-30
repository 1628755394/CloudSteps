import { Separator } from '@/components/ui/separator'

type ContentSectionProps = {
  title: string
  desc: string
  children: React.JSX.Element
  wide?: boolean
}

export function ContentSection({
  title,
  desc,
  children,
  wide,
}: ContentSectionProps) {
  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='flex-none'>
        <h3 className='text-lg font-medium'>{title}</h3>
        <p className='text-sm text-muted-foreground'>{desc}</p>
      </div>
      <Separator className='my-4 flex-none' />
      <div className='faded-bottom relative min-h-0 w-full flex-1 overflow-y-auto scroll-smooth pe-4 pb-32'>
        <div className={wide ? 'w-full px-1.5' : '-mx-1 px-1.5 lg:max-w-xl'}>
          {children}
        </div>
      </div>
    </div>
  )
}
