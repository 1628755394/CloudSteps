import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import Badge from '@/components/UI/Badge'
import EmptyState from '@/components/UI/EmptyState'
import Modal, { ModalFooter } from '@/components/UI/Modal'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import Pagination from '@/components/UI/Pagination'
import Switch from '@/components/UI/Switch'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/UI/Select'
import { get, post, put, del } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'
import { showAlert } from '@/utils/notification'
import { cn } from '@/utils/cn'
import {
  Plus, Pencil, Trash2, Search, Upload, X, Library, RefreshCw, Wand2, VolumeX, Loader2, BookOpen,
} from 'lucide-react'

interface WordBook {
  id: number
  name: string
  description: string
  level: string
  wordCount: number
  coverUrl: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  examTags?: string
  cefrRange?: string
  regionalVariant?: string
  sourceName?: string
  sourceUrl?: string
  licenseNote?: string
}

const LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

type ActiveFilter = '' | 'true' | 'false'

type ListFilters = {
  page: number
  keyword: string
  isActive: ActiveFilter
  group: string
  sourceName: string
}

type WordBookGroup = { key: string; label: string }

const DEFAULT_GROUPS: WordBookGroup[] = [
  { key: '', label: '全部分类' },
  { key: 'primary', label: '小学' },
  { key: 'middle', label: '初中' },
  { key: 'high', label: '高中' },
  { key: 'cet4', label: '大学四级' },
  { key: 'cet6', label: '大学六级' },
  { key: 'kaoyan', label: '考研' },
  { key: 'abroad', label: '留学考试' },
  { key: 'tem', label: '专四专八' },
  { key: 'textbook', label: '教材' },
]

const textareaClass = cn(
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none',
)

function parseListFilters(params: URLSearchParams): ListFilters {
  const pageRaw = parseInt(params.get('page') || '1', 10)
  const isActive = params.get('isActive')
  return {
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    keyword: params.get('keyword') || '',
    isActive: isActive === 'true' || isActive === 'false' ? isActive : '',
    group: params.get('group') || '',
    sourceName: params.get('sourceName') || '',
  }
}

function filtersToSearchParams(filters: ListFilters): URLSearchParams {
  const next = new URLSearchParams()
  if (filters.page > 1) next.set('page', String(filters.page))
  if (filters.keyword.trim()) next.set('keyword', filters.keyword.trim())
  if (filters.isActive) next.set('isActive', filters.isActive)
  if (filters.group) next.set('group', filters.group)
  if (filters.sourceName) next.set('sourceName', filters.sourceName)
  return next
}

function hasActiveFilters(filters: ListFilters): boolean {
  return !!(filters.keyword.trim() || filters.isActive || filters.group || filters.sourceName)
}

function filtersKey(filters: ListFilters): string {
  return [
    filters.page,
    filters.keyword.trim(),
    filters.isActive,
    filters.group,
    filters.sourceName,
  ].join('\0')
}

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
]

function coverGradient(name: string) {
  const idx = name.charCodeAt(0) % GRADIENTS.length
  return GRADIENTS[idx]
}

const emptyForm = {
  name: '', description: '', level: '', coverUrl: '', isActive: true, sortOrder: 0,
  examTags: '', cefrRange: '', regionalVariant: '', sourceName: '', sourceUrl: '', licenseNote: '',
}

type AudioJobKind = 'batch' | 'purge'
type AudioJob = {
  kind: AudioJobKind
  status: string
  processed: number
  total: number
  success?: number
  queuePosition?: number
}

function isBatchAudioActive(status?: string) {
  return status === 'running' || status === 'queued'
}

function isPurgeAudioActive(status?: string) {
  return status === 'running' || status === 'queued'
}

