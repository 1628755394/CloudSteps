import { resolveMediaUrl } from './mediaUrl'

const MUTE_KEY = 'lb_audio_muted'
const MUTE_EVENT = 'lb-audio-muted'

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

let mutedCache = typeof window !== 'undefined' ? readMuted() : false

/** 当前是否静音（不播放单词音频） */
export function isAudioMuted(): boolean {
  return mutedCache
}

export function setAudioMuted(muted: boolean) {
  mutedCache = muted
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MUTE_EVENT, { detail: { muted } }))
  }
}

export function toggleAudioMuted(): boolean {
  setAudioMuted(!mutedCache)
  return mutedCache
}

export function subscribeAudioMuted(listener: (muted: boolean) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ muted: boolean }>).detail
    listener(detail?.muted ?? mutedCache)
  }
  window.addEventListener(MUTE_EVENT, handler)
  return () => window.removeEventListener(MUTE_EVENT, handler)
}

/**
 * 解析分号分隔的音频URL字符串，返回有效URL数组（压缩空槽，适合顺序轮播）。
 */
export function parseAudioUrls(audioUrl?: string | null): string[] {
  if (!audioUrl?.trim()) return []
  return audioUrl
    .split(';')
    .map(u => u.trim())
    .filter(Boolean)
    .map(u => resolveMediaUrl(u))
    .filter((u): u is string => u !== null)
}

/**
 * 按原始分号槽位解析（保留空位），保证「第 1/2/3 段」索引稳定。
 * 词库 TTS 约定：0=英文，1=英文，2=简译中文。
 */
export function parseAudioUrlSlots(audioUrl?: string | null): (string | null)[] {
  if (audioUrl == null) return []
  return String(audioUrl)
    .split(';')
    .map((u) => {
      const t = u.trim()
      if (!t) return null
      return resolveMediaUrl(t)
    })
}

/**
 * 仅播放单个音频URL
 * @returns 一个 abort 函数，调用可中断播放
 */
export function playSingleAudio(url: string, onDone?: () => void): () => void {
  if (mutedCache) {
    onDone?.()
    return () => {}
  }
  let aborted = false
  const audio = new Audio(url)

  const finish = () => {
    if (aborted) return
    onDone?.()
  }

  audio.onended = finish
  audio.onerror = () => {
    console.warn(`音频播放失败: ${url}`)
    finish()
  }
  audio.play().catch(finish)

  return () => {
    aborted = true
    audio.pause()
    onDone?.()
  }
}

/**
 * 记录每个音频串下一次要播放的索引，实现“每次点击播一个，下次播下一个”
 */
const nextAudioIndexByKey = new Map<string, number>()

/**
 * 便捷函数：解析 audioUrl 字符串并单次播放（跳过空槽轮播）
 * @returns abort 函数
 */
export function playWordAudio(
  audioUrl: string | undefined | null,
  _gapMs: number = 300,
  onDone?: () => void
): () => void {
  const urls = parseAudioUrls(audioUrl)
  if (urls.length === 0) {
    onDone?.()
    return () => {}
  }

  const key = urls.join(";")
  const nextIndex = nextAudioIndexByKey.get(key) ?? 0
  const index = ((nextIndex % urls.length) + urls.length) % urls.length
  const selectedUrl = urls[index]

  nextAudioIndexByKey.set(key, (index + 1) % urls.length)
  return playSingleAudio(selectedUrl, onDone)
}

/**
 * 播放指定槽位的音频（0-based，对应分号分隔的第几段；空槽不挪位冒充）
 * @returns abort 函数
 */
export function playAudioAtIndex(
  audioUrl: string | undefined | null,
  index: number,
  onDone?: () => void
): () => void {
  const slots = parseAudioUrlSlots(audioUrl)
  if (slots.length === 0 || index < 0 || index >= slots.length) {
    onDone?.()
    return () => {}
  }
  const direct = slots[index]
  if (!direct) {
    onDone?.()
    return () => {}
  }
  return playSingleAudio(direct, onDone)
}

/**
 * 播放第一个音频（槽位 0：单词一遍）
 */
export function playFirstWordAudio(
  audioUrl: string | undefined | null,
  onDone?: () => void
): () => void {
  const slots = parseAudioUrlSlots(audioUrl)
  const url = slots[0] || slots.find((u): u is string => !!u) || null
  if (!url) {
    onDone?.()
    return () => {}
  }
  const compact = parseAudioUrls(audioUrl)
  if (compact.length > 0) {
    nextAudioIndexByKey.set(compact.join(";"), compact.length > 1 ? 1 : 0)
  }
  return playSingleAudio(url, onDone)
}

/**
 * 播放第二个音频（槽位 1：英文）。没有第二段则回退第一段。
 */
export function playSecondWordAudio(
  audioUrl: string | undefined | null,
  onDone?: () => void
): () => void {
  const slots = parseAudioUrlSlots(audioUrl)
  const url = slots[1] || slots[0] || slots.find((u): u is string => !!u) || null
  if (!url) {
    onDone?.()
    return () => {}
  }
  const compact = parseAudioUrls(audioUrl)
  if (compact.length > 0) {
    nextAudioIndexByKey.set(compact.join(";"), 0)
  }
  return playSingleAudio(url, onDone)
}
