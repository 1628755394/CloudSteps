import { post } from '@/lib/api'
import { sleep } from '@/lib/utils'

const TTS_REQUEST_GAP_MS = Math.max(
  0,
  Number(import.meta.env.VITE_TTS_REQUEST_GAP_MS ?? 8) || 8
)

export function pickChineseGloss(word: string, translation?: string): string {
  if (!translation?.trim()) return word
  try {
    const parsed: unknown = JSON.parse(translation)
    const first = Array.isArray(parsed) ? String(parsed[0] ?? '') : translation
    return first.replace(/^[a-z]+\.\s*/i, '').trim() || word
  } catch {
    return translation.replace(/^[a-z]+\.\s*/i, '').trim() || word
  }
}

export function buildWordAudioTexts(
  word: string,
  translation?: string
): string[] {
  const w = word.trim()
  const zh = pickChineseGloss(w, translation)
  return [w, `${w} ${w} ${w}`, `${w} ${w} ${zh}`]
}

export async function generateWordAudioUrls(
  word: string,
  translation?: string
): Promise<string> {
  const texts = buildWordAudioTexts(word, translation)
  const urls: string[] = []
  for (let i = 0; i < texts.length; i++) {
    const res = await post<{ url: string }>('/admin/tts', { text: texts[i] })
    if (!res.data?.url) {
      throw new Error(res.msg || 'TTS 失败')
    }
    urls.push(res.data.url)
    if (i < texts.length - 1) await sleep(TTS_REQUEST_GAP_MS)
  }
  return urls.join(';')
}
