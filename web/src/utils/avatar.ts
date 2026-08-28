import { resolveMediaUrl } from "./mediaUrl";

export const DEFAULT_TEACHER_AVATAR = `${import.meta.env.BASE_URL}default-teacher-avatar.png`;

export function teacherAvatarSrc(avatar?: string | null): string {
  return resolveMediaUrl(avatar) || DEFAULT_TEACHER_AVATAR;
}
