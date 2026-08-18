export type AudioUrlParts = [string, string, string]

export const AUDIO_SLOT_LABELS = ['单词', '连读', '英+中'] as const

function audioDedupKey(url: string): string {
  const u = url.trim().toLowerCase().split('?')[0] ?? ''
  for (const suffix of ['_uk.mp3', '_us.mp3', '_uk.wav', '_us.wav']) {
    if (u.endsWith(suffix)) return u.slice(0, -suffix.length)
  }
  return u
}

export function splitAudioUrls(audioUrl: string | undefined): AudioUrlParts {
  const parts = (audioUrl || '').split(';').map((s) => s.trim())
  return [parts[0] || '', parts[1] || '', parts[2] || '']
}

export function joinAudioUrls(parts: AudioUrlParts): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = (p || '').trim()
    if (!t) {
      out.push('')
      continue
    }
    const key = audioDedupKey(t)
    if (seen.has(key)) {
      out.push('')
      continue
    }
    seen.add(key)
    out.push(t)
  }
  while (out.length > 0 && !out[out.length - 1]?.trim()) {
    out.pop()
  }
  return out.join(';')
}

export function mediaSrc(url: string): string {
  const t = url.trim()
  if (!t) return ''
  if (/^(https?:|blob:|data:)/i.test(t)) return t
  return t.startsWith('/') ? t : `/${t}`
}
