import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '@/components/Layout/AdminLayout'
import Button from '@/components/UI/Button'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import { get, post, put, del } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'
import { showAlert } from '@/utils/notification'
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Upload, X, Library, RefreshCw, Wand2, VolumeX, Loader2 } from 'lucide-react'

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
}

export default function WordBooks() {
  const navigate = useNavigate()
  const [books, setBooks] = useState<WordBook[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<WordBook | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [audioJobs, setAudioJobs] = useState<Record<number, AudioJob>>({})
  const [purgeTarget, setPurgeTarget] = useState<WordBook | null>(null)
  const [purgeStarting, setPurgeStarting] = useState(false)
  const audioJobsRef = useRef(audioJobs)
  audioJobsRef.current = audioJobs

  const pageSize = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<any>(`${getApiBaseURL()}/wordbooks/list?page=${page}&pageSize=${pageSize}&keyword=${keyword}`)
      if (res.code === 200) {
        setBooks(res.data.list || [])
        setTotal(res.data.total || 0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, keyword])

  useEffect(() => { load() }, [load])

  const setBookJob = (bookId: number, job: AudioJob | null) => {
    setAudioJobs((prev) => {
      if (!job) {
        if (!(bookId in prev)) return prev
        const next = { ...prev }
        delete next[bookId]
        return next
      }
      return { ...prev, [bookId]: job }
    })
  }

  const fetchBookAudioJob = async (bookId: number): Promise<AudioJob | null> => {
    const [batchRes, purgeRes] = await Promise.all([
      get<{ status?: string; processed?: number; total?: number; success?: number }>(
        `${getApiBaseURL()}/wordbooks/${bookId}/words/batch-audio`
      ),
      get<{ status?: string; processed?: number; total?: number }>(
        `${getApiBaseURL()}/wordbooks/${bookId}/words/purge-all-audio`
      ),
    ])
    if (batchRes.code === 200 && batchRes.data?.status === 'running') {
      return {
        kind: 'batch',
        status: 'running',
        processed: batchRes.data.processed ?? 0,
        total: batchRes.data.total ?? 0,
        success: batchRes.data.success,
      }
    }
    if (purgeRes.code === 200 && purgeRes.data?.status === 'running') {
      return {
        kind: 'purge',
        status: 'running',
        processed: purgeRes.data.processed ?? 0,
        total: purgeRes.data.total ?? 0,
      }
    }
    return null
  }

  useEffect(() => {
    if (books.length === 0) return
    let cancelled = false
    ;(async () => {
      const found: Record<number, AudioJob> = {}
      await Promise.all(
        books.map(async (b) => {
          try {
            const job = await fetchBookAudioJob(b.id)
            if (job) found[b.id] = job
          } catch {
            // ignore
          }
        })
      )
      if (!cancelled && Object.keys(found).length > 0) {
        setAudioJobs((prev) => ({ ...prev, ...found }))
      }
    })()
    return () => { cancelled = true }
  }, [books])

  const runningJobKey = Object.entries(audioJobs)
    .filter(([, job]) => job.status === 'running')
    .map(([id, job]) => `${id}:${job.kind}`)
    .sort()
    .join(',')

  useEffect(() => {
    const runningIds = runningJobKey
      ? runningJobKey.split(',').map((item) => Number(item.split(':')[0]))
      : []
    if (runningIds.length === 0) return

    let stopped = false
    const tick = async () => {
      for (const bookId of runningIds) {
        if (stopped) return
        const current = audioJobsRef.current[bookId]
        if (!current || current.status !== 'running') continue
        try {
          if (current.kind === 'batch') {
            const res = await get<{
              status?: string
              processed?: number
              total?: number
              success?: number
              error?: string
            }>(`${getApiBaseURL()}/wordbooks/${bookId}/words/batch-audio`)
            if (res.code !== 200) continue
            const status = res.data?.status || 'idle'
            if (status === 'running') {
              const processed = res.data?.processed ?? 0
              const total = res.data?.total ?? 0
              const latest = audioJobsRef.current[bookId]
              if (latest?.kind === 'batch' && latest.processed === processed && latest.total === total) continue
              setBookJob(bookId, {
                kind: 'batch',
                status: 'running',
                processed,
                total,
                success: res.data?.success,
              })
              continue
            }
            setBookJob(bookId, null)
            const bookName = books.find((b) => b.id === bookId)?.name || `词库 #${bookId}`
            if (status === 'failed') showAlert(`${bookName}：${res.data?.error || '批量生成失败'}`, 'error')
            else if (status === 'stopped') showAlert(`${bookName}：已停止，成功 ${res.data?.success ?? 0}/${res.data?.processed ?? 0}`, 'info')
            else if (status === 'done') {
              const total = res.data?.total ?? 0
              const success = res.data?.success ?? 0
              showAlert(total === 0 ? `${bookName}：所有单词已有音频` : `${bookName}：生成完成 ${success}/${total}`, 'success')
            }
          } else {
            const res = await get<{
              status?: string
              processed?: number
              total?: number
              cleared?: number
              objectsFailed?: number
              error?: string
            }>(`${getApiBaseURL()}/wordbooks/${bookId}/words/purge-all-audio`)
            if (res.code !== 200) continue
            const status = res.data?.status || 'idle'
            if (status === 'running') {
              const processed = res.data?.processed ?? 0
              const total = res.data?.total ?? 0
              const latest = audioJobsRef.current[bookId]
              if (latest?.kind === 'purge' && latest.processed === processed && latest.total === total) continue
              setBookJob(bookId, {
                kind: 'purge',
                status: 'running',
                processed,
                total,
              })
              continue
            }
            setBookJob(bookId, null)
            const bookName = books.find((b) => b.id === bookId)?.name || `词库 #${bookId}`
            if (status === 'failed') showAlert(`${bookName}：${res.data?.error || '清除失败'}`, 'error')
            else if (status === 'done') {
              const cleared = res.data?.cleared ?? 0
              const failed = res.data?.objectsFailed ?? 0
              showAlert(
                cleared > 0 ? `${bookName}：已清除 ${cleared} 条音频` : `${bookName}：没有需要清除的音频`,
                failed > 0 ? 'warning' : 'success'
              )
            }
          }
        } catch {
          // keep polling
        }
      }
    }

    const timer = window.setInterval(() => { void tick() }, 1200)
    void tick()
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [runningJobKey, books])

  const handleBatchAudio = async (b: WordBook) => {
    const job = audioJobs[b.id]
    if (job?.kind === 'purge' && job.status === 'running') return
    if (job?.kind === 'batch' && job.status === 'running') {
      try {
        await post(`${getApiBaseURL()}/wordbooks/${b.id}/words/batch-audio/stop`)
        showAlert(`「${b.name}」已请求停止`, 'info')
      } catch (e: any) {
        showAlert(e?.msg || e?.message || '停止失败', 'error')
      }
      return
    }

    setBookJob(b.id, { kind: 'batch', status: 'running', processed: 0, total: 0 })
    try {
      const res = await post<{
        status?: string
        started?: boolean
        total?: number
        processed?: number
        success?: number
      }>(`${getApiBaseURL()}/wordbooks/${b.id}/words/batch-audio`)
      if (res.code !== 200) {
        showAlert(res.msg || '启动失败', 'error')
        setBookJob(b.id, null)
        return
      }
      if (res.data?.started === false && (res.data?.total ?? 0) === 0) {
        showAlert(`「${b.name}」所有单词已有音频`, 'success')
        setBookJob(b.id, null)
        return
      }
      setBookJob(b.id, {
        kind: 'batch',
        status: 'running',
        processed: res.data?.processed ?? 0,
        total: res.data?.total ?? 0,
        success: res.data?.success,
      })
      showAlert(res.msg || `「${b.name}」已在后台开始生成`, 'info')
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '启动失败', 'error')
      setBookJob(b.id, null)
    }
  }

  const runPurgeAllAudio = async () => {
    const b = purgeTarget
    if (!b || purgeStarting) return
    setPurgeStarting(true)
    try {
      const res = await post<{
        status?: string
        started?: boolean
        total?: number
        processed?: number
      }>(`${getApiBaseURL()}/wordbooks/${b.id}/words/purge-all-audio`)
      if (res.code !== 200) {
        showAlert(res.msg || '启动清除失败', 'error')
        return
      }
      setPurgeTarget(null)
      if (res.data?.status === 'done' && (res.data?.total ?? 0) === 0) {
        showAlert(`「${b.name}」没有需要清除的音频`, 'info')
        return
      }
      setBookJob(b.id, {
        kind: 'purge',
        status: 'running',
        processed: res.data?.processed ?? 0,
        total: res.data?.total ?? 0,
      })
      showAlert(res.msg || `「${b.name}」已在后台开始清除`, 'info')
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '启动清除失败', 'error')
    } finally {
      setPurgeStarting(false)
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

  const handleDelete = async (b: WordBook) => {
    if (!confirm(`确定删除词库「${b.name}」？此操作不可恢复。`)) return
    try {
      await del(`${getApiBaseURL()}/wordbooks/${b.id}`)
      showAlert('删除成功', 'success')
      load()
    } catch (e: any) {
      showAlert(e?.message || '删除失败', 'error')
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

  const totalPages = Math.ceil(total / pageSize)

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        {/* 顶部操作栏 */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={keyword}
              onChange={e => { setKeyword(e.target.value); setPage(1) }}
              placeholder="搜索词库名称..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />} variant="primary">
              新建词库
            </Button>
          </div>
        </div>

        {/* 词库卡片网格 */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">加载中...</div>
        ) : books.length === 0 ? (
          <div className="py-14">
            <div className="max-w-xl mx-auto bg-white/80 dark:bg-slate-900/60 backdrop-blur rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-8 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                <Library className="w-6 h-6 text-teal-700 dark:text-teal-300" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-100">还没有词库</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">先创建一个词库，然后就可以在里面维护单词与分级内容。</p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />} variant="primary">
                  创建词库
                </Button>
                <Button
                  onClick={() => load()}
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                  variant="outline"
                >
                  刷新
                </Button>
                {keyword && (
                  <Button
                    onClick={() => { setKeyword(''); setPage(1) }}
                    leftIcon={<X className="w-4 h-4" />}
                    variant="ghost"
                  >
                    清空搜索
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {books.map(b => (
              <div key={b.id} className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/35 transition-colors shadow-rest">
                {/* 封面 */}
                <div
                  className="h-28 flex items-center justify-center cursor-pointer overflow-hidden relative"
                  style={{ background: coverGradient(b.name) }}
                  onClick={() => navigate(`/wordbooks/${b.id}`)}
                >
                  {b.coverUrl ? (
                    <img src={b.coverUrl} alt={b.name} className="w-full h-full object-cover absolute inset-0" />
                  ) : (
                    <>
                      <span className="text-5xl font-bold text-white/20 select-none absolute right-3 bottom-1 leading-none">{b.name.charAt(0)}</span>
                      <span className="text-3xl font-bold text-white drop-shadow z-10">{b.name.charAt(0).toUpperCase()}</span>
                    </>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-semibold text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-teal-700"
                        onClick={() => navigate(`/wordbooks/${b.id}`)}
                      >
                        {b.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{b.description || '暂无描述'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {b.level && <span className="px-2 py-0.5 text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-200 rounded-full">{b.level}</span>}
                    <span className="text-xs text-slate-500">{b.wordCount} 词</span>
                    {!b.isActive && <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-full">已下架</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => navigate(`/wordbooks/${b.id}`)}
                      className="flex-1 text-xs text-center py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
                    >
                      管理单词
                    </button>
                    <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(b)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleBatchAudio(b)}
                      disabled={audioJobs[b.id]?.kind === 'purge' && audioJobs[b.id]?.status === 'running'}
                      className={`flex-1 inline-flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        audioJobs[b.id]?.kind === 'batch' && audioJobs[b.id]?.status === 'running'
                          ? 'border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                      }`}
                    >
                      {audioJobs[b.id]?.kind === 'batch' && audioJobs[b.id]?.status === 'running' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          停止 {audioJobs[b.id].total > 0 ? `(${audioJobs[b.id].processed}/${audioJobs[b.id].total})` : ''}
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          批量生成
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurgeTarget(b)}
                      disabled={!!audioJobs[b.id] && audioJobs[b.id].status === 'running'}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {audioJobs[b.id]?.kind === 'purge' && audioJobs[b.id]?.status === 'running' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          清除中 {audioJobs[b.id].total > 0 ? `(${audioJobs[b.id].processed}/${audioJobs[b.id].total})` : ''}
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3.5 h-3.5" />
                          清除音频
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{editing ? '编辑词库' : '新建词库'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">词库名称 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">描述</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">等级</label>
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {LEVELS.map(l => <option key={l} value={l}>{l || '不限'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">排序权重</label>
                  <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">封面图</label>
                <div className="flex items-center gap-3">
                  {form.coverUrl ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 flex-shrink-0">
                      <img src={form.coverUrl} alt="封面" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, coverUrl: '' }))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center flex-shrink-0 text-slate-400">
                      <Upload className="w-5 h-5" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    {coverUploading ? '上传中...' : '选择图片'}
                  </button>
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-slate-300">上架（用户可见）</label>
              </div>

              <details className="rounded-lg border border-slate-200 dark:border-slate-600 p-3">
                <summary className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">词库元数据（考试 / CEFR / 来源）</summary>
                <div className="mt-4 space-y-3 pt-1">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">考试标签（JSON 数组，如 [&quot;CET-4&quot;,&quot;考研&quot;]）</label>
                    <textarea value={form.examTags} onChange={e => setForm(f => ({ ...f, examTags: e.target.value }))} rows={2}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">CEFR 区间</label>
                      <input value={form.cefrRange} onChange={e => setForm(f => ({ ...f, cefrRange: e.target.value }))} placeholder="如 A2-B1"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">变体</label>
                      <input value={form.regionalVariant} onChange={e => setForm(f => ({ ...f, regionalVariant: e.target.value }))} placeholder="en-US / en-GB"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">数据来源名称</label>
                    <input value={form.sourceName} onChange={e => setForm(f => ({ ...f, sourceName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">来源链接</label>
                    <input value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">授权 / 版权说明</label>
                    <textarea value={form.licenseNote} onChange={e => setForm(f => ({ ...f, licenseNote: e.target.value }))} rows={2}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
              </details>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">取消</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!purgeTarget}
        onClose={() => {
          if (!purgeStarting) setPurgeTarget(null)
        }}
        onConfirm={runPurgeAllAudio}
        title="清除全部音频"
        message={`将删除「${purgeTarget?.name || ''}」中所有单词的音频文件，并清空 audioUrl。单词本身不会删除。此操作不可恢复，是否继续？`}
        confirmText="后台清除"
        cancelText="取消"
        variant="danger"
        loading={purgeStarting}
      />
    </AdminLayout>
  )
}
