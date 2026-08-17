import { resolveMediaUrl } from './mediaUrl'

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
 * 词库 TTS 约定：0=单词一遍，1=单词三遍，2=单词+中文。
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
 * 播放第二个音频（槽位 1：单词三遍）。没有第二段则回退第一段。
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
