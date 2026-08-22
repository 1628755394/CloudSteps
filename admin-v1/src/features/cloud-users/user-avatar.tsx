import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { mediaSrc } from '@/features/wordbooks/word-audio'
import { userDisplayName, userInitials, type CloudUser } from './user-display'

type UserAvatarProps = {
  user: CloudUser
  className?: string
}

export function UserAvatar({ user, className }: UserAvatarProps) {
  const src = user.avatar ? mediaSrc(user.avatar) : ''
  const name = userDisplayName(user)
  const deleted = user.isDeleted === true

  return (
    <div className='relative inline-block'>
      <Avatar className={className}>
        {src ? <AvatarImage src={src} alt={name} /> : null}
        <AvatarFallback>{userInitials(user)}</AvatarFallback>
      </Avatar>
      {deleted ? (
        <span
          className='pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-destructive/60 text-[8px] font-bold text-white uppercase tracking-wide'
          style={{ fontSize: 'clamp(7px, 30%, 10px)' }}
        >
          已注销
        </span>
      ) : null}
    </div>
  )
}