export default function WordBooks() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseListFilters(searchParams), [searchParams])
  const filterKey = useMemo(() => filtersKey(filters), [filters])
  const [books, setBooks] = useState<WordBook[]>([])
  const [total, setTotal] = useState(0)
  const [groups, setGroups] = useState<WordBookGroup[]>(DEFAULT_GROUPS)
  const [sources, setSources] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [publishingId, setPublishingId] = useState<number | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<WordBook | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [audioJobs, setAudioJobs] = useState<Record<number, AudioJob>>({})
  const [deleteTarget, setDeleteTarget] = useState<WordBook | null>(null)
  const [deleting, setDeleting] = useState(false)
  const booksRef = useRef(books)
  booksRef.current = books

  const pageSize = 20

  const patchFilters = useCallback((patch: Partial<ListFilters>, opts?: { resetPage?: boolean }) => {
    const next: ListFilters = { ...filters, ...patch }
    if (opts?.resetPage !== false && !('page' in patch)) {
      next.page = 1
    }
    const nextParams = filtersToSearchParams(next)
    if (nextParams.toString() === searchParams.toString()) return
    setSearchParams(nextParams, { replace: true })
  }, [filters, searchParams, setSearchParams])

  const clearFilters = useCallback(() => {
    if (!searchParams.toString()) return
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(pageSize),
        keyword: filters.keyword,
      })
      if (filters.isActive) params.set('isActive', filters.isActive)
      if (filters.group) params.set('group', filters.group)
      if (filters.sourceName) params.set('sourceName', filters.sourceName)
      const res = await get<any>(`${getApiBaseURL()}/wordbooks/list?${params}`)
      if (res.code === 200) {
        setBooks(res.data.list || [])
        setTotal(res.data.total || 0)
        if (Array.isArray(res.data.groups) && res.data.groups.length > 0) {
          setGroups(res.data.groups)
        }
        if (Array.isArray(res.data.sources)) {
          setSources(res.data.sources)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps -- filterKey serializes filters

  useEffect(() => { void load() }, [load])

  const setBookJob = (bookId: number, job: AudioJob | null) => {
    setAudioJobs((prev) => {
      if (!job) {
        if (!(bookId in prev)) return prev
        const next = { ...prev }
        delete next[bookId]
        return next
      }
      const prevJob = prev[bookId]
      if (
        prevJob &&
        prevJob.kind === job.kind &&
        prevJob.status === job.status &&
        prevJob.processed === job.processed &&
        prevJob.total === job.total &&
        prevJob.success === job.success &&
        prevJob.queuePosition === job.queuePosition
      ) {
        return prev
      }
      return { ...prev, [bookId]: job }
    })
  }

  // 列表页只轮询一次总览接口，避免对每本书打 batch-audio 把页面打爆
  useEffect(() => {
    let stopped = false
    let knownActive = new Set<number>()

    const tick = async () => {
      try {
        const res = await get<{
          jobs?: Array<{
            bookId?: number
            status?: string
            processed?: number
            total?: number
            success?: number
            error?: string
            queuePosition?: number
          }>
        }>(`${getApiBaseURL()}/wordbooks/batch-audio/jobs`)
        if (stopped || res.code !== 200) return

        const jobs = res.data?.jobs || []
        const nextActive = new Set<number>()
        const finished: number[] = []

        setAudioJobs((prev) => {
          let changed = false
          const next: Record<number, AudioJob> = { ...prev }

          for (const [idStr, job] of Object.entries(next)) {
            const id = Number(idStr)
            if (job.kind !== 'batch') continue
            const still = jobs.some((j) => Number(j.bookId) === id && isBatchAudioActive(j.status))
            if (!still) {
              if (knownActive.has(id)) finished.push(id)
              delete next[id]
              changed = true
            }
          }

          for (const j of jobs) {
            const bookId = Number(j.bookId)
            if (!Number.isFinite(bookId) || !isBatchAudioActive(j.status)) continue
            nextActive.add(bookId)
            const job: AudioJob = {
              kind: 'batch',
              status: j.status || 'running',
              processed: j.processed ?? 0,
              total: j.total ?? 0,
              success: j.success,
              queuePosition: j.queuePosition,
            }
            const prevJob = next[bookId]
            if (
              !prevJob ||
              prevJob.kind !== job.kind ||
              prevJob.status !== job.status ||
              prevJob.processed !== job.processed ||
              prevJob.total !== job.total ||
              prevJob.queuePosition !== job.queuePosition
            ) {
              next[bookId] = job
              changed = true
            }
          }

          return changed ? next : prev
        })

        for (const bookId of finished) {
          const bookName = booksRef.current.find((b) => b.id === bookId)?.name || `词库 #${bookId}`
          try {
            const one = await get<{
              status?: string
              processed?: number
              total?: number
              success?: number
              error?: string
            }>(`${getApiBaseURL()}/wordbooks/${bookId}/words/batch-audio`)
            if (stopped) return
            const status = one.data?.status || 'idle'
            if (status === 'failed') showAlert(`${bookName}：${one.data?.error || '批量生成失败'}`, 'error')
            else if (status === 'stopped') {
              showAlert(`${bookName}：已停止，成功 ${one.data?.success ?? 0}/${one.data?.processed ?? 0}`, 'info')
            } else if (status === 'done') {
              const totalN = one.data?.total ?? 0
              const success = one.data?.success ?? 0
              showAlert(totalN === 0 ? `${bookName}：所有单词已有音频` : `${bookName}：生成完成 ${success}/${totalN}`, 'success')
            }
          } catch {
            // ignore
          }
        }

        knownActive = nextActive
      } catch {
        // keep polling
      }
    }

    void tick()
    const timer = window.setInterval(() => { void tick() }, 2000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [])

  // 清除音频任务仍按单书状态轮询（数量很少，仅用户主动触发的那些）
  const purgeJobKey = useMemo(
    () => Object.entries(audioJobs)
      .filter(([, job]) => job.kind === 'purge' && isPurgeAudioActive(job.status))
      .map(([id]) => id)
      .sort()
      .join(','),
    [audioJobs],
  )

  useEffect(() => {
    if (!purgeJobKey) return
    const purgeIds = purgeJobKey.split(',').map(Number)

    let stopped = false
    const tick = async () => {
      for (const bookId of purgeIds) {
        if (stopped) return
        try {
          const res = await get<{
            status?: string
            processed?: number
            total?: number
            cleared?: number
            objectsFailed?: number
            error?: string
            queuePosition?: number
          }>(`${getApiBaseURL()}/wordbooks/${bookId}/words/purge-all-audio`)
          if (res.code !== 200) continue
          const status = res.data?.status || 'idle'
          if (isPurgeAudioActive(status)) {
            setBookJob(bookId, {
              kind: 'purge',
              status,
              processed: res.data?.processed ?? 0,
              total: res.data?.total ?? 0,
              queuePosition: res.data?.queuePosition,
            })
            continue
          }
          setBookJob(bookId, null)
          const bookName = booksRef.current.find((b) => b.id === bookId)?.name || `词库 #${bookId}`
          if (status === 'failed') showAlert(`${bookName}：${res.data?.error || '清除失败'}`, 'error')
          else if (status === 'done') {
            const cleared = res.data?.cleared ?? 0
            const failed = res.data?.objectsFailed ?? 0
            showAlert(
              cleared > 0 ? `${bookName}：已清除 ${cleared} 条音频` : `${bookName}：没有需要清除的音频`,
              failed > 0 ? 'warning' : 'success'
            )
          }
        } catch {
          // keep polling
        }
      }
    }
    void tick()
    const timer = window.setInterval(() => { void tick() }, 2000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [purgeJobKey])

  const handleBatchAudio = async (b: WordBook) => {
    const job = audioJobs[b.id]
    if (job?.kind === 'purge' && isPurgeAudioActive(job.status)) return
    if (job?.kind === 'batch' && isBatchAudioActive(job.status)) {
      try {
        await post(`${getApiBaseURL()}/wordbooks/${b.id}/words/batch-audio/stop`)
        showAlert(`「${b.name}」已请求停止`, 'info')
      } catch (e: any) {
        showAlert(e?.msg || e?.message || '停止失败', 'error')
      }
      return
    }

    try {
      const res = await post<{
        status?: string
        started?: boolean
        total?: number
        processed?: number
        success?: number
        queuePosition?: number
      }>(`${getApiBaseURL()}/wordbooks/${b.id}/words/batch-audio`)
      if (res.code !== 200) {
        showAlert(res.msg || '启动失败', 'error')
        return
      }
      if (res.data?.started === false && (res.data?.total ?? 0) === 0) {
        showAlert(`「${b.name}」所有单词已有音频`, 'success')
        return
      }
      const status = res.data?.status || 'queued'
      setBookJob(b.id, {
        kind: 'batch',
        status: isBatchAudioActive(status) ? status : 'queued',
        processed: res.data?.processed ?? 0,
        total: res.data?.total ?? 0,
        success: res.data?.success,
        queuePosition: res.data?.queuePosition,
      })
      showAlert(res.msg || `「${b.name}」已加入生成队列`, 'info')
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '启动失败', 'error')
    }
  }

  const runPurgeAllAudio = async (b: WordBook) => {
    const job = audioJobs[b.id]
    if (job?.kind === 'purge' && isPurgeAudioActive(job.status)) return
    try {
      const res = await post<{
        status?: string
        started?: boolean
        total?: number
        processed?: number
        queuePosition?: number
      }>(`${getApiBaseURL()}/wordbooks/${b.id}/words/purge-all-audio`)
      if (res.code !== 200) {
        showAlert(res.msg || '启动清除失败', 'error')
        return
      }
      if (res.data?.status === 'done' && (res.data?.total ?? 0) === 0) {
        showAlert(`「${b.name}」没有需要清除的音频`, 'info')
        return
      }
      const status = res.data?.status || 'queued'
      setBookJob(b.id, {
        kind: 'purge',
        status: isPurgeAudioActive(status) ? status : 'queued',
        processed: res.data?.processed ?? 0,
        total: res.data?.total ?? 0,
        queuePosition: res.data?.queuePosition,
      })
      showAlert(res.msg || `「${b.name}」已加入清除队列`, 'info')
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '启动清除失败', 'error')
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (b: WordBook) => {
    setEditing(b)
    setForm({
      name: b.name, description: b.description, level: b.level, coverUrl: b.coverUrl, isActive: b.isActive, sortOrder: b.sortOrder,
      examTags: b.examTags || '', cefrRange: b.cefrRange || '', regionalVariant: b.regionalVariant || '',
      sourceName: b.sourceName || '', sourceUrl: b.sourceUrl || '', licenseNote: b.licenseNote || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { showAlert('请填写词库名称', 'error'); return }
    setSaving(true)
    try {
      if (editing) {
        await put(`${getApiBaseURL()}/wordbooks/${editing.id}`, form)
        showAlert('更新成功', 'success')
      } else {
        await post(`${getApiBaseURL()}/wordbooks`, form)
        showAlert('创建成功', 'success')
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      showAlert(e?.message || '操作失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (b: WordBook) => {
    setDeleteTarget(b)
  }

  const confirmDelete = async () => {
    const b = deleteTarget
    if (!b || deleting) return
    setDeleting(true)
    try {
      await del(`${getApiBaseURL()}/wordbooks/${b.id}`)
      showAlert('删除成功', 'success')
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      showAlert(e?.message || '删除失败', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handlePublish = async (b: WordBook) => {
    if (publishingId === b.id) return
    setPublishingId(b.id)
    try {
      const res = await put<any>(`${getApiBaseURL()}/wordbooks/${b.id}`, { isActive: true })
      if (res.code !== 200) {
        showAlert(res.msg || '上架失败', 'error')
        return
      }
      showAlert(`「${b.name}」已上架`, 'success')
      if (filters.isActive === 'false') {
        load()
      } else {
        setBooks((prev) => prev.map((item) => (
          item.id === b.id ? { ...item, isActive: true } : item
        )))
      }
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '上架失败', 'error')
    } finally {
      setPublishingId(null)
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setCoverUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${getApiBaseURL()}/system/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.code === 200) {
        setForm(f => ({ ...f, coverUrl: data.data.url }))
      } else {
        showAlert(data.msg || '上传失败', 'error')
      }
    } catch {
      showAlert('上传失败', 'error')
    } finally {
      setCoverUploading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 筛选工具栏：提高层级，避免下拉被下方卡片的 transform 叠层盖住 */}
        <Card className="relative z-20" animation="none">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground">词库管理</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {loading && books.length === 0 ? '加载中…' : `共 ${total.toLocaleString()} 个词库`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => load()}
                  leftIcon={<RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />}
                >
                  刷新
                </Button>
                <Button variant="primary" size="sm" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
                  新建词库
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="搜索词库名称..."
                value={filters.keyword}
                onValueChange={(v) => patchFilters({ keyword: v })}
                className="w-full sm:w-64"
                size="sm"
                leftIcon={<Search className="w-4 h-4" />}
                clearable
                onClear={() => patchFilters({ keyword: '' })}
              />

              <Select value={filters.isActive} onValueChange={(v) => patchFilters({ isActive: v as ActiveFilter })}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="上架状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  <SelectItem value="true">已上架</SelectItem>
                  <SelectItem value="false">未上架</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.group} onValueChange={(v) => patchFilters({ group: v })}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="分类" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.key || 'all'} value={g.key}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.sourceName} onValueChange={(v) => patchFilters({ sourceName: v })}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部来源</SelectItem>
                  {sources.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters(filters) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
                  清空筛选
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* 列表内容：首次加载才整页占位，翻页时保留网格避免闪烁 */}
        {loading && books.length === 0 ? (
          <Card animation="none">
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">加载词库列表…</p>
            </div>
          </Card>
        ) : books.length === 0 ? (
          <Card animation="none">
            <EmptyState
              icon={Library}
              title={hasActiveFilters(filters) ? '没有匹配的词库' : '还没有词库'}
              description={
                hasActiveFilters(filters)
                  ? '试试调整筛选条件，或清空筛选查看全部词库。'
                  : '先创建一个词库，然后就可以在里面维护单词与分级内容。'
              }
              action={
                hasActiveFilters(filters)
                  ? { label: '清空筛选', onClick: clearFilters }
                  : { label: '创建词库', onClick: openCreate }
              }
            />
          </Card>
        ) : (
          <>
            <div className={cn('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5', loading && 'opacity-60 pointer-events-none')}>
              {books.map((b) => {
                const batchJob = audioJobs[b.id]
                const batchRunning = batchJob?.kind === 'batch' && isBatchAudioActive(batchJob.status)
                const batchQueued = batchJob?.kind === 'batch' && batchJob.status === 'queued'
                const purgeActive = batchJob?.kind === 'purge' && isPurgeAudioActive(batchJob.status)
                const purgeQueued = batchJob?.kind === 'purge' && batchJob.status === 'queued'

                return (
                  <div key={b.id}>
                    <Card padding="none" hover={false} animation="none" className="overflow-hidden h-full flex flex-col border border-border hover:shadow-md transition-shadow">
                      {/* 封面 */}
                      <div
                        className="h-32 flex items-center justify-center cursor-pointer overflow-hidden relative shrink-0"
                        style={{ background: coverGradient(b.name) }}
                        onClick={() => navigate(`/wordbooks/${b.id}`)}
                      >
                        <div className="absolute top-2.5 right-2.5 z-20">
                          {b.isActive ? (
                            <Badge variant="success" shape="pill" size="xs" className="shadow-sm bg-white/95">
                              已上架
                            </Badge>
                          ) : (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); handlePublish(b) }}
                              disabled={publishingId === b.id}
                              loading={publishingId === b.id}
                              className="bg-white/95 shadow-sm border-0"
                            >
                              上架
                            </Button>
                          )}
                        </div>
                        {b.coverUrl ? (
                          <img src={b.coverUrl} alt={b.name} className="w-full h-full object-cover absolute inset-0" />
                        ) : (
                          <>
                            <span className="text-5xl font-bold text-white/20 select-none absolute right-3 bottom-1 leading-none">
                              {b.name.charAt(0)}
                            </span>
                            <span className="text-3xl font-bold text-white drop-shadow z-10">
                              {b.name.charAt(0).toUpperCase()}
                            </span>
                          </>
                        )}
                      </div>

                      {/* 信息 */}
                      <div className="p-4 flex flex-col flex-1">
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => navigate(`/wordbooks/${b.id}`)}
                          >
                            {b.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
                            {b.description || '暂无描述'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          {b.level && (
                            <Badge variant="primary" shape="pill" size="xs">{b.level}</Badge>
                          )}
                          <Badge variant="muted" shape="pill" size="xs">
                            {b.wordCount.toLocaleString()} 词
                          </Badge>
                          {b.sourceName && (
                            <Badge variant="outline" shape="pill" size="xs" className="max-w-[120px] truncate">
                              {b.sourceName}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                          <Button
                            size="sm"
                            variant="primary"
                            className="flex-1"
                            onClick={() => navigate(`/wordbooks/${b.id}`)}
                            leftIcon={<BookOpen className="w-3.5 h-3.5" />}
                          >
                            管理单词
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(b)} aria-label="编辑">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(b)}
                            className="text-destructive hover:text-destructive"
                            aria-label="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            variant={batchRunning ? 'destructive' : 'outline'}
                            className="flex-1"
                            onClick={() => handleBatchAudio(b)}
                            disabled={purgeActive}
                            leftIcon={batchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                          >
                            {batchRunning
                              ? batchQueued
                                ? `取消排队${typeof batchJob.queuePosition === 'number' ? ` (#${batchJob.queuePosition + 1})` : ''}`
                                : `停止 ${batchJob.total > 0 ? `(${batchJob.processed}/${batchJob.total})` : ''}`
                              : '批量生成'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                            onClick={() => runPurgeAllAudio(b)}
                            disabled={purgeActive || (!!batchJob && isBatchAudioActive(batchJob.status))}
                            leftIcon={purgeActive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <VolumeX className="w-3.5 h-3.5" />}
                          >
                            {purgeActive
                              ? purgeQueued
                                ? `排队中${typeof batchJob.queuePosition === 'number' ? ` (#${batchJob.queuePosition + 1})` : ''}`
                                : `清除中 ${batchJob.total > 0 ? `(${batchJob.processed}/${batchJob.total})` : ''}`
                              : '清除音频'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                )
              })}
            </div>

            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={(p) => patchFilters({ page: p }, { resetPage: false })}
              showQuickJumper
              className="pt-2"
            />
          </>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => !saving && setShowModal(false)}
        title={editing ? '编辑词库' : '新建词库'}
        size="lg"
      >
        <div className="space-y-4 -mx-2">
          <Input
            label="词库名称"
            required
            value={form.name}
            onValueChange={(v) => setForm(f => ({ ...f, name: v }))}
            placeholder="请输入词库名称"
            size="sm"
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">描述</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className={textareaClass}
              placeholder="词库简介（可选）"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">等级</label>
              <Select value={form.level} onValueChange={(v) => setForm(f => ({ ...f, level: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择等级" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => (
                    <SelectItem key={l || 'any'} value={l}>{l || '不限'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              label="排序权重"
              type="number"
              value={String(form.sortOrder)}
              onValueChange={(v) => setForm(f => ({ ...f, sortOrder: Number(v) || 0 }))}
              size="sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">封面图</label>
            <div className="flex items-center gap-3">
              {form.coverUrl ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0">
                  <img src={form.coverUrl} alt="封面" className="w-full h-full object-cover" />
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setForm(f => ({ ...f, coverUrl: '' }))}
                    className="absolute top-0.5 right-0.5 h-5 w-5 p-0 bg-black/50 text-white hover:bg-black/70 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center shrink-0 text-muted-foreground">
                  <Upload className="w-5 h-5" />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                loading={coverUploading}
              >
                选择图片
              </Button>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">上架（用户可见）</p>
              <p className="text-xs text-muted-foreground mt-0.5">关闭后学员端不可见</p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => setForm(f => ({ ...f, isActive: checked }))}
            />
          </div>

          <details className="rounded-lg border border-border p-4">
            <summary className="text-sm font-medium text-foreground cursor-pointer select-none">
              词库元数据（考试 / CEFR / 来源）
            </summary>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  考试标签（JSON 数组，如 [&quot;CET-4&quot;,&quot;考研&quot;]）
                </label>
                <textarea
                  value={form.examTags}
                  onChange={e => setForm(f => ({ ...f, examTags: e.target.value }))}
                  rows={2}
                  className={cn(textareaClass, 'font-mono text-xs')}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="CEFR 区间"
                  value={form.cefrRange}
                  onValueChange={(v) => setForm(f => ({ ...f, cefrRange: v }))}
                  placeholder="如 A2-B1"
                  size="sm"
                />
                <Input
                  label="变体"
                  value={form.regionalVariant}
                  onValueChange={(v) => setForm(f => ({ ...f, regionalVariant: v }))}
                  placeholder="en-US / en-GB"
                  size="sm"
                />
              </div>
              <Input
                label="数据来源名称"
                value={form.sourceName}
                onValueChange={(v) => setForm(f => ({ ...f, sourceName: v }))}
                size="sm"
              />
              <Input
                label="来源链接"
                value={form.sourceUrl}
                onValueChange={(v) => setForm(f => ({ ...f, sourceUrl: v }))}
                size="sm"
              />
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">授权 / 版权说明</label>
                <textarea
                  value={form.licenseNote}
                  onChange={e => setForm(f => ({ ...f, licenseNote: e.target.value }))}
                  rows={2}
                  className={textareaClass}
                />
              </div>
            </div>
          </details>
        </div>

        <ModalFooter className="-mx-6 -mb-4 mt-6 px-6">
          <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={confirmDelete}
        title="删除词库"
        message={`确定删除词库「${deleteTarget?.name || ''}」？此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        loading={deleting}
      />
    </AdminLayout>
  )
}
