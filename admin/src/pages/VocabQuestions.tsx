import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import Badge from '@/components/UI/Badge'
import EmptyState from '@/components/UI/EmptyState'
import Modal, { ModalFooter } from '@/components/UI/Modal'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import Pagination from '@/components/UI/Pagination'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/UI/Select'
import { get, post, put, del } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'
import { showAlert } from '@/utils/notification'
import { Plus, Pencil, Trash2, Search, Upload, Download, AlertTriangle, Wand2, Volume2, VolumeX, Loader2, RefreshCw } from 'lucide-react'
import { fetchTTS } from '@/utils/lingechoTts'

interface VocabQuestion {
  id: number
  word: string
  options: string
  correctAnswer: string
  level: string
  difficultyScore: number
  audioUrl?: string
}

interface ImportRow {
  word: string
  correctAnswer: string
  options: string[]
  level: string
  difficultyScore: number
  isDuplicate: boolean
  selected: boolean
}

const LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1']

const emptyForm = (): Partial<VocabQuestion> => ({
  word: '', options: '[]', correctAnswer: '', level: 'A1', difficultyScore: 1, audioUrl: '',
})

export default function VocabQuestions() {
  const [list, setList] = useState<VocabQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [level, setLevel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  // 新建/编辑弹窗
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VocabQuestion | null>(null)
  const [form, setForm] = useState<Partial<VocabQuestion>>(emptyForm())
  const [optionsArr, setOptionsArr] = useState<string[]>(['', '', '', ''])
  const [saving, setSaving] = useState(false)
  const [generatingAudio, setGeneratingAudio] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; success?: number } | null>(null)
  const [purgingAudio, setPurgingAudio] = useState(false)
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [purgingAllAudio, setPurgingAllAudio] = useState(false)
  const [showPurgeAllConfirm, setShowPurgeAllConfirm] = useState(false)
  const [purgeAllProgress, setPurgeAllProgress] = useState<{ processed: number; total: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VocabQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleGenerateAudio = async () => {
    if (!form.word?.trim()) {
      showAlert('请先输入单词', 'error')
      return
    }
    setGeneratingAudio(true)
    try {
      const url = await fetchTTS(form.word.trim())
      setForm(f => ({ ...f, audioUrl: url }))
      showAlert('音频生成成功', 'success')
    } catch (e: any) {
      showAlert(e?.message || '音频生成失败', 'error')
    } finally {
      setGeneratingAudio(false)
    }
  }

  /** 后台批量生成音频（服务端执行，刷新页面不中断） */
  const pollBatchAudioStatus = async () => {
    const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms))
    for (;;) {
      try {
        const res = await get<{
          status?: string
          total?: number
          processed?: number
          success?: number
          failed?: number
          error?: string
        }>(`${getApiBaseURL()}/vocab/questions/batch-audio`)
        if (res.code !== 200) {
          showAlert(res.msg || '查询生成进度失败', 'error')
          setBatchRunning(false)
          setBatchProgress(null)
          return
        }
        const data = res.data || {}
        const status = data.status || 'idle'
        if (status === 'running') {
          setBatchRunning(true)
          setBatchProgress({
            done: data.processed ?? 0,
            total: data.total ?? 0,
            success: data.success,
          })
          await sleepMs(1200)
          continue
        }
        setBatchProgress(null)
        setBatchRunning(false)
        if (status === 'failed') {
          showAlert(data.error || '批量生成失败', 'error')
          return
        }
        if (status === 'stopped') {
          showAlert(`已停止，成功 ${data.success ?? 0}/${data.processed ?? 0}`, 'info')
          fetchList()
          return
        }
        if (status === 'done') {
          const success = data.success ?? 0
          const total = data.total ?? 0
          showAlert(
            total === 0 ? '所有题目已有音频' : `完成，成功 ${success}/${total}`,
            'success'
          )
          fetchList()
        }
        return
      } catch (e: any) {
        showAlert(e?.msg || e?.message || '查询生成进度失败', 'error')
        setBatchRunning(false)
        setBatchProgress(null)
        return
      }
    }
  }

  const handleBatchAudio = async () => {
    if (batchRunning) {
      try {
        await post(`${getApiBaseURL()}/vocab/questions/batch-audio/stop`)
        showAlert('已请求停止，稍候…', 'info')
      } catch (e: any) {
        showAlert(e?.msg || e?.message || '停止失败', 'error')
      }
      return
    }

    setBatchRunning(true)
    setBatchProgress(null)
    try {
      const res = await post<{
        status?: string
        started?: boolean
        total?: number
        processed?: number
        success?: number
      }>(`${getApiBaseURL()}/vocab/questions/batch-audio`, {
        level: level || undefined,
        word: keyword || undefined,
      })
      if (res.code !== 200) {
        showAlert(res.msg || '启动失败', 'error')
        setBatchRunning(false)
        return
      }
      const data = res.data || {}
      if (data.status === 'running' && !data.started) {
        showAlert('已有生成任务进行中', 'info')
      } else if (data.started === false && (data.total ?? 0) === 0) {
        showAlert('所有题目已有音频', 'success')
        setBatchRunning(false)
        return
      } else {
        showAlert(res.msg || '已在后台开始生成', 'info')
      }
      await pollBatchAudioStatus()
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '启动失败', 'error')
      setBatchRunning(false)
      setBatchProgress(null)
    }
  }

  const runPurgeBadAudio = async () => {
    if (purgingAudio) return
    setPurgingAudio(true)
    try {
      const res = await post<{ checked: number; cleared: number; clearedWords?: string[] }>(
        `${getApiBaseURL()}/vocab/questions/purge-bad-audio`
      )
      if (res.code !== 200) {
        showAlert(res.msg || '检测失败', 'error')
        return
      }
      const checked = res.data?.checked ?? 0
      const cleared = res.data?.cleared ?? 0
      showAlert(`已检测 ${checked} 条，清空无效音频 ${cleared} 条`, cleared > 0 ? 'success' : 'info')
      setShowPurgeConfirm(false)
      fetchList()
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '检测失败', 'error')
    } finally {
      setPurgingAudio(false)
    }
  }

  const runPurgeAllAudio = async () => {
    if (purgingAllAudio) return
    setPurgingAllAudio(true)
    try {
      const res = await post<{
        status?: string
        started?: boolean
        total?: number
        cleared?: number
        processed?: number
        objectsAttempted?: number
        objectsFailed?: number
        error?: string
      }>(`${getApiBaseURL()}/vocab/questions/purge-all-audio`)
      if (res.code !== 200) {
        showAlert(res.msg || '启动清除失败', 'error')
        setPurgingAllAudio(false)
        return
      }
      setShowPurgeAllConfirm(false)
      if (res.data?.status === 'done' && (res.data?.total ?? 0) === 0) {
        showAlert('没有需要清除的音频', 'info')
        setPurgingAllAudio(false)
        return
      }
      showAlert(res.msg || '已在后台开始清除，完成后会自动刷新', 'info')
      await pollPurgeAllAudioStatus()
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '启动清除失败', 'error')
      setPurgingAllAudio(false)
    }
  }

  const pollPurgeAllAudioStatus = async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    for (;;) {
      try {
        const res = await get<{
          status?: string
          total?: number
          processed?: number
          cleared?: number
          objectsAttempted?: number
          objectsFailed?: number
          error?: string
        }>(`${getApiBaseURL()}/vocab/questions/purge-all-audio`)
        if (res.code !== 200) {
          showAlert(res.msg || '查询清除进度失败', 'error')
          setPurgingAllAudio(false)
          setPurgeAllProgress(null)
          return
        }
        const data = res.data || {}
        const status = data.status || 'idle'
        if (status === 'running') {
          setPurgingAllAudio(true)
          setPurgeAllProgress({
            processed: data.processed ?? 0,
            total: data.total ?? 0,
          })
          await sleep(1500)
          continue
        }
        setPurgeAllProgress(null)
        setPurgingAllAudio(false)
        if (status === 'failed') {
          showAlert(data.error || '清除失败', 'error')
          return
        }
        if (status === 'done') {
          const cleared = data.cleared ?? 0
          const attempted = data.objectsAttempted ?? 0
          const failed = data.objectsFailed ?? 0
          showAlert(
            `清除完成：题目 ${cleared} 条（对象删除 ${attempted}，失败 ${failed}）`,
            failed > 0 ? 'warning' : 'success'
          )
          fetchList()
        }
        return
      } catch (e: any) {
        showAlert(e?.msg || e?.message || '查询清除进度失败', 'error')
        setPurgingAllAudio(false)
        setPurgeAllProgress(null)
        return
      }
    }
  }

  // 导入
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [parsing, setParsing] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        size: String(pageSize),
      })
      if (level) params.append('level', level)
      if (keyword) params.append('word', keyword)
      const res = await get<any>(`${getApiBaseURL()}/vocab/questions?${params}`)
      const payload = res?.data
      if (res?.code && res.code !== 200) {
        setList([])
        setTotal(0)
        return
      }
      // 兼容后端返回：{ questions, total, size, page } 以及旧结构：{ list, total }
      const questions = payload?.questions || payload?.list || []
      setList(Array.isArray(questions) ? questions : [])
      setTotal(Number(payload?.total || 0))
    } finally { setLoading(false) }
  }, [page, pageSize, level, keyword])

  useEffect(() => { fetchList() }, [fetchList])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await get<{ status?: string; processed?: number; total?: number }>(
          `${getApiBaseURL()}/vocab/questions/batch-audio`
        )
        if (cancelled || res.code !== 200) return
        if (res.data?.status === 'running') {
          setBatchRunning(true)
          setBatchProgress({
            done: res.data.processed ?? 0,
            total: res.data.total ?? 0,
          })
          await pollBatchAudioStatus()
        }
      } catch {
        // ignore
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await get<{ status?: string; processed?: number; total?: number }>(
          `${getApiBaseURL()}/vocab/questions/purge-all-audio`
        )
        if (cancelled || res.code !== 200) return
        if (res.data?.status === 'running') {
          setPurgingAllAudio(true)
          setPurgeAllProgress({
            processed: res.data.processed ?? 0,
            total: res.data.total ?? 0,
          })
          await pollPurgeAllAudioStatus()
        }
      } catch {
        // ignore
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOptionsArr(['', '', '', '']); setModalOpen(true) }

  const openEdit = (q: VocabQuestion) => {
    setEditing(q)
    let opts: string[] = ['', '', '', '']
    try { opts = JSON.parse(q.options) } catch {}
    while (opts.length < 4) opts.push('')
    setOptionsArr(opts.slice(0, 4))
    setForm({ ...q })
    setModalOpen(true)
  }

  const handleDelete = (q: VocabQuestion) => {
    setDeleteTarget(q)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await del(`${getApiBaseURL()}/vocab/questions/${deleteTarget.id}`)
      showAlert('删除成功', 'success')
      setDeleteTarget(null)
      fetchList()
    } catch (e: any) {
      showAlert(e?.message || '删除失败', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!form.word?.trim() || !form.correctAnswer?.trim() || !form.level) {
      showAlert('单词、正确答案、等级为必填', 'error'); return
    }
    setSaving(true)
    try {
      const payload = { ...form, options: JSON.stringify(optionsArr.filter(Boolean)) }
      if (editing) {
        await put(`${getApiBaseURL()}/vocab/questions/${editing.id}`, payload)
        showAlert('更新成功', 'success')
      } else {
        await post(`${getApiBaseURL()}/vocab/questions`, payload)
        showAlert('创建成功', 'success')
      }
      setModalOpen(false); fetchList()
    } catch (e: any) { showAlert(e?.message || '操作失败', 'error') }
    finally { setSaving(false) }
  }

  // 下载模板
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['word', 'correctAnswer', 'options(逗号分隔)', 'level', 'difficultyScore'],
      ['apple', '苹果', '苹果,香蕉,橙子,葡萄', 'A1', 1],
      ['beautiful', '美丽的', '美丽的,丑陋的,高兴的,悲伤的', 'B1', 2],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'vocab_questions')
    XLSX.writeFile(wb, 'vocab_questions_template.xlsx')
  }

  // 解析 Excel → 查重 → 预览
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setParsing(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', raw: false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
      if (rows.length < 2) { showAlert('Excel 数据为空', 'error'); return }

      const parsed: Omit<ImportRow, 'isDuplicate' | 'selected'>[] = []
      for (const row of rows.slice(1)) {
        const word = String(row[0] ?? '').trim()
        if (!word) continue
        const correctAnswer = String(row[1] ?? '').trim()
        const optStr = String(row[2] ?? '').trim()
        // 同时兼容中文逗号（，）和英文逗号（,）
        const opts = optStr ? optStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : []
        const lvl = String(row[3] ?? 'A1').trim()
        const diff = Number(row[4] ?? 1)
        parsed.push({
          word,
          correctAnswer,
          options: opts,
          level: ['A1','A2','B1','B2','C1'].includes(lvl) ? lvl : 'A1',
          difficultyScore: diff >= 1 ? diff : 1,
        })
      }
      if (parsed.length === 0) { showAlert('没有可解析的数据', 'error'); return }

      // 查重：复用 batch 接口前先用 check（若无 check 接口则跳过，直接全选）
      let dupSet = new Set<string>()
      try {
        const checkRes = await post<any>(`${getApiBaseURL()}/vocab/questions/check`, {
          words: parsed.map(r => r.word),
        })
        dupSet = new Set<string>((checkRes.data?.duplicates || []).map((s: string) => s.toLowerCase()))
      } catch {
        // 没有 check 接口时忽略，全部可选
      }

      setImportRows(parsed.map(r => ({
        ...r,
        isDuplicate: dupSet.has(r.word.toLowerCase()),
        selected: !dupSet.has(r.word.toLowerCase()),
      })))
      setShowImportModal(true)
    } catch (e: any) {
      showAlert(e?.message || '解析失败', 'error')
    } finally {
      setParsing(false)
    }
  }

  const toggleRow = (i: number) => setImportRows(rows => rows.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r))
  const toggleAll = (v: boolean) => setImportRows(rows => rows.map(r => ({ ...r, selected: v })))

  const confirmImport = async () => {
    const selected = importRows.filter(r => r.selected)
    if (selected.length === 0) { showAlert('请至少选择一条', 'error'); return }
    setImporting(true)
    try {
      const token = localStorage.getItem('auth_token')
      const questions = selected.map(r => ({
        word: r.word,
        correctAnswer: r.correctAnswer,
        options: JSON.stringify(r.options),
        level: r.level,
        difficultyScore: r.difficultyScore,
      }))
      const res = await fetch(`${getApiBaseURL()}/vocab/questions/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ questions }),
      })
      const data = await res.json()
      if (data.code === 200) {
        showAlert(`导入成功：${data.data?.created ?? selected.length} 条`, 'success')
        setShowImportModal(false); fetchList()
      } else {
        showAlert(data.msg || '导入失败', 'error')
      }
    } catch (e: any) { showAlert(e?.message || '导入失败', 'error') }
    finally { setImporting(false) }
  }

  const totalPages = Math.ceil(total / pageSize)
  const selectedCount = importRows.filter(r => r.selected).length
  const dupCount = importRows.filter(r => r.isDuplicate).length

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card className="relative z-20">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground">词汇测评题库</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {loading ? '加载中…' : `共 ${total.toLocaleString()} 题`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPurgeConfirm(true)} disabled={loading || purgingAudio || purgingAllAudio} leftIcon={<VolumeX className="w-4 h-4" />}>
                  {purgingAudio ? '检测中...' : '检测音频是否可用'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPurgeAllConfirm(true)}
                  disabled={loading || purgingAudio || purgingAllAudio}
                  leftIcon={purgingAllAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  className="text-destructive border-destructive/30"
                >
                  {purgingAllAudio
                    ? (purgeAllProgress ? `清除中 (${purgeAllProgress.processed}/${purgeAllProgress.total})` : '清除中...')
                    : '清除全部音频'}
                </Button>
                <Button
                  variant={batchRunning ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={handleBatchAudio}
                  disabled={loading && !batchRunning}
                  leftIcon={batchRunning && !batchProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                >
                  {!batchRunning
                    ? '批量生成音频'
                    : batchProgress
                      ? `停止 (${batchProgress.done}/${batchProgress.total})`
                      : '启动中...'}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadTemplate} leftIcon={<Download className="w-4 h-4" />}>
                  下载模板
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={parsing} loading={parsing} leftIcon={<Upload className="w-4 h-4" />}>
                  Excel 导入
                </Button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                <Button variant="primary" size="sm" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
                  新增题目
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={level} onValueChange={(v) => { setLevel(v); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="等级" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => (
                    <SelectItem key={l || 'all'} value={l}>{l || '全部等级'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="搜索单词..."
                value={keyword}
                onValueChange={(v) => { setKeyword(v); setPage(1) }}
                className="w-full sm:w-64"
                size="sm"
                leftIcon={<Search className="w-4 h-4" />}
                clearable
                onClear={() => { setKeyword(''); setPage(1) }}
              />
            </div>
          </div>
        </Card>

        <Card padding="none">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">加载题目列表…</p>
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={Search}
              title={keyword || level ? '没有匹配的题目' : '暂无题目'}
              description={keyword || level ? '试试调整筛选条件。' : '新增题目或通过 Excel 导入。'}
              action={keyword || level ? undefined : { label: '新增题目', onClick: openCreate }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">单词</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">正确答案</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">等级</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">难度分</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">选项数</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">音频</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(q => {
                    let optCount = 0
                    try { optCount = JSON.parse(q.options).length } catch {}
                    return (
                      <tr key={q.id} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium text-foreground">{q.word}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{q.correctAnswer}</td>
                        <td className="px-4 py-3">
                          <Badge variant="primary" size="xs" shape="pill">{q.level}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{q.difficultyScore}</td>
                        <td className="px-4 py-3 text-muted-foreground">{optCount}</td>
                        <td className="px-4 py-3">
                          {q.audioUrl ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { const audio = new Audio(q.audioUrl); audio.play() }}
                              aria-label="播放音频"
                            >
                              <Volume2 className="w-4 h-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(q)} aria-label="编辑">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(q)} className="text-destructive hover:text-destructive" aria-label="删除">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Pagination
          currentPage={page}
          totalPages={Math.max(1, totalPages)}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          showQuickJumper
        />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? '编辑题目' : '新增题目'}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="单词"
                required
                value={form.word || ''}
                onValueChange={(v) => setForm(f => ({ ...f, word: v }))}
                size="sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateAudio}
              disabled={generatingAudio || !form.word?.trim()}
              loading={generatingAudio}
              leftIcon={<Wand2 className="w-4 h-4" />}
              className="mb-1.5"
            >
              生成音频
            </Button>
          </div>
          <Input
            label="正确答案"
            required
            value={form.correctAnswer || ''}
            onValueChange={(v) => setForm(f => ({ ...f, correctAnswer: v }))}
            size="sm"
          />
          {form.audioUrl && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="音频 URL" value={form.audioUrl || ''} readOnly size="sm" />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mb-1.5"
                onClick={() => { if (form.audioUrl) new Audio(form.audioUrl).play() }}
                aria-label="播放音频"
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">干扰选项（4个）</p>
            {optionsArr.map((opt, i) => (
              <Input
                key={i}
                value={opt}
                onValueChange={(v) => setOptionsArr(arr => arr.map((item, j) => j === i ? v : item))}
                placeholder={`选项 ${i + 1}`}
                size="sm"
                className="mb-2"
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">等级 *</label>
              <Select value={form.level || 'A1'} onValueChange={(v) => setForm(f => ({ ...f, level: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择等级" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.filter(Boolean).map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              label="难度分值"
              type="number"
              min={1}
              value={String(form.difficultyScore || 1)}
              onValueChange={(v) => setForm(f => ({ ...f, difficultyScore: Number(v) }))}
              size="sm"
            />
          </div>
        </div>
        <ModalFooter className="-mx-6 mt-4 px-6">
          <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>取消</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={showImportModal}
        onClose={() => !importing && setShowImportModal(false)}
        title="导入预览"
        size="lg"
      >
        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          共 {importRows.length} 条，已选 {selectedCount} 条
          {dupCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-3 h-3" />{dupCount} 条重复
            </span>
          )}
        </p>
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>全选</Button>
          <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>全不选</Button>
          <Button variant="ghost" size="sm" onClick={() => setImportRows(rows => rows.map(r => ({ ...r, selected: !r.isDuplicate })))}>仅选非重复</Button>
        </div>
        <div className="overflow-auto max-h-[50vh] rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left w-10"></th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">单词</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">正确答案</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">等级</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">难度</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">状态</th>
              </tr>
            </thead>
            <tbody>
              {importRows.map((r, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={r.selected} onChange={() => toggleRow(i)} className="rounded" />
                  </td>
                  <td className="px-4 py-2 font-medium">{r.word}</td>
                  <td className="px-4 py-2 text-muted-foreground max-w-[160px] truncate">{r.correctAnswer}</td>
                  <td className="px-4 py-2"><Badge variant="primary" size="xs" shape="pill">{r.level}</Badge></td>
                  <td className="px-4 py-2 text-muted-foreground">{r.difficultyScore}</td>
                  <td className="px-4 py-2">
                    {r.isDuplicate
                      ? <Badge variant="warning" size="xs">重复</Badge>
                      : <Badge variant="success" size="xs">新增</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ModalFooter className="-mx-6 mt-4 px-6">
          <Button variant="outline" onClick={() => setShowImportModal(false)} disabled={importing}>取消</Button>
          <Button variant="primary" onClick={confirmImport} disabled={importing || selectedCount === 0} loading={importing}>
            {importing ? '导入中...' : `导入 ${selectedCount} 条`}
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        isOpen={showPurgeConfirm}
        onClose={() => {
          if (!purgingAudio) setShowPurgeConfirm(false)
        }}
        onConfirm={runPurgeBadAudio}
        title="检测音频是否可用"
        message="将检测所有已填写音频的题目，无法正常访问的音频会先从对象存储删除再清空链接。是否继续？"
        confirmText="开始检测"
        cancelText="取消"
        variant="warning"
        loading={purgingAudio}
      />

      <ConfirmDialog
        isOpen={showPurgeAllConfirm}
        onClose={() => {
          if (!purgingAllAudio) setShowPurgeAllConfirm(false)
        }}
        onConfirm={runPurgeAllAudio}
        title="清除全部音频"
        message="将在后台异步删除题库中全部音频文件（对象存储 Delete），并清空 audio_url。题目本身不会删除。此操作不可恢复，是否继续？"
        confirmText="后台清除"
        cancelText="取消"
        variant="danger"
        loading={purgingAllAudio}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={confirmDelete}
        title="删除题目"
        message={`确定删除题目「${deleteTarget?.word || ''}」？`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        loading={deleting}
      />
    </AdminLayout>
  )
}
