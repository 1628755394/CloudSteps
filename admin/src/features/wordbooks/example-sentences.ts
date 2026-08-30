export type ExampleSentence = {
  en: string
  cn: string
  para: string
  pos: string
}

export function parseExampleSentences(
  raw: string | undefined
): ExampleSentence[] | null {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.flatMap((item) => {
      if (typeof item === 'string') {
        const en = item.trim()
        return en ? [{ en, cn: '', para: '', pos: '' }] : []
      }
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const en = String(row.en ?? row.sentence ?? '')
      const cn = String(row.cn ?? row.zh ?? '')
      const para = String(row.para ?? '')
      const pos = String(row.pos ?? '')
      if (!en.trim() && !cn.trim()) return []
      return [{ en, cn, para, pos }]
    })
  } catch {
    return null
  }
}

export function splitHighlightedText(
  text: string
): Array<{ text: string; highlight: boolean }> {
  const parts: Array<{ text: string; highlight: boolean }> = []
  const re = /<(b|strong)>(.*?)<\/\1>/gi
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index), highlight: false })
    }
    parts.push({ text: match[2] ?? '', highlight: true })
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), highlight: false })
  }
  return parts.length > 0 ? parts : [{ text, highlight: false }]
}
