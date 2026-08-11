import { useState, useEffect } from 'react'
import { Search, FileText, Calendar, User, Globe, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import { getOperationLogs, type OperationLog } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

const METHOD_COLORS: Record<string, string> = {
  POST: 'bg-emerald-50 text-emerald-700',
  PUT: 'bg-sky-50 text-sky-700',
  PATCH: 'bg-amber-50 text-amber-700',
  DELETE: 'bg-red-50 text-red-700',
  GET: 'bg-muted text-muted-foreground',
}

const OperationLogs = () => {
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filters, setFilters] = useState({ user_id: '', action: '', target: '' })

  const fetchLogs = async (nextPage = page) => {
    try {
      setLoading(true)
      const params: Record<string, string | number> = { page: nextPage, page_size: pageSize }
      if (filters.user_id) params.user_id = parseInt(filters.user_id, 10)
      if (filters.action) params.action = filters.action
      if (filters.target) params.target = filters.target
      const data = await getOperationLogs(params as any)
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (error: any) {
      setLogs([])
      setTotal(0)
      showAlert('获取操作日志失败', 'error', error?.msg || error?.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleSearch = () => {
    if (page === 1) {
      fetchLogs(1)
    } else {
      setPage(1)
    }
  }

  const formatDate = (d: string) => {
    if (!d) return '-'
    const date = new Date(d)
    return Number.isNaN(date.getTime()) ? d : date.toLocaleString('zh-CN')
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminLayout title="操作日志" description="查看系统操作日志记录">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <Input
                placeholder="用户ID"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
              />
              <Input
                placeholder="操作类型"
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              />
              <Input
                placeholder="操作路径"
                value={filters.target}
                onChange={(e) => setFilters({ ...filters, target: e.target.value })}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button animation="none" onClick={handleSearch} leftIcon={<Search className="w-4 h-4" />}>
                搜索
              </Button>
              <Button
                animation="none"
                variant="outline"
                onClick={() => fetchLogs(page)}
                leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
              >
                刷新
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">暂无操作日志</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => {
                const isExpanded = expandedId === log.id
                return (
                  <div key={log.id} className="py-3 px-1">
                    <div
                      className="flex items-start gap-3 cursor-pointer hover:bg-accent/60 rounded-xl px-2 py-1.5 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <span
                        className={`mt-0.5 shrink-0 px-2 py-0.5 text-xs font-mono rounded-md font-semibold ${
                          METHOD_COLORS[log.request_method] || METHOD_COLORS.GET
                        }`}
                      >
                        {log.request_method || '-'}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm">
                            {log.details || log.action || '-'}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                            {log.target}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.username || '-'} #{log.user_id}
                          </span>
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {log.ip_address || '-'}
                          </span>
                          {log.location ? <span>{log.location}</span> : null}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                      </div>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-2 ml-12 mr-2 rounded-xl bg-muted/60 border border-border p-3 text-xs text-muted-foreground space-y-1">
                        <p>
                          <span className="text-foreground font-medium">UA：</span>
                          {log.user_agent || '-'}
                        </p>
                        <p>
                          <span className="text-foreground font-medium">设备：</span>
                          {[log.device, log.browser, log.operating_system].filter(Boolean).join(' / ') || '-'}
                        </p>
                        <p>
                          <span className="text-foreground font-medium">来源：</span>
                          {log.referer || '-'}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
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

export default OperationLogs
