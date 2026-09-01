export type ReadingOption = { key: string; text: string }

export type ReadingQuestionRow = {
  id?: number
  stem: string
  options: ReadingOption[]
  answer: string
  explanation?: string
  sortOrder?: number
}

export type QuestionForm = {
  clientId: string
  stem: string
  options: Record<'A' | 'B' | 'C' | 'D', string>
  answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

export function emptyQuestion(): QuestionForm {
  return {
    clientId: crypto.randomUUID(),
    stem: '',
    options: { A: '', B: '', C: '', D: '' },
    answer: 'A',
    explanation: '',
  }
}

export function fromApiQuestion(q: ReadingQuestionRow): QuestionForm {
  const options = { A: '', B: '', C: '', D: '' } as QuestionForm['options']
  for (const o of q.options || []) {
    const k = o.key?.toUpperCase()
    if (k === 'A' || k === 'B' || k === 'C' || k === 'D') options[k] = o.text
  }
  const ans = (q.answer?.toUpperCase() || 'A') as QuestionForm['answer']
  return {
    clientId: q.id ? String(q.id) : crypto.randomUUID(),
    stem: q.stem || '',
    options,
    answer: OPTION_KEYS.includes(ans) ? ans : 'A',
    explanation: q.explanation || '',
  }
}

export function toApiQuestions(forms: QuestionForm[]) {
  return forms
    .map((q, i) => {
      const stem = q.stem.trim()
      if (!stem) return null
      const options = OPTION_KEYS.map((key) => ({
        key,
        text: q.options[key].trim(),
      })).filter((o) => o.text)
      if (options.length < 2) return null
      if (!options.some((o) => o.key === q.answer)) return null
      return {
        stem,
        options,
        answer: q.answer,
        explanation: q.explanation.trim(),
        sortOrder: i + 1,
      }
    })
    .filter(Boolean)
}
