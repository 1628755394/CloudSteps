import { useEffect, useState } from 'react'
import { Check, Eye, Loader2, Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { get, post } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AdminPage } from '@/components/admin-page'
import { ScenarioDetailSheet, type ScenarioRow } from './detail-sheet'
import { ScenarioFormSheet } from './form-sheet'

type Tab = 'system' | 'custom' | 'pending'

const difficultyLabel: Record<string, string> = {
  easy: '入门',
  medium: '进阶',
  hard: '挑战',
}

export function ScenariosPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [list, setList] = useState<ScenarioRow[]>([])
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<ScenarioRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ScenarioRow | null>(null)
  const [reviewing, setReviewing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tab === 'system') {
        params.set('custom', '0')
      } else if (tab === 'custom') {
        params.set('custom', '1')
      } else {
        params.set('custom', '1')
        params.set('reviewStatus', 'pending')
      }
      const res = await get<ScenarioRow[]>(`/admin/scenarios?${params}`)
      setList(Array.isArray(res.data) ? res.data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const review = async (action: 'approve' | 'reject', reason = '') => {
    if (!detail) return
    setReviewing(true)
    try {
      await post(`/admin/scenarios/${detail.id}/review`, {
        action,
        rejectReason: reason,
      })
      toast.success(action === 'approve' ? '已通过审核' : '已拒绝')
      setDetail(null)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setReviewing(false)
    }
  }

  const quickReview = async (row: ScenarioRow, action: 'approve' | 'reject') => {
    setReviewing(true)
    try {
      await post(`/admin/scenarios/${row.id}/review`, { action })
      toast.success(action === 'approve' ? '已通过审核' : '已拒绝')
      if (detail?.id === row.id) setDetail(null)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setReviewing(false)
    }
  }

  const openEdit = (row: ScenarioRow) => {
    setEditing(row)
    setFormOpen(true)
  }

  return (
    <AdminPage
      title='场景对话管理'
      description={
        tab === 'pending'
          ? '审核用户提交的自定义场景，通过后用户方可使用'
          : tab === 'custom'
            ? '用户自定义场景'
            : '系统预设场景，可编辑名称、提示词与启用状态'
      }
      extra={
        tab === 'system' ? (
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus />
            新增场景
          </Button>
        ) : undefined
      }
    >
      <div className='mb-4 flex flex-wrap gap-2'>
        {(
          [
            ['pending', '待审核'],
            ['custom', '用户自定义'],
            ['system', '系统预设'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size='sm'
            variant={tab === key ? 'default' : 'outline'}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          加载中…
        </div>
      ) : list.length === 0 ? (
        <p className='text-sm text-muted-foreground'>暂无数据</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>难度</TableHead>
              <TableHead>AI 角色</TableHead>
              {tab !== 'system' && <TableHead>用户 ID</TableHead>}
              {tab !== 'system' && <TableHead>审核状态</TableHead>}
              <TableHead>启用</TableHead>
              <TableHead className='w-40'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((row) => (
              <TableRow key={row.id}>
                <TableCell className='max-w-[180px] truncate font-medium'>
                  {row.name}
                </TableCell>
                <TableCell>
                  {difficultyLabel[row.difficulty || ''] || row.difficulty || '—'}
                </TableCell>
                <TableCell className='max-w-[140px] truncate'>
                  {row.aiRole || '—'}
                </TableCell>
                {tab !== 'system' && (
                  <TableCell>{row.userId ?? '—'}</TableCell>
                )}
                {tab !== 'system' && (
                  <TableCell>
                    <Badge
                      variant={
                        row.reviewStatus === 'approved'
                          ? 'default'
                          : row.reviewStatus === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {row.reviewStatus === 'approved'
                        ? '已通过'
                        : row.reviewStatus === 'rejected'
                          ? '已拒绝'
                          : '待审核'}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>{row.enabled ? '是' : '否'}</TableCell>
                <TableCell>
                  <div className='flex gap-1'>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => setDetail(row)}
                      title='预览'
                    >
                      <Eye />
                    </Button>
                    {tab === 'system' && (
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => openEdit(row)}
                        title='编辑'
                      >
                        <Pencil />
                      </Button>
                    )}
                    {row.reviewStatus === 'pending' && row.isCustom && (
                      <>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='text-green-600'
                          disabled={reviewing}
                          onClick={() => void quickReview(row, 'approve')}
                        >
                          <Check />
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='text-destructive'
                          disabled={reviewing}
                          onClick={() => void quickReview(row, 'reject')}
                        >
                          <X />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ScenarioDetailSheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
        scenario={detail}
        reviewing={reviewing}
        onEdit={detail && !detail.isCustom ? openEdit : undefined}
        onApprove={
          detail?.reviewStatus === 'pending'
            ? () => void review('approve')
            : undefined
        }
        onReject={
          detail?.reviewStatus === 'pending'
            ? (reason) => void review('reject', reason)
            : undefined
        }
      />

      <ScenarioFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => void load()}
      />
    </AdminPage>
  )
}
