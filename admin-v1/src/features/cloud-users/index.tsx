import { useEffect, useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { get } from '@/lib/api'
import { formatDateTime } from '@/lib/datetime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminPage } from '@/components/admin-page'
import { UserAvatar } from './user-avatar'
import { UserDetailSheet, type CloudUser } from './user-detail-sheet'
import { roleLabel, userDisplayName } from './user-display'

const ALL = 'all'

export function CloudUsersPage() {
  const [users, setUsers] = useState<CloudUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState(ALL)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<CloudUser | null>(null)
  const pageSize = 20

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await get<{ users: CloudUser[]; total: number }>('/users', {
        params: {
          page: nextPage,
          pageSize,
          search,
          role: role === ALL ? undefined : role,
          includeDeleted: includeDeleted ? '1' : undefined,
        },
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
  }, [page, role, includeDeleted])

  const openDetail = async (user: CloudUser) => {
    setDetail(user)
    try {
      const res = await get<CloudUser>(`/users/${user.id}`)
      setDetail({ ...user, ...res.data })
    } catch {
      // list row already has summary fields; keep it if detail fetch fails
    }
  }

  return (
    <AdminPage title='用户管理' description={`共 ${total} 人`}>
      <form
        className='mb-4 flex flex-wrap gap-2'
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
        <Select
          value={role}
          onValueChange={(value) => {
            setRole(value)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-36'>
            <SelectValue placeholder='角色' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部角色</SelectItem>
            <SelectItem value='admin'>管理员</SelectItem>
            <SelectItem value='teacher'>教师</SelectItem>
            <SelectItem value='student'>学员</SelectItem>
          </SelectContent>
        </Select>
        <Button type='submit' variant='secondary'>
          搜索
        </Button>
        <Button
          type='button'
          variant={includeDeleted ? 'default' : 'outline'}
          size='sm'
          onClick={() => {
            setIncludeDeleted((v) => !v)
            setPage(1)
          }}
        >
          {includeDeleted ? '✓ 含已注销' : '含已注销'}
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
              <TableHead>用户</TableHead>
              <TableHead>邮箱 / 账号</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>上次登录</TableHead>
              <TableHead className='w-24'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground'>
                  暂无用户
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className='flex items-center gap-3'>
                      <UserAvatar user={u} className='size-9' />
                      <div className='min-w-0'>
                        <p className='truncate font-medium'>
                          {userDisplayName(u)}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          ID {u.id}
                          {u.source ? ` · ${u.source}` : ''}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className='max-w-[220px] truncate'>
                      {u.email || '未绑定邮箱'}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {u.account || u.username || '—'}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {u.phone || '未绑定手机'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>{roleLabel(u.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.isDeleted ? (
                      <Badge variant='destructive'>已注销</Badge>
                    ) : (
                      <Badge
                        variant={
                          u.enabled === false ? 'destructive' : 'secondary'
                        }
                      >
                        {u.enabled === false ? '禁用' : '正常'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className='text-sm'>{formatDateTime(u.lastLogin)}</p>
                    <p className='text-xs text-muted-foreground'>
                      {u.loginCount ?? 0} 次
                      {u.lastLoginIP ? ` · ${u.lastLoginIP}` : ''}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => void openDetail(u)}
                    >
                      <Eye />
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
      <div className='mt-4 flex items-center justify-end gap-2 text-sm'>
        <Button
          variant='outline'
          size='sm'
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
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
      <UserDetailSheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
        user={detail}
        onDeleted={() => void load(1)}
      />
    </AdminPage>
  )
}
