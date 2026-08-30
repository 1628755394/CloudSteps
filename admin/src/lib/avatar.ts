import { mediaSrc } from '@/features/wordbooks/word-audio'

export const DEFAULT_TEACHER_AVATAR = `${import.meta.env.BASE_URL}default-teacher-avatar.png`

export function teacherAvatarSrc(avatar?: string | null): string {
  const src = avatar?.trim()
  return src ? mediaSrc(src) : DEFAULT_TEACHER_AVATAR
}
