import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { get, post, put } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mediaSrc } from '@/features/wordbooks/word-audio'
import { profileFields, looksLikeEmail, type ProfileInfo } from './profile-display'

type AuthInfo = ProfileInfo & {
  avatar?: string
}

function syncAuthUser(info: AuthInfo, prev: AuthUser | null): AuthUser {
  const role = info.role ? [info.role] : prev?.role ?? ['admin']
  const email = looksLikeEmail(info.email)
    ? info.email!.trim()
    : looksLikeEmail(prev?.email)
      ? prev!.email
      : ''
  return {
    id: info.id ?? prev?.id,
    accountNo: info.username ?? prev?.accountNo ?? '',
    email,
    username: info.username ?? prev?.username,
    displayName: info.displayName ?? prev?.displayName,
    avatar: info.avatar ?? prev?.avatar,
    role,
    exp: prev?.exp ?? Date.now() + 24 * 60 * 60 * 1000,
  }
}

export function ProfileForm() {
  const user = useAuthStore((s) => s.auth.user)
  const setUser = useAuthStore((s) => s.auth.setUser)
  const fileRef = useRef<HTMLInputElement>(null)

  const [info, setInfo] = useState<AuthInfo | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setDisplayName(user.displayName || '')
    setAvatarUrl(user.avatar || '')
  }, [user])

  useEffect(() => {
    void get<AuthInfo>('/auth/info')
      .then((res) => {
        const info = res.data
        setInfo(info)
        setUser(syncAuthUser(info, user))
        setDisplayName(info.displayName || '')
        setPhone(info.phone || '')
        setAvatarUrl(info.avatar || '')
      })
      .catch(() => {
        /* keep store snapshot */
      })
    // load once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user) {
    return (
      <p className='text-sm text-muted-foreground'>未读取到登录用户信息。</p>
    )
  }

  const name = displayName || user.displayName || user.username || user.email
  const fallback = name.slice(0, 2).toUpperCase()
  const readOnly = profileFields({
    ...info,
    id: info?.id ?? user.id,
    username: info?.username || user.username || user.accountNo,
    email: looksLikeEmail(info?.email) ? info?.email : undefined,
    displayName: displayName || info?.displayName || user.displayName,
    phone: phone || info?.phone,
    role: info?.role || user.role[0],
  })

  const onPickAvatar = () => {
    if (uploading) return
    fileRef.current?.click()
  }

  const onAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片不能超过 5MB')
      return
    }

    const formData = new FormData()
    formData.append('avatar', file)
    setUploading(true)
    try {
      const res = await post<{ avatar: string }>('/auth/avatar/upload', formData)
      const next = res.data.avatar
      setAvatarUrl(next)
      setInfo((prev) => ({ ...prev, avatar: next }))
      setUser(syncAuthUser({ avatar: next }, user))
      toast.success('头像已更新')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '头像上传失败')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await put<AuthInfo>('/auth/update', {
        displayName: displayName.trim(),
        phone: phone.trim(),
      })
      const updated = syncAuthUser(res.data, user)
      setUser(updated)
      setInfo((prev) => ({ ...prev, ...res.data }))
      setDisplayName(updated.displayName || '')
      setPhone(res.data.phone || phone)
      toast.success('资料已保存')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const avatarSrc = mediaSrc(avatarUrl || user.avatar || '')

  return (
    <div className='space-y-8'>
      <div className='flex flex-wrap items-center gap-4'>
        <button
          type='button'
          className='group relative rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring'
          onClick={() => void onPickAvatar()}
          disabled={uploading}
        >
          <Avatar className='h-20 w-20 rounded-lg'>
            <AvatarImage src={avatarSrc} alt={name} />
            <AvatarFallback className='rounded-lg text-lg'>
              {fallback}
            </AvatarFallback>
          </Avatar>
          <span className='absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 opacity-0 transition group-hover:opacity-100'>
            {uploading ? (
              <Loader2 className='size-5 animate-spin text-white' />
            ) : (
              <Camera className='size-5 text-white' />
            )}
          </span>
        </button>
        <input
          ref={fileRef}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={(e) => void onAvatarFile(e)}
        />
        <div>
          <p className='text-lg font-semibold'>{name}</p>
          <p className='text-sm text-muted-foreground'>
            {user.username || user.accountNo}
          </p>
        </div>
      </div>

      <div className='grid max-w-xl gap-4'>
        <div className='grid gap-1.5'>
          <Label htmlFor='displayName'>显示名</Label>
          <Input
            id='displayName'
            value={displayName}
            placeholder='在界面中展示的名称'
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='phone'>手机号（可选）</Label>
          <Input
            id='phone'
            value={phone}
            placeholder='用于联系与验证'
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Button className='w-fit' disabled={saving} onClick={() => void save()}>
          <Save className='size-4' />
          {saving ? '保存中…' : '保存资料'}
        </Button>
      </div>

      <div className='max-w-xl'>
        <table className='w-full text-sm'>
          <tbody>
            {readOnly.map((row) => (
              <tr key={row.label} className='border-b last:border-b-0'>
                <th className='w-28 py-2.5 pr-6 text-left align-top font-normal text-muted-foreground'>
                  {row.label}
                </th>
                <td className='py-2.5 break-all'>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
