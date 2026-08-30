import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { get } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  userDisplayName,
  type CloudUser,
} from '@/features/cloud-users/user-display'

type UserPickerProps = {
  value: string
  onChange: (userId: string, user?: CloudUser) => void
  disabled?: boolean
}

export function UserPicker({ value, onChange, disabled }: UserPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<CloudUser[]>([])
  const [selected, setSelected] = useState<CloudUser | null>(null)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const res = await get<{ users: CloudUser[] }>('/users', {
            params: {
              page: 1,
              pageSize: 30,
              search: query.trim() || undefined,
            },
          })
          setUsers(res.data.users || [])
        } catch {
          setUsers([])
        } finally {
          setLoading(false)
        }
      })()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [open, query])

  const label = useMemo(() => {
    if (selected && String(selected.id) === value) {
      return `${userDisplayName(selected)}（#${selected.id}）`
    }
    if (value) return `用户 #${value}`
    return '选择收件用户'
  }, [selected, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className='w-full justify-between font-normal'
        >
          <span className='truncate'>{label}</span>
          <ChevronsUpDown className='ms-2 size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-[var(--radix-popover-trigger-width)] p-0'
        align='start'
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='搜索用户名 / 显示名 / 邮箱…'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading ? (
              <div className='flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground'>
                <Loader2 className='size-4 animate-spin' />
                搜索中…
              </div>
            ) : (
              <>
                <CommandEmpty>没有匹配的用户</CommandEmpty>
                <CommandGroup>
                  {users.map((user) => {
                    const id = String(user.id)
                    const active = value === id
                    return (
                      <CommandItem
                        key={user.id}
                        value={id}
                        onSelect={() => {
                          setSelected(user)
                          onChange(id, user)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            'size-4',
                            active ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className='min-w-0 flex-1'>
                          <div className='truncate font-medium'>
                            {userDisplayName(user)}
                          </div>
                          <div className='truncate text-xs text-muted-foreground'>
                            #{user.id}
                            {user.username ? ` · ${user.username}` : ''}
                            {user.email ? ` · ${user.email}` : ''}
                          </div>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
