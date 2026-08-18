import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { get } from '@/lib/api'
import { AdminPage } from '@/components/admin-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type User = {
  id: number
  email: string
  displayName?: string
  role?: string
  enabled?: boolean
  isStaff?: boolean
  createdAt?: string
}

export function CloudUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await get<{ users: User[]; total: number }>('/users', {
        params: { page: nextPage, pageSize, search },
      })
      setUsers(res.data.users || [])
      setTotal(res.data.total || 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载用户失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  return (
    <AdminPage title='用户管理' description={`共 ${total} 人`}>
      <form
        className='mb-4 flex gap-2'
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          void load(1)
        }}
      >
        <Input
          className='max-w-xs'
          placeholder='搜索邮箱 / 昵称'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type='submit' variant='secondary'>
          搜索
        </Button>
      </form>
      {loading ? (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          加载中…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>昵称</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.id}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.displayName || '—'}</TableCell>
                <TableCell>
                  <Badge variant='outline'>{u.role || 'user'}</Badge>
                </TableCell>
                <TableCell>{u.enabled === false ? '禁用' : '正常'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className='mt-4 flex items-center justify-end gap-2 text-sm'>
        <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          上一页
        </Button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <Button
          variant='outline'
          size='sm'
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </Button>
      </div>
    </AdminPage>
  )
}
