/**
 * 管理端 TTS：走后端 /api/admin/tts（腾讯云 TTS，与 cmd/tts-gen 同源）。
 */
import { post } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'

/** 同一单词内，连续多次 TTS 请求之间的间隔（默认 8ms） */
export const TTS_REQUEST_GAP_MS = Math.max(
  0,
  Number(import.meta.env.VITE_TTS_REQUEST_GAP_MS ?? 8) || 8
)

/** 批量模式下，处理完一个单词后的间隔（默认 8ms） */
export const TTS_WORD_GAP_MS = Math.max(
  0,
  Number(import.meta.env.VITE_TTS_WORD_GAP_MS ?? 8) || 8
)

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchTTS(text: string): Promise<string> {
  const res = await post<{ url: string }>(`${getApiBaseURL()}/admin/tts`, {
    text: text.trim(),
  })
  if (res.code !== 200 || !res.data?.url) {
    throw new Error(res.msg || 'TTS 失败')
  }
  return res.data.url
}

/** 从释义字段提取中文，用于第三条音频 */
export function pickChineseGloss(word: string, translation?: string): string {
  if (!translation?.trim()) return word
  try {
    const arr = JSON.parse(translation)
    const first: string = Array.isArray(arr) ? arr[0] : translation
    return first.replace(/^[a-z]+\.\s*/i, '').trim() || word
  } catch {
    return translation.replace(/^[a-z]+\.\s*/i, '').trim() || word
  }
}

/** 三条音频对应的朗读文本 */
export function buildWordAudioTexts(word: string, translation?: string): string[] {
  const w = word.trim()
  const zh = pickChineseGloss(w, translation)
  return [w, `${w} ${w} ${w}`, `${w} ${w} ${zh}`]
}

/** 为单个单词生成 3 段音频 URL（; 拼接） */
export async function generateWordAudioUrls(
  word: string,
  translation?: string
): Promise<string> {
  const texts = buildWordAudioTexts(word, translation)
  const urls: string[] = []
  for (let i = 0; i < texts.length; i++) {
    urls.push(await fetchTTS(texts[i]))
    if (i < texts.length - 1) await sleep(TTS_REQUEST_GAP_MS)
  }
  return urls.join(';')
}
