import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from '@/assets/logo'
import { Button } from '@/components/ui/button'

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: ReactNode
}) {
  return (
    <div className='min-h-svh bg-background'>
      <header className='border-b'>
        <div className='mx-auto flex h-14 max-w-3xl items-center justify-between px-4'>
          <Link to='/sign-in' className='flex items-center gap-2'>
            <Logo className='size-7' />
            <span className='font-medium'>CloudSteps</span>
          </Link>
          <Button asChild variant='ghost' size='sm'>
            <Link to='/sign-in'>Back to Sign in</Link>
          </Button>
        </div>
      </header>
      <main className='mx-auto max-w-3xl px-4 py-10'>
        <h1 className='text-2xl font-semibold tracking-tight'>{title}</h1>
        <p className='mt-1 text-sm text-muted-foreground'>{updatedAt}</p>
        <div className='mt-8 space-y-6 text-sm leading-relaxed'>{children}</div>
      </main>
    </div>
  )
}
