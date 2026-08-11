import { useState, useEffect } from 'react'
import { History, CheckCircle2, XCircle, AlertTriangle, Search, RefreshCw } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import Badge from '@/components/UI/Badge'
import EmptyState from '@/components/UI/EmptyState'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/UI/Select'
import { getLoginHistory, type LoginHistory } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'
import { cn } from '@/utils/cn'

const LoginHistoryPage = () => {
  const [histories, setHistories] = useState<LoginHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [successFilter, setSuccessFilter] = useState<string>('all')
  const [suspiciousFilter, setSuspiciousFilter] = useState<string>('all')

  const fetchHistory = async (nextPage = page) => {
    try {
      setLoading(true)
      const params: {
        page: number
        page_size: number
        search?: string
        success?: boolean
        is_suspicious?: boolean
      } = { page: nextPage, page_size: pageSize }
      if (search.trim()) params.search = search.trim()
      if (successFilter === 'true' || successFilter === 'false') {
        params.success = successFilter === 'true'
      }
      if (suspiciousFilter === 'true' || suspiciousFilter === 'false') {
        params.is_suspicious = suspiciousFilter === 'true'
      }

      const data = await getLoginHistory(params)
      setHistories(data.histories || [])
      setTotal(data.total || 0)
    } catch (error: any) {
      setHistories([])
      setTotal(0)
      showAlert('获取登录历史失败', 'error', error?.msg || error?.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, successFilter, suspiciousFilter])

  const onFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return Number.isNaN(date.getTime()) ? dateStr : date.toLocaleString('zh-CN')
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminLayout title="登录历史" description="查看登录历史记录">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="搜索邮箱、IP地址或位置..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={successFilter} onValueChange={onFilterChange(setSuccessFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="登录状态">
                  {successFilter === 'all'
                    ? '登录状态: 全部'
                    : successFilter === 'true'
                      ? '登录状态: 成功'
                      : '登录状态: 失败'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="true">成功</SelectItem>
                <SelectItem value="false">失败</SelectItem>
              </SelectContent>
            </Select>
            <Select value={suspiciousFilter} onValueChange={onFilterChange(setSuspiciousFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="可疑登录">
                  {suspiciousFilter === 'all'
                    ? '可疑登录: 全部'
                    : suspiciousFilter === 'true'
                      ? '可疑登录: 是'
                      : '可疑登录: 否'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="true">是</SelectItem>
                <SelectItem value="false">否</SelectItem>
              </SelectContent>
            </Select>
            <Button
              animation="none"
              variant="outline"
              onClick={() => fetchHistory(page)}
              disabled={loading}
              leftIcon={<RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />}
            >
              刷新
            </Button>
          </div>
        </Card>

        <Card>
          {loading && histories.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : histories.length === 0 ? (
            <EmptyState icon={History} title="暂无登录历史" description="还没有登录记录" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-sm">状态</th>
                    <th className="text-left p-4 font-medium text-sm">邮箱</th>
                    <th className="text-left p-4 font-medium text-sm">IP地址</th>
                    <th className="text-left p-4 font-medium text-sm">位置</th>
                    <th className="text-left p-4 font-medium text-sm">设备信息</th>
                    <th className="text-left p-4 font-medium text-sm">时间</th>
                    <th className="text-center p-4 font-medium text-sm">可疑</th>
                  </tr>
                </thead>
                <tbody>
                  {histories.map((history) => (
                    <tr
                      key={history.id}
                      className="border-b border-border hover:bg-accent/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {history.success ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <Badge variant={history.success ? 'success' : 'error'}>
                            {history.success ? '成功' : '失败'}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded-md">
                          {history.email || '-'}
                        </code>
                      </td>
                      <td className="p-4">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded-md">
                          {history.ipAddress || '-'}
                        </code>
                      </td>
                      <td className="p-4 text-sm">
                        <div>{history.location || '-'}</div>
                        <div className="text-muted-foreground text-xs">
                          {[history.country, history.city].filter(Boolean).join(', ') || '-'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div
                          className="text-sm text-muted-foreground max-w-xs truncate"
                          title={history.userAgent}
                        >
                          {history.userAgent || '-'}
                        </div>
                      </td>
                      <td className="p-4 text-sm">{formatDate(history.createdAt)}</td>
                      <td className="p-4 text-center">
                        {history.isSuspicious ? (
                          <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > pageSize && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                共 {total} 条，第 {page} / {totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  animation="none"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  上一页
                </Button>
                <Button
                  animation="none"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}

export default LoginHistoryPage
