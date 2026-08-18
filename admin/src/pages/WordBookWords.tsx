import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
import { get, post, put, del } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'
import { showAlert } from '@/utils/notification'
import { cn } from '@/utils/cn'
import { Plus, Pencil, Trash2, Search, ArrowLeft, Upload, Download, AlertTriangle, Wand2, VolumeX, Loader2, RefreshCw } from 'lucide-react'
import LingechoTTS from '@/components/UI/LingechoTTS'
import VoicePlayer from '@/components/VoicePlayer'

interface Word {
  id: number
  wordBookId: number
  word: string
  phonetic: string
  phoneticUs?: string
  phoneticUk?: string
  lemma?: string
  translation: string
  exampleSentence: string
  exampleSentences?: string
  audioUrl: string
  imageUrl?: string
  videoUrl?: string
  difficulty: number
  sortOrder: number
  partOfSpeech?: string
  definition?: string
  synonyms?: string
  antonyms?: string
  wordFamily?: string
  collocations?: string
  frequency?: number
  importance?: number
  tags?: string
  notes?: string
  syllables?: string
  stressPattern?: string
  cefrLevel?: string
  register?: string
  etymology?: string
  morphology?: string
  derivations?: string
  mnemonic?: string
  homophones?: string
  usageNotes?: string
  grammarPatterns?: string
}
interface WordBook { id: number; name: string; wordCount: number; level: string }

interface ImportRow {
  word: string; phonetic: string; translation: string; exampleSentence: string
  audioUrl: string; imageUrl: string
  difficulty: number; sortOrder: number
  isDuplicate: boolean; selected: boolean
}

const emptyForm = (): Record<string, string | number> => ({
  word: '', phonetic: '', phoneticUs: '', phoneticUk: '', lemma: '',
  translation: '', exampleSentence: '', exampleSentences: '', audioUrl: '',
  imageUrl: '', videoUrl: '', difficulty: 1, sortOrder: 0,
  partOfSpeech: '', definition: '', synonyms: '', antonyms: '', wordFamily: '', collocations: '',
  frequency: 1, importance: 1, tags: '', notes: '',
  syllables: '', stressPattern: '', cefrLevel: '', register: '',
  etymology: '', morphology: '', derivations: '', mnemonic: '', homophones: '',
  usageNotes: '', grammarPatterns: '',
})

const splitAudioUrls = (audioUrl: string): [string, string, string] => {
  const parts = (audioUrl || '').split(';').map(s => s.trim())
  return [parts[0] || '', parts[1] || '', parts[2] || '']
}

function audioDedupKey(url: string): string {
  const u = url.trim().toLowerCase().split('?')[0]
  for (const suffix of ['_uk.mp3', '_us.mp3', '_uk.wav', '_us.wav']) {
    if (u.endsWith(suffix)) return u.slice(0, -suffix.length)
  }
  return u
}

const joinAudioUrls = (parts: [string, string, string]): string => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = (p || '').trim()
    if (!t) {
      out.push('')
      continue
    }
    const key = audioDedupKey(t)
    if (seen.has(key)) {
      out.push('')
      continue
    }
    seen.add(key)
    out.push(t)
  }
  while (out.length > 0 && !out[out.length - 1]?.trim()) {
    out.pop()
  }
  return out.join(';')
}

