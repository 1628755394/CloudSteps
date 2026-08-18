import type { ReactNode } from 'react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export function AdminPage({
  title,
  description,
  extra,
  children,
}: {
  title: string
  description?: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center space-x-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
            {description ? (
              <p className='text-sm text-muted-foreground'>{description}</p>
            ) : null}
          </div>
          {extra}
        </div>
        {children}
      </Main>
    </>
  )
}
