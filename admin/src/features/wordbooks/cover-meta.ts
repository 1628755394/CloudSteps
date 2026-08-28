/** 词库 description 中的封面元数据（与学员端 parseCover 一致） */
export type CoverMeta = {
  tag: string
  t1: string
  t2: string
  cat: string
}

export type CoverMetaParseResult = {
  meta: CoverMeta | null
  plainText: string
}

export type WordBookEditForm = {
  name: string
  level: string
  coverTag: string
  coverT1: string
  coverT2: string
  coverCat: string
  notes: string
}

export const emptyWordBookForm = (): WordBookEditForm => ({
  name: '',
  level: 'A1',
  coverTag: '',
  coverT1: '',
  coverT2: '',
  coverCat: '',
  notes: '',
})

export function parseCoverMeta(description?: string): CoverMetaParseResult {
  const raw = (description || '').trim()
  if (!raw) {
    return { meta: null, plainText: '' }
  }
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw) as Partial<CoverMeta>
      if (obj && (obj.t1 || obj.t2 || obj.tag || obj.cat)) {
        return {
          meta: {
            tag: String(obj.tag || '').trim(),
            t1: String(obj.t1 || '').trim(),
            t2: String(obj.t2 || '').trim(),
            cat: String(obj.cat || '').trim(),
          },
          plainText: '',
        }
      }
    } catch {
      // fall through
    }
  }
  return { meta: null, plainText: raw }
}

export function buildDescriptionFromForm(form: WordBookEditForm): string {
  const tag = form.coverTag.trim()
  const t1 = form.coverT1.trim()
  const t2 = form.coverT2.trim()
  const cat = form.coverCat.trim()
  if (tag || t1 || t2 || cat) {
    return JSON.stringify({ tag, t1, t2, cat })
  }
  return form.notes.trim()
}

export function wordBookToForm(
  book: { name: string; description?: string; level?: string }
): WordBookEditForm {
  const { meta, plainText } = parseCoverMeta(book.description)
  return {
    name: book.name,
    level: book.level || 'A1',
    coverTag: meta?.tag || '',
    coverT1: meta?.t1 || '',
    coverT2: meta?.t2 || '',
    coverCat: meta?.cat || '',
    notes: plainText,
  }
}