export default function WordBookWords() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<WordBook | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  // 新建/编辑弹窗
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Word | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [audioUrlParts, setAudioUrlParts] = useState<[string, string, string]>(['', '', ''])
  const [saving, setSaving] = useState(false)
  const [dedupingAudio, setDedupingAudio] = useState(false)
  const [purgingAllAudio, setPurgingAllAudio] = useState(false)
  const [showPurgeAllConfirm, setShowPurgeAllConfirm] = useState(false)
  const [purgeAllProgress, setPurgeAllProgress] = useState<{ processed: number; total: number } | null>(null)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Word | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 导入预览弹窗
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [parsing, setParsing] = useState(false)

  const pageSize = 30

  const loadBook = useCallback(async () => {
    const res = await get<any>(`${getApiBaseURL()}/wordbooks/${id}`)
    if (res.code === 200) setBook(res.data)
  }, [id])

  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<any>(`${getApiBaseURL()}/wordbooks/${id}/managed-words?page=${page}&pageSize=${pageSize}&keyword=${keyword}`)
      if (res.code === 200) { setWords(res.data.list || []); setTotal(res.data.total || 0) }
    } finally { setLoading(false) }
  }, [id, page, keyword])

  useEffect(() => { loadBook() }, [loadBook])
  useEffect(() => { loadWords() }, [loadWords])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await get<{ status?: string; processed?: number; total?: number }>(
          `${getApiBaseURL()}/wordbooks/${id}/words/purge-all-audio`
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
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await get<{ status?: string; processed?: number; total?: number }>(
          `${getApiBaseURL()}/wordbooks/${id}/words/batch-audio`
        )
        if (cancelled || res.code !== 200) return
        if (res.data?.status === 'running' || res.data?.status === 'queued') {
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
  }, [id])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setAudioUrlParts(['', '', ''])
    setShowModal(true)
  }
  const openEdit = (w: Word) => {
    setEditing(w)
    setForm({
      ...emptyForm(),
      word: w.word,
      phonetic: w.phonetic || '',
      phoneticUs: w.phoneticUs || '',
      phoneticUk: w.phoneticUk || '',
      lemma: w.lemma || '',
      translation: w.translation || '',
      exampleSentence: w.exampleSentence || '',
      exampleSentences: w.exampleSentences || '',
      audioUrl: w.audioUrl || '',
      imageUrl: w.imageUrl || '',
      videoUrl: w.videoUrl || '',
      difficulty: w.difficulty ?? 1,
      sortOrder: w.sortOrder ?? 0,
      partOfSpeech: w.partOfSpeech || '',
      definition: w.definition || '',
      synonyms: w.synonyms || '',
      antonyms: w.antonyms || '',
      wordFamily: w.wordFamily || '',
      collocations: w.collocations || '',
      frequency: w.frequency ?? 1,
      importance: w.importance ?? 1,
      tags: w.tags || '',
      notes: w.notes || '',
      syllables: w.syllables || '',
      stressPattern: w.stressPattern || '',
      cefrLevel: w.cefrLevel || '',
      register: w.register || '',
      etymology: w.etymology || '',
      morphology: w.morphology || '',
      derivations: w.derivations || '',
      mnemonic: w.mnemonic || '',
      homophones: w.homophones || '',
      usageNotes: w.usageNotes || '',
      grammarPatterns: w.grammarPatterns || '',
    })
    setAudioUrlParts(splitAudioUrls(w.audioUrl))
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        difficulty: Number(form.difficulty) || 1,
        sortOrder: Number(form.sortOrder) || 0,
        frequency: Number(form.frequency) || 1,
        importance: Number(form.importance) || 1,
      }
      if (editing) { await put(`${getApiBaseURL()}/wordbooks/${id}/words/${editing.id}`, payload); showAlert('更新成功', 'success') }
      else { await post(`${getApiBaseURL()}/wordbooks/${id}/words`, payload); showAlert('添加成功', 'success') }
      setShowModal(false); loadWords(); loadBook()
    } catch (e: any) { showAlert(e?.message || '操作失败', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = (w: Word) => {
    setDeleteTarget(w)
  }

  const confirmDelete = async () => {
    const w = deleteTarget
    if (!w || deleting) return
    setDeleting(true)
    try {
      await del(`${getApiBaseURL()}/wordbooks/${id}/words/${w.id}`)
      showAlert('删除成功', 'success')
      setDeleteTarget(null)
      loadWords()
      loadBook()
    } catch (e: any) {
      showAlert(e?.message || '删除失败', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const pollPurgeAllAudioStatus = async () => {
    if (!id) return
    const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms))
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
        }>(`${getApiBaseURL()}/wordbooks/${id}/words/purge-all-audio`)
        if (res.code !== 200) {
          showAlert(res.msg || '查询清除进度失败', 'error')
          setPurgingAllAudio(false)
          setPurgeAllProgress(null)
          return
        }
        const data = res.data || {}
        const status = data.status || 'idle'
        if (status === 'running' || status === 'queued') {
          setPurgingAllAudio(true)
          setPurgeAllProgress({
            processed: data.processed ?? 0,
            total: data.total ?? 0,
          })
          await sleepMs(1500)
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
            cleared > 0
              ? `清除完成：${cleared} 条单词音频（对象 ${attempted}，失败 ${failed}）`
              : '没有需要清除的音频',
            failed > 0 ? 'warning' : 'success'
          )
          loadWords()
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

  const runPurgeAllAudio = async () => {
    if (!id || purgingAllAudio) return
    setPurgingAllAudio(true)
    try {
      const res = await post<{
        status?: string
        started?: boolean
        total?: number
        cleared?: number
      }>(`${getApiBaseURL()}/wordbooks/${id}/words/purge-all-audio`)
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
      showAlert(res.msg || '已在后台开始清除', 'info')
      await pollPurgeAllAudioStatus()
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '启动清除失败', 'error')
      setPurgingAllAudio(false)
    }
  }

  const handleDeduplicateAudio = async () => {
    if (!id || dedupingAudio) return
    setDedupingAudio(true)
    try {
      const res = await post<{ checked?: number; updated?: number }>(
        `${getApiBaseURL()}/wordbooks/${id}/words/deduplicate-audio`
      )
      if (res.code !== 200) {
        showAlert(res.msg || '清理失败', 'error')
        return
      }
      const checked = res.data?.checked ?? 0
      const updated = res.data?.updated ?? 0
      showAlert(
        updated > 0 ? `已检查 ${checked} 条，清理 ${updated} 条重复音频` : `已检查 ${checked} 条，未发现重复`,
        updated > 0 ? 'success' : 'info'
      )
      loadWords()
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '清理失败', 'error')
    } finally {
      setDedupingAudio(false)
    }
  }

  // 批量生成音频（后台任务）
  const pollBatchAudioStatus = async () => {
    if (!id) return
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
        }>(`${getApiBaseURL()}/wordbooks/${id}/words/batch-audio`)
        if (res.code !== 200) {
          showAlert(res.msg || '查询生成进度失败', 'error')
          setBatchRunning(false)
          setBatchProgress(null)
          return
        }
        const data = res.data || {}
        const status = data.status || 'idle'
        if (status === 'running' || status === 'queued') {
          setBatchRunning(true)
          setBatchProgress({
            done: data.processed ?? 0,
            total: data.total ?? 0,
          })
          await sleepMs(1000)
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
          loadWords()
          return
        }
        if (status === 'done') {
          const success = data.success ?? 0
          const total = data.total ?? 0
          showAlert(
            total === 0 ? '所有单词已有音频' : `完成，成功 ${success}/${total}`,
            'success'
          )
          loadWords()
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
    if (!id) return
    if (batchRunning) {
      try {
        await post(`${getApiBaseURL()}/wordbooks/${id}/words/batch-audio/stop`)
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
      }>(`${getApiBaseURL()}/wordbooks/${id}/words/batch-audio`, {
        keyword: keyword || undefined,
      })
      if (res.code !== 200) {
        showAlert(res.msg || '启动失败', 'error')
        setBatchRunning(false)
        return
      }
      const data = res.data || {}
      if ((data.status === 'running' || data.status === 'queued') && !data.started) {
        showAlert('已有生成任务进行中', 'info')
      } else if (data.started === false && (data.total ?? 0) === 0) {
        showAlert('所有单词已有音频', 'success')
        setBatchRunning(false)
        return
      } else {
        showAlert(res.msg || '已加入生成队列', 'info')
      }
      await pollBatchAudioStatus()
    } catch (e: any) {
      showAlert(e?.msg || e?.message || '启动失败', 'error')
      setBatchRunning(false)
      setBatchProgress(null)
    }
  }

  const downloadTemplate = () => {
    const a = document.createElement('a'); a.href = '/words_demo.xlsx'; a.download = 'words_template.xlsx'; a.click()
  }

  // 解析 Excel → 调 check 接口 → 打开预览弹窗
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setParsing(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
      if (rows.length < 2) { showAlert('Excel 数据为空', 'error'); return }

      const headerRow = (rows[0] || []).map((c: unknown) => String(c ?? '').trim().toLowerCase())
      const headerHasImage = headerRow[5]?.includes('image') ?? false
      const parsed: Omit<ImportRow, 'isDuplicate' | 'selected'>[] = []
      for (const row of rows.slice(1)) {
        const word = String(row[0] ?? '').trim()
        if (!word) continue
        const use8 = headerHasImage || (Array.isArray(row) && row.length >= 8)
        const imageUrl = use8 ? String(row[5] ?? '').trim() : ''
        const diff = Number(use8 ? row[6] : row[5])
        const sortOrder = Number(use8 ? row[7] : row[6])
        parsed.push({
          word,
          phonetic: String(row[1] ?? '').trim(),
          translation: String(row[2] ?? '').trim(),
          exampleSentence: String(row[3] ?? '').trim(),
          audioUrl: String(row[4] ?? '').trim(),
          imageUrl,
          difficulty: diff >= 1 && diff <= 5 ? diff : 1,
          sortOrder,
        })
      }
      if (parsed.length === 0) { showAlert('没有可解析的数据', 'error'); return }

      // 查重
      const checkRes = await post<any>(`${getApiBaseURL()}/wordbooks/${id}/words/check`, { words: parsed.map(r => r.word) })
      const dupSet = new Set<string>((checkRes.data?.duplicates || []).map((s: string) => s.toLowerCase()))

      setImportRows(parsed.map(r => ({
        ...r,
        isDuplicate: dupSet.has(r.word.toLowerCase()),
        selected: !dupSet.has(r.word.toLowerCase()), // 默认不选重复项
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
      // 构造 FormData，把选中行序列化后发送
      // 后端已有 import 接口接收 xlsx，这里改为直接 POST JSON 批量创建
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${getApiBaseURL()}/wordbooks/${id}/words/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ words: selected }),
      })
      const data = await res.json()
      if (data.code === 200) {
        showAlert(`导入成功：${data.data.imported} 条`, 'success')
        setShowImportModal(false); loadWords(); loadBook()
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
              <div className="min-w-0">
                <Button variant="ghost" size="sm" onClick={() => navigate('/wordbooks')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  词库列表
                </Button>
                <h1 className="text-lg font-semibold text-foreground mt-1 truncate">
                  {book?.name || '词库详情'}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {loading ? '加载中…' : `共 ${total.toLocaleString()} 词`}
                  {book?.level ? ` · ${book.level}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate} leftIcon={<Download className="w-4 h-4" />}>
                  下载模板
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={parsing} loading={parsing} leftIcon={<Upload className="w-4 h-4" />}>
                  Excel 导入
                </Button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPurgeAllConfirm(true)}
                  disabled={loading || purgingAllAudio || dedupingAudio}
                  leftIcon={purgingAllAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <VolumeX className="w-4 h-4" />}
                  className="text-destructive border-destructive/30"
                >
                  {purgingAllAudio
                    ? (purgeAllProgress ? `清除中 (${purgeAllProgress.processed}/${purgeAllProgress.total})` : '清除中...')
                    : '清除全部音频'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeduplicateAudio} disabled={loading || dedupingAudio} loading={dedupingAudio}>
                  清理重复音频
                </Button>
                <Button
                  variant={batchRunning ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={handleBatchAudio}
                  disabled={loading || purgingAllAudio}
                  leftIcon={batchRunning && !batchProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                >
                  {!batchRunning
                    ? '批量生成音频'
                    : batchProgress && batchProgress.total > 0
                      ? `停止 (${batchProgress.done}/${batchProgress.total})`
                      : '排队中...'}
                </Button>
                <Button variant="primary" size="sm" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
                  添加单词
                </Button>
              </div>
            </div>
            <Input
              placeholder="搜索单词或释义..."
              value={keyword}
              onValueChange={(v) => { setKeyword(v); setPage(1) }}
              className="w-full sm:w-72"
              size="sm"
              leftIcon={<Search className="w-4 h-4" />}
              clearable
              onClear={() => { setKeyword(''); setPage(1) }}
            />
          </div>
        </Card>

        <Card padding="none">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">加载单词列表…</p>
            </div>
          ) : words.length === 0 ? (
            <EmptyState
              icon={Search}
              title={keyword ? '没有匹配的单词' : '暂无单词'}
              description={keyword ? '试试换个关键词，或清空搜索。' : '添加单词或通过 Excel 导入。'}
              action={keyword ? undefined : { label: '添加单词', onClick: openCreate }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-12">#</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">单词</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">音标</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">释义</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-16">CEFR</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">难度</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {words.map((w, i) => (
                    <tr key={w.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">{(page - 1) * pageSize + i + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{w.word}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{w.phonetic || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{w.translation || '-'}</td>
                      <td className="px-4 py-3">
                        {w.cefrLevel ? <Badge variant="primary" size="xs" shape="pill">{w.cefrLevel}</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <span key={n} className={cn('w-2 h-2 rounded-full', n <= w.difficulty ? 'bg-primary' : 'bg-muted')} />
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(w)} aria-label="编辑">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(w)} className="text-destructive hover:text-destructive" aria-label="删除">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
        isOpen={showImportModal}
        onClose={() => !importing && setShowImportModal(false)}
        title="导入预览"
        size="xl"
      >
        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          共 {importRows.length} 条
          {dupCount > 0 && <span className="text-amber-600">，{dupCount} 条重复（已默认取消勾选）</span>}
          ，已选 {selectedCount} 条
        </p>
        <div className="flex items-center gap-3 mb-3 text-sm">
          <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>全选</Button>
          <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>全不选</Button>
          <Button variant="ghost" size="sm" onClick={() => setImportRows(rows => rows.map(r => ({ ...r, selected: !r.isDuplicate })))}>仅选非重复</Button>
          {dupCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" /> {dupCount} 条已存在于词库中
            </span>
          )}
        </div>
        <div className="overflow-auto max-h-[50vh] rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="px-4 py-2 w-10"></th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">单词</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">音标</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">释义</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">例句</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-16">难度</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-16">状态</th>
              </tr>
            </thead>
            <tbody>
              {importRows.map((row, i) => (
                <tr key={i} onClick={() => toggleRow(i)} className={cn('border-b border-border/60 cursor-pointer', row.selected ? 'bg-background' : 'opacity-60')}>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} onClick={e => e.stopPropagation()} className="rounded" />
                  </td>
                  <td className="px-4 py-2 font-medium">{row.word}</td>
                  <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{row.phonetic || '-'}</td>
                  <td className="px-4 py-2 text-muted-foreground max-w-[180px] truncate">{row.translation || '-'}</td>
                  <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{row.exampleSentence || '-'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.difficulty}</td>
                  <td className="px-4 py-2">
                    {row.isDuplicate
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
            {importing ? '导入中...' : `确认导入 ${selectedCount} 条`}
          </Button>
        </ModalFooter>
      </Modal>

      {/* 新建/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => !saving && setShowModal(false)}
        title={editing ? '编辑单词' : '添加单词'}
        size="xl"
      >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">单词 *</label>
                      <input value={String(form.word)} onChange={e => setForm(f => ({ ...f, word: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">词元 (lemma)</label>
                      <input value={String(form.lemma)} onChange={e => setForm(f => ({ ...f, lemma: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">音标（通用）</label>
                      <input value={String(form.phonetic)} onChange={e => setForm(f => ({ ...f, phonetic: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">美音 IPA</label>
                      <input value={String(form.phoneticUs)} onChange={e => setForm(f => ({ ...f, phoneticUs: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">英音 IPA</label>
                      <input value={String(form.phoneticUk)} onChange={e => setForm(f => ({ ...f, phoneticUk: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">词性</label>
                      <input value={String(form.partOfSpeech)} onChange={e => setForm(f => ({ ...f, partOfSpeech: e.target.value }))} placeholder="noun / verb …" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CEFR</label>
                      <input value={String(form.cefrLevel)} onChange={e => setForm(f => ({ ...f, cefrLevel: e.target.value }))} placeholder="A1–C2" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">音节 / 重音</label>
                      <div className="flex gap-2">
                        <input value={String(form.syllables)} onChange={e => setForm(f => ({ ...f, syllables: e.target.value }))} placeholder="音节" className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input value={String(form.stressPattern)} onChange={e => setForm(f => ({ ...f, stressPattern: e.target.value }))} placeholder="重音" className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">释义（JSON 数组或文本）</label>
                    <textarea value={String(form.translation)} onChange={e => setForm(f => ({ ...f, translation: e.target.value }))} rows={6} placeholder='如: ["n. 苹果"]' className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">英文释义</label>
                    <textarea value={String(form.definition)} onChange={e => setForm(f => ({ ...f, definition: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">例句</label>
                    <textarea value={String(form.exampleSentence)} onChange={e => setForm(f => ({ ...f, exampleSentence: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">多例句（JSON 数组）</label>
                    <textarea value={String(form.exampleSentences)} onChange={e => setForm(f => ({ ...f, exampleSentences: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">难度 (1-5)</label>
                      <input type="number" min={1} max={5} value={form.difficulty as number} onChange={e => setForm(f => ({ ...f, difficulty: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">排序权重</label>
                      <input type="number" value={form.sortOrder as number} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">频率 1–5</label>
                      <input type="number" min={1} max={5} value={form.frequency as number} onChange={e => setForm(f => ({ ...f, frequency: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">重要度 1–5</label>
                      <input type="number" min={1} max={5} value={form.importance as number} onChange={e => setForm(f => ({ ...f, importance: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <details className="rounded-lg border border-slate-200 dark:border-slate-600 p-3">
                    <summary className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">更多词典字段（语体、词源、搭配、JSON 列表）</summary>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">语体 register（JSON 数组）</label>
                        <input value={String(form.register)} onChange={e => setForm(f => ({ ...f, register: e.target.value }))} placeholder='如 ["neutral","informal"]' className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">词源</label>
                        <textarea value={String(form.etymology)} onChange={e => setForm(f => ({ ...f, etymology: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white resize-none" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">形态 morphology（JSON）</label>
                          <textarea value={String(form.morphology)} onChange={e => setForm(f => ({ ...f, morphology: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">派生 derivations（JSON 数组）</label>
                          <textarea value={String(form.derivations)} onChange={e => setForm(f => ({ ...f, derivations: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">联想记忆</label>
                        <textarea value={String(form.mnemonic)} onChange={e => setForm(f => ({ ...f, mnemonic: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white resize-none" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">同义词 synonyms（JSON）</label>
                          <textarea value={String(form.synonyms)} onChange={e => setForm(f => ({ ...f, synonyms: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">反义词 antonyms（JSON）</label>
                          <textarea value={String(form.antonyms)} onChange={e => setForm(f => ({ ...f, antonyms: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">搭配 collocations（JSON）</label>
                        <textarea value={String(form.collocations)} onChange={e => setForm(f => ({ ...f, collocations: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">词族 wordFamily（JSON）</label>
                        <textarea value={String(form.wordFamily)} onChange={e => setForm(f => ({ ...f, wordFamily: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">同音词 homophones（JSON）</label>
                        <textarea value={String(form.homophones)} onChange={e => setForm(f => ({ ...f, homophones: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">用法辨析</label>
                        <textarea value={String(form.usageNotes)} onChange={e => setForm(f => ({ ...f, usageNotes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">常用结构 grammarPatterns（JSON 数组）</label>
                        <textarea value={String(form.grammarPatterns)} onChange={e => setForm(f => ({ ...f, grammarPatterns: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">标签 tags（JSON）</label>
                          <textarea value={String(form.tags)} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white font-mono resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">备注 notes</label>
                          <textarea value={String(form.notes)} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white resize-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">配图 imageUrl</label>
                          <input value={String(form.imageUrl)} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">视频 videoUrl</label>
                          <input value={String(form.videoUrl)} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white" />
                        </div>
                      </div>
                    </div>
                  </details>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">音频 URL</label>
                    <div className="space-y-3">
                      {([0, 1, 2] as const).map((idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 w-20 shrink-0">URL {idx + 1}</span>
                            <input
                              value={audioUrlParts[idx]}
                              onChange={e => {
                                const next: [string, string, string] = [...audioUrlParts] as [string, string, string]
                                next[idx] = e.target.value
                                setAudioUrlParts(next)
                                setForm(f => ({ ...f, audioUrl: joinAudioUrls(next) }))
                              }}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          {audioUrlParts[idx]?.trim() ? (
                            <VoicePlayer
                              audioUrl={audioUrlParts[idx].trim()}
                              title={`音频 ${idx + 1}`}
                              className="w-full"
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <LingechoTTS
                      word={String(form.word)}
                      translation={String(form.translation)}
                      onGenerated={url => {
                        setForm(f => ({ ...f, audioUrl: url }))
                        setAudioUrlParts(splitAudioUrls(url))
                      }}
                    />
                  </div>
                </div>
              </div>
        <ModalFooter className="-mx-6 mt-4 px-6">
          <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>取消</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        isOpen={showPurgeAllConfirm}
        onClose={() => {
          if (!purgingAllAudio) setShowPurgeAllConfirm(false)
        }}
        onConfirm={runPurgeAllAudio}
        title="清除全部音频"
        message="将删除本词库所有单词的音频文件（对象存储），并清空 audioUrl。单词本身不会删除。此操作不可恢复，是否继续？"
        confirmText="后台清除"
        cancelText="取消"
        variant="danger"
        loading={purgingAllAudio}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={confirmDelete}
        title="删除单词"
        message={`确定删除单词「${deleteTarget?.word || ''}」？`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        loading={deleting}
      />
    </AdminLayout>
  )
}
