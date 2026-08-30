import { useEffect, useRef, useState } from 'react'
import { Eye, Folder, Link2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { get, post } from '@/lib/api'
import { formatDateTime } from '@/lib/datetime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  canPageNext,
  deleteConfirmText,
  fileLabel,
  folderLabel,
  formatBytes,
  isUnderPrefix,
  pageMarker,
  prefixCrumbs,
  rememberNextMarker,
} from './display'
import { StorageFilePreview, type StorageFile } from './preview-sheet'

type StorageInfo = {
  kind: string
  supportsManagement: boolean
  supportsMultipart: boolean
  defaultBucket: string
}

type BucketInfo = {
  name: string
  region?: string
  isPrivate?: boolean
}

type ListFilesData = {
  files?: StorageFile[]
  marker?: string
  isTruncated?: boolean
  commonPrefixes?: string[]
}

type DeleteTarget = {
  keys: string[]
  prefixes: string[]
}

function clearSelection() {
  return { keys: new Set<string>(), prefixes: new Set<string>() }
}

export function StoragePage() {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [buckets, setBuckets] = useState<BucketInfo[]>([])
  const [bucket, setBucket] = useState('')
  const [prefix, setPrefix] = useState('')
  const [prefixDraft, setPrefixDraft] = useState('')
  const [files, setFiles] = useState<StorageFile[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [markers, setMarkers] = useState<string[]>([''])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [truncated, setTruncated] = useState(false)
  const [nextMarker, setNextMarker] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<StorageFile | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(
    () => new Set()
  )
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetList = () => {
    setPage(1)
    setMarkers([''])
    const empty = clearSelection()
    setSelectedKeys(empty.keys)
    setSelectedPrefixes(empty.prefixes)
  }

  const goPrefix = (next: string) => {
    setPrefix(next)
    setPrefixDraft(next)
    resetList()
  }

  const loadInfo = async () => {
    const res = await get<StorageInfo>('/admin/storage')
    setInfo(res.data)
    if (res.data.defaultBucket) {
      setBucket((cur) => cur || res.data.defaultBucket)
    }
  }

  const loadBuckets = async () => {
    try {
      const res = await get<{ buckets?: BucketInfo[] }>(
        '/admin/storage/buckets'
      )
      setBuckets(res.data.buckets ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '无法列出存储桶')
    }
  }

  const loadFiles = async () => {
    setLoading(true)
    try {
      const res = await get<ListFilesData>('/admin/storage/files', {
        params: {
          bucket: bucket || undefined,
          prefix: prefix || undefined,
          marker: pageMarker(markers, page) || undefined,
          delimiter: '/',
          limit: pageSize,
        },
      })
      const data = res.data
      const marker = data.marker ?? ''
      const cut = Boolean(data.isTruncated)
      setFolders(data.commonPrefixes ?? [])
      setFiles(data.files ?? [])
      setNextMarker(marker)
      setTruncated(cut)
      setMarkers((prev) => rememberNextMarker(prev, page, marker, cut))
      const empty = clearSelection()
      setSelectedKeys(empty.keys)
      setSelectedPrefixes(empty.prefixes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '列出对象失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInfo().catch((err) => {
      toast.error(err instanceof Error ? err.message : '读取存储信息失败')
    })
    loadBuckets().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!info?.supportsManagement) return
    loadFiles().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, bucket, prefix, page, pageSize])

  const copyURL = async (key: string) => {
    try {
      const res = await get<{ url: string }>('/admin/storage/files/url', {
        params: { bucket: bucket || undefined, key, expires: 3600 },
      })
      await navigator.clipboard.writeText(res.data.url)
      toast.success('已复制临时链接（1 小时）')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '获取链接失败')
    }
  }

  const runDelete = async (target: DeleteTarget) => {
    setDeleting(true)
    try {
      const res = await post<{ deleted?: number; failed?: number }>(
        '/admin/storage/files/batch-delete',
        {
          bucket: bucket || undefined,
          keys: target.keys,
          prefixes: target.prefixes,
        }
      )
      const deleted = res.data.deleted ?? 0
      const failed = res.data.failed ?? 0
      if (failed > 0) {
        toast.error(`已删除 ${deleted} 个对象，${failed} 个失败`)
      } else if (target.prefixes.length > 0 && target.keys.length === 0) {
        toast.success(`已删除文件夹下 ${deleted} 个对象`)
      } else if (deleted > 1) {
        toast.success(`已删除 ${deleted} 个对象`)
      } else {
        toast.success('已删除')
      }
      setDeleteTarget(null)
      const empty = clearSelection()
      setSelectedKeys(empty.keys)
      setSelectedPrefixes(empty.prefixes)
      await loadFiles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const isFileCovered = (key: string) =>
    [...selectedPrefixes].some((p) => isUnderPrefix(key, p))

  const toggleFile = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const toggleFolder = (folderPrefix: string, checked: boolean) => {
    setSelectedPrefixes((prev) => {
      const next = new Set(prev)
      if (checked) next.add(folderPrefix)
      else next.delete(folderPrefix)
      return next
    })
    if (checked) {
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        for (const key of next) {
          if (isUnderPrefix(key, folderPrefix)) next.delete(key)
        }
        return next
      })
    }
  }

  const fileKeys = files.map((f) => f.key)
  const allFilesSelected =
    fileKeys.length === 0 ||
    fileKeys.every((k) => selectedKeys.has(k) || isFileCovered(k))
  const allFoldersSelected =
    folders.length === 0 || folders.every((p) => selectedPrefixes.has(p))
  const allSelected = allFilesSelected && allFoldersSelected
  const someSelected =
    fileKeys.some((k) => selectedKeys.has(k) || isFileCovered(k)) ||
    folders.some((p) => selectedPrefixes.has(p))

  const selectionTotal = selectedKeys.size + selectedPrefixes.size

  const crumbs = prefixCrumbs(prefix)
  const showPager =
    page > 1 || canPageNext(page, markers, truncated, nextMarker)

  const openBulkDelete = () => {
    setDeleteTarget({
      keys: [...selectedKeys],
      prefixes: [...selectedPrefixes],
    })
  }

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    if (!info?.supportsManagement) {
      toast.error('当前后端不支持上传')
      return
    }
    setUploading(true)
    let ok = 0
    let fail = 0
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData()
        form.append('file', file)
        if (bucket) form.append('bucket', bucket)
        if (prefix) form.append('prefix', prefix)
        try {
          await post('/admin/storage/files', form, {
            timeout: 120_000,
          })
          ok++
        } catch {
          fail++
        }
      }
      if (fail === 0) {
        toast.success(ok > 1 ? `已上传 ${ok} 个文件` : '上传成功')
      } else if (ok === 0) {
        toast.error('上传失败')
      } else {
        toast.error(`成功 ${ok} 个，失败 ${fail} 个`)
      }
      if (ok > 0) await loadFiles()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <AdminPage
      title='对象存储'
      extra={
        <div className='flex gap-2'>
          <input
            ref={fileInputRef}
            type='file'
            className='hidden'
            multiple
            onChange={(e) => void uploadFiles(e.target.files)}
          />
          <Button
            variant='default'
            size='sm'
            disabled={!info?.supportsManagement || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className='size-4' />
            {uploading ? '上传中…' : '上传'}
          </Button>
          {selectionTotal > 0 ? (
            <Button variant='destructive' size='sm' onClick={openBulkDelete}>
              <Trash2 className='size-4' />
              删除选中（{selectionTotal}）
            </Button>
          ) : null}
          <Button
            variant='outline'
            size='sm'
            disabled={loading}
            onClick={() => void loadFiles()}
          >
            <RefreshCw className='size-4' />
            刷新
          </Button>
        </div>
      }
    >
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <Badge variant='secondary'>{info?.kind ?? '…'}</Badge>
        {info?.supportsManagement ? (
          <Badge>可管理</Badge>
        ) : (
          <Badge variant='destructive'>当前后端不支持管理接口</Badge>
        )}
        {info?.supportsMultipart ? <Badge variant='outline'>分片</Badge> : null}
        <Select
          value={bucket || '_default'}
          onValueChange={(v) => {
            goPrefix('')
            setBucket(v === '_default' ? '' : v)
          }}
        >
          <SelectTrigger className='w-64'>
            <SelectValue placeholder='存储桶' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='_default'>
              默认桶{info?.defaultBucket ? `（${info.defaultBucket}）` : ''}
            </SelectItem>
            {buckets.map((b) => (
              <SelectItem key={b.name} value={b.name}>
                {b.name}
                {b.region ? ` · ${b.region}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v))
            resetList()
          }}
        >
          <SelectTrigger className='w-28'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='20'>20 / 页</SelectItem>
            <SelectItem value='50'>50 / 页</SelectItem>
            <SelectItem value='100'>100 / 页</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className='max-w-sm'
          placeholder='前缀，回车跳转'
          value={prefixDraft}
          onChange={(e) => setPrefixDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') goPrefix(prefixDraft)
          }}
        />
      </div>

      <div className='mb-3 flex flex-wrap gap-1 text-sm'>
        {crumbs.map((c) => (
          <Button
            key={c.prefix || 'root'}
            variant='ghost'
            size='sm'
            className='h-7 px-2'
            onClick={() => goPrefix(c.prefix)}
          >
            {c.label}
          </Button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-10'>
              <Checkbox
                checked={
                  allSelected ? true : someSelected ? 'indeterminate' : false
                }
                onCheckedChange={(v) => {
                  if (v) {
                    setSelectedKeys(new Set(fileKeys))
                    setSelectedPrefixes(new Set(folders))
                  } else {
                    const empty = clearSelection()
                    setSelectedKeys(empty.keys)
                    setSelectedPrefixes(empty.prefixes)
                  }
                }}
                aria-label='全选当前页'
              />
            </TableHead>
            <TableHead>名称</TableHead>
            <TableHead>大小</TableHead>
            <TableHead>修改时间</TableHead>
            <TableHead className='w-48'>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((folder) => (
            <TableRow
              key={folder}
              data-state={selectedPrefixes.has(folder) ? 'selected' : undefined}
            >
              <TableCell>
                <Checkbox
                  checked={selectedPrefixes.has(folder)}
                  onCheckedChange={(v) => toggleFolder(folder, v === true)}
                  aria-label={`选择文件夹 ${folder}`}
                />
              </TableCell>
              <TableCell>
                <button
                  type='button'
                  className='inline-flex items-center gap-2 text-left hover:underline'
                  onClick={() => goPrefix(folder)}
                >
                  <Folder className='size-4' />
                  {folderLabel(folder)}/
                </button>
              </TableCell>
              <TableCell>—</TableCell>
              <TableCell>—</TableCell>
              <TableCell>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() =>
                    setDeleteTarget({ keys: [], prefixes: [folder] })
                  }
                >
                  <Trash2 className='size-4' />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {files.map((file) => {
            const covered = isFileCovered(file.key)
            return (
              <TableRow
                key={file.key}
                data-state={
                  selectedKeys.has(file.key) || covered ? 'selected' : undefined
                }
              >
                <TableCell>
                  <Checkbox
                    checked={covered || selectedKeys.has(file.key)}
                    disabled={covered}
                    onCheckedChange={(v) => toggleFile(file.key, v === true)}
                    aria-label={`选择 ${file.key}`}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type='button'
                    className='text-left font-mono text-xs hover:underline'
                    onClick={() => setPreview(file)}
                  >
                    {fileLabel(file.key)}
                  </button>
                </TableCell>
                <TableCell>{formatBytes(file.size)}</TableCell>
                <TableCell>{formatDateTime(file.lastModified)}</TableCell>
                <TableCell className='flex gap-1'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setPreview(file)}
                  >
                    <Eye className='size-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => void copyURL(file.key)}
                  >
                    <Link2 className='size-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    disabled={covered}
                    onClick={() =>
                      setDeleteTarget({ keys: [file.key], prefixes: [] })
                    }
                  >
                    <Trash2 className='size-4' />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
          {!loading && folders.length === 0 && files.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className='text-muted-foreground'>
                没有对象
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {showPager ? (
        <div className='mt-4 flex items-center justify-end gap-2'>
          <span className='text-sm text-muted-foreground'>第 {page} 页</span>
          <Button
            variant='outline'
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Button
            variant='outline'
            disabled={
              loading || !canPageNext(page, markers, truncated, nextMarker)
            }
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      ) : null}

      <StorageFilePreview
        open={Boolean(preview)}
        onOpenChange={(next) => !next && setPreview(null)}
        file={preview}
        bucket={bucket}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null)
        }}
        title='删除对象'
        desc={
          deleteTarget
            ? deleteConfirmText(deleteTarget.keys, deleteTarget.prefixes)
            : ''
        }
        destructive
        isLoading={deleting}
        cancelBtnText='取消'
        confirmText='删除'
        handleConfirm={async () => {
          if (!deleteTarget) return
          await runDelete(deleteTarget)
        }}
      />
    </AdminPage>
  )
}
