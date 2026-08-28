import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { get, post } from '@/lib/api'
import {
  type CoverJob,
  isCoverJobActive,
  sameCoverJob,
} from './cover-jobs'

type BookRef = { id: number; name: string }

function bookName(books: BookRef[], id: number): string {
  return books.find((b) => b.id === id)?.name || `词库 #${id}`
}

export function useWordbookCoverJobs(books: BookRef[]) {
  const [jobs, setJobs] = useState<Record<number, CoverJob>>({})
  const booksRef = useRef(books)
  booksRef.current = books
  const prevStatusRef = useRef<Record<number, string>>({})

  const setBookJob = (bookId: number, job: CoverJob | null) => {
    setJobs((prev) => {
      if (!job) {
        if (!(bookId in prev)) return prev
        const next = { ...prev }
        delete next[bookId]
        return next
      }
      if (sameCoverJob(prev[bookId], job)) return prev
      return { ...prev, [bookId]: job }
    })
    if (job) {
      prevStatusRef.current[bookId] = job.status
    } else {
      delete prevStatusRef.current[bookId]
    }
  }

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const POLL_FAST_MS = 2000
    const POLL_SLOW_MS = 8000
    const POLL_IDLE_MS = 30000
    const JOBS_TIMEOUT_MS = 8000

    const schedule = (ms: number) => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => void tick(), ms)
    }

    const tick = async () => {
      if (stopped) return
      let nextMs = POLL_IDLE_MS
      try {
        const res = await get<{ jobs?: CoverJob[] }>(
          '/wordbooks/cover-ai/jobs',
          { timeout: JOBS_TIMEOUT_MS }
        )
        if (stopped) return
        const remote = res.data?.jobs || []

        setJobs((prev) => {
          const next = { ...prev }
          let changed = false

          for (const j of remote) {
            const bookId = Number(j.bookId)
            if (!Number.isFinite(bookId)) continue

            const job: CoverJob = {
              bookId,
              status: j.status || 'idle',
              prompt: j.prompt,
              size: j.size,
              previewUrl: j.previewUrl,
              bytes: j.bytes,
              saved: j.saved,
              error: j.error,
              revisedPrompt: j.revisedPrompt,
            }

            const prevStatus = prevStatusRef.current[bookId]
            if (
              prevStatus &&
              isCoverJobActive(prevStatus) &&
              job.status === 'done'
            ) {
              const name = bookName(booksRef.current, bookId)
              toast.success(`${name}：封面预览已生成，可保存为正式封面`)
            }
            if (
              prevStatus &&
              isCoverJobActive(prevStatus) &&
              job.status === 'failed'
            ) {
              const name = bookName(booksRef.current, bookId)
              toast.error(`${name}：${job.error || '封面生成失败'}`)
            }
            prevStatusRef.current[bookId] = job.status

            if (!sameCoverJob(next[bookId], job)) {
              next[bookId] = job
              changed = true
            }
          }

          const remoteIds = new Set(
            remote.map((j) => Number(j.bookId)).filter(Number.isFinite)
          )
          for (const idStr of Object.keys(next)) {
            const id = Number(idStr)
            if (!remoteIds.has(id) && isCoverJobActive(next[id]?.status)) {
              delete next[id]
              delete prevStatusRef.current[id]
              changed = true
            }
          }

          return changed ? next : prev
        })

        const hasActive = remote.some((j) => isCoverJobActive(j.status))
        const hasPreview = remote.some(
          (j) => j.status === 'done' && !j.saved
        )
        if (hasActive) nextMs = POLL_FAST_MS
        else if (hasPreview) nextMs = POLL_SLOW_MS
      } catch {
        nextMs = POLL_SLOW_MS
      }
      if (!stopped) schedule(nextMs)
    }

    void tick()
    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  const refreshBookJob = async (bookId: number) => {
    try {
      const res = await get<CoverJob>(`/wordbooks/${bookId}/generate-cover`)
      const data = res.data
      if (!data) return undefined
      const job: CoverJob = {
        bookId,
        status: data.status || 'idle',
        prompt: data.prompt,
        size: data.size,
        previewUrl: data.previewUrl,
        bytes: data.bytes,
        saved: data.saved,
        error: data.error,
        revisedPrompt: data.revisedPrompt,
      }
      setBookJob(bookId, job)
      return job
    } catch {
      return undefined
    }
  }

  const startCoverJob = async (
    book: BookRef,
    opts: {
      prompt: string
      size: string
      referenceFile?: File | null
      referenceBookId?: number | null
    }
  ) => {
    const existing = jobs[book.id]
    if (existing && isCoverJobActive(existing.status)) {
      toast.info(`「${book.name}」封面生成任务进行中`)
      return 'busy'
    }

    const form = new FormData()
    form.append('prompt', opts.prompt.trim())
    form.append('size', opts.size.trim() || '1792x1024')
    if (opts.referenceFile) {
      form.append('referenceImage', opts.referenceFile)
    } else if (opts.referenceBookId && opts.referenceBookId > 0) {
      form.append('referenceBookId', String(opts.referenceBookId))
    }

    const res = await post<{ status?: string }>(
      `/wordbooks/${book.id}/generate-cover`,
      form
    )
    const status = res.data?.status || 'queued'
    setBookJob(book.id, {
      bookId: book.id,
      status: isCoverJobActive(status) ? status : 'queued',
      prompt: opts.prompt,
      size: opts.size,
    })
    toast.info(res.msg || `「${book.name}」已加入封面生成任务`)
    return 'started'
  }

  const saveCover = async (book: BookRef) => {
    const res = await post<{ coverUrl?: string }>(
      `/wordbooks/${book.id}/generate-cover/save`
    )
    const coverUrl = res.data?.coverUrl
    setBookJob(book.id, {
      ...jobs[book.id],
      bookId: book.id,
      status: 'done',
      previewUrl: coverUrl,
      saved: true,
    })
    toast.success(res.msg || `「${book.name}」封面已保存`)
    return coverUrl
  }

  const clearCover = async (book: BookRef) => {
    const res = await post<{ coverUrl?: string }>(
      `/wordbooks/${book.id}/generate-cover/clear`
    )
    setBookJob(book.id, null)
    toast.success(res.msg || `「${book.name}」封面已清除`)
    return res.data?.coverUrl ?? ''
  }

  return {
    jobs,
    startCoverJob,
    saveCover,
    clearCover,
    refreshBookJob,
  }
}
