import type { ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src='/logo.png'
      alt='CloudSteps'
      className={cn('size-6 rounded-md object-contain', className)}
      {...props}
    />
  )
}
