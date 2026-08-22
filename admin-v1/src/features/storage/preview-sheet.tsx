import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { CallAudioPlayer } from '@/components/call-audio-player'
import { get, getBlob } from '@/lib/api'
import { formatDateTime } from '@/lib/datetime'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { fileLabel, formatBytes, previewKind, type PreviewKind } from './display'

export type StorageFile = {
  key: string
  size: number
  lastModified?: string
  contentType?: string
  publicURL?: string
}

type StorageFilePreviewProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: StorageFile | null
  bucket: string
}

const textPreviewMax = 2 * 1024 * 1024

export function StorageFilePreview({
  open,
  onOpenChange,
  file,
  bucket,
}: StorageFilePreviewProps) {
  const [kind, setKind] = useState<PreviewKind>('other')
  const [src, setSrc] = useState('')
  const [text, setText] = useState('')
  const [info, setInfo] = useState<StorageFile | null>(null)
  const [signedURL, setSignedURL] = useState('')
  const [loading, setLoading] = useState(false)
  const blobURL = useRef('')

  useEffect(() => {
    if (!open || !file) return
    let cancelled = false
    const release = () => {
      if (blobURL.current) {
        URL.revokeObjectURL(blobURL.current)
        blobURL.current = ''
      }
    }
    release()
    setSrc('')
    setText('')
    setSignedURL('')
    setLoading(true)

    const params = { bucket: bucket || undefined, key: file.key }
    ;(async () => {
      try {
        const [infoRes, urlRes] = await Promise.all([
          get<StorageFile>('/admin/storage/files/info', { params }).catch(() => null),
          get<{ url: string }>('/admin/storage/files/url', {
            params: { ...params, expires: 3600 },
          }).catch(() => null),
        ])
        if (cancelled) return
        const meta = infoRes?.data ?? file
        setInfo(meta)
        const nextKind = previewKind(file.key, meta.contentType)
        setKind(nextKind)
        const remote = urlRes?.data.url ?? meta.publicURL ?? ''
        setSignedURL(remote)

        if (nextKind === 'text') {
          if ((meta.size ?? file.size) > textPreviewMax) {
            setText('')
            setSrc(remote)
            return
          }
          const blob = await getBlob('/admin/storage/files/raw', { params })
          if (cancelled) return
          setText(await blob.text())
          return
        }

        if (nextKind === 'audio') {
          const blob = await getBlob('/admin/storage/files/raw', { params })
          if (cancelled) return
          const obj = URL.createObjectURL(blob)
          blobURL.current = obj
          setSrc(obj)
          return
        }

        if (nextKind === 'image' || nextKind === 'video' || nextKind === 'pdf') {
          if (remote) {
            setSrc(remote)
            return
          }
          const blob = await getBlob('/admin/storage/files/raw', { params })
          if (cancelled) return
          const obj = URL.createObjectURL(blob)
          blobURL.current = obj
          setSrc(obj)
          return
        }

        setSrc(remote)
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : '预览失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      release()
    }
  }, [open, file, bucket])

  const copyLink = async () => {
    const url = signedURL || src
    if (!url) {
      toast.error('没有可复制的链接')
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success('已复制临时链接')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-3xl'>
        <SheetHeader className='text-start'>
          <SheetTitle className='break-all'>
            {file ? fileLabel(file.key) : '预览'}
          </SheetTitle>
          <SheetDescription className='break-all'>
            {file?.key}
            {info ? ` · ${formatBytes(info.size)} · ${formatDateTime(info.lastModified)}` : ''}
          </SheetDescription>
        </SheetHeader>
        <div className='flex flex-wrap gap-2 px-4'>
          <Button variant='outline' size='sm' onClick={() => void copyLink()}>
            <Link2 className='size-4' />
            复制链接
          </Button>
          {signedURL || src ? (
            <Button variant='outline' size='sm' asChild>
              <a href={signedURL || src} target='_blank' rel='noreferrer'>
                <ExternalLink className='size-4' />
                新窗口打开
              </a>
            </Button>
          ) : null}
        </div>
        <div className='min-h-0 flex-1 overflow-auto px-4 pb-4'>
          {loading ? (
            <p className='text-sm text-muted-foreground'>加载预览…</p>
          ) : (
            <PreviewBody
              kind={kind}
              src={src}
              text={text}
              title={file ? fileLabel(file.key) : '音频'}
              contentType={info?.contentType}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PreviewBody({
  kind,
  src,
  text,
  title,
  contentType,
}: {
  kind: PreviewKind
  src: string
  text: string
  title: string
  contentType?: string
}) {
  if (kind === 'image' && src) {
    return <img src={src} alt='' className='max-h-[70vh] max-w-full rounded-md object-contain' />
  }
  if (kind === 'audio' && src) {
    return <CallAudioPlayer audioUrl={src} title={title} />
  }
  if (kind === 'video' && src) {
    return <video src={src} controls className='max-h-[70vh] w-full rounded-md bg-black' />
  }
  if (kind === 'pdf' && src) {
    return <iframe title='pdf' src={src} className='h-[70vh] w-full rounded-md border' />
  }
  if (kind === 'text' && text) {
    return (
      <pre className='max-h-[70vh] overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap'>
        {text}
      </pre>
    )
  }
  if (kind === 'text' && !text) {
    return <p className='text-sm text-muted-foreground'>文本超过 2MB，请在新窗口打开。</p>
  }
  return (
    <p className='text-sm text-muted-foreground'>
      无法内嵌预览{contentType ? `（${contentType}）` : ''}，请复制链接或在新窗口打开。
    </p>
  )
}
