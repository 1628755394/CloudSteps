import i18n from '../i18n'
import type { CustomReadingImportPassage } from '../api/customReading'
import type { ReadingOption } from '../api/reading'

type ExcelRow = Record<string, string>

function cell(row: ExcelRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]?.trim()
    if (v) return v
  }
  return ''
}

function buildOptions(row: ExcelRow): ReadingOption[] {
  const opts: ReadingOption[] = []
  for (const key of ['A', 'B', 'C', 'D'] as const) {
    const text = cell(
      row,
      key,
      key.toLowerCase(),
      `option_${key.toLowerCase()}`,
      `option${key}`,
      `选项${key}`,
      `选项 ${key}`,
    )
    if (text) opts.push({ key, text })
  }
  return opts
}

function resolvePassage(
  map: Map<string, CustomReadingImportPassage>,
  row: ExcelRow,
): CustomReadingImportPassage | null {
  const title = cell(row, '文章标题', 'title', 'Title', '标题')
  if (!title) return null

  const existing = map.get(title)
  if (existing) return existing

  const content = cell(row, '正文', 'content', 'Content', '文章内容')
  if (!content) return null

  const p: CustomReadingImportPassage = {
    title,
    level: cell(row, '难度', 'level', 'Level', '等级') || '初阶',
    summary: cell(row, '摘要', 'summary', 'Summary'),
    content,
    questions: [],
  }
  map.set(title, p)
  return p
}

function appendQuestionFromRow(p: CustomReadingImportPassage, row: ExcelRow): boolean {
  const stem = cell(row, '题干', 'stem', 'Stem', 'question', '题目')
  const answer = cell(row, '答案', 'answer', 'Answer').toUpperCase()
  if (!stem || !answer) return false
  const options = buildOptions(row)
  if (options.length < 2) return false
  if (!options.some((o) => o.key === answer)) return false
  p.questions.push({
    stem,
    options,
    answer,
    explanation: cell(row, '解析', 'explanation', 'Explanation'),
    sortOrder: p.questions.length + 1,
  })
  return true
}

/** 解析 Excel：优先单 sheet（每行一题，文章信息可重复）；兼容 passages + questions 双 sheet */
export async function parseCustomReadingExcel(file: File): Promise<CustomReadingImportPassage[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })

  const passageMap = new Map<string, CustomReadingImportPassage>()

  // 1) 单 sheet：含「题干」列则按行解析
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' })
    const hasQuestionCol = rows.some((row) => cell(row, '题干', 'stem', 'Stem', '题目'))
    if (!hasQuestionCol) continue

    for (const row of rows) {
      const p = resolvePassage(passageMap, row)
      if (p) appendQuestionFromRow(p, row)
    }
  }

  const singleSheetResult = [...passageMap.values()].filter((p) => p.questions.length > 0)
  if (singleSheetResult.length > 0) return singleSheetResult

  // 2) 双 sheet：passages + questions
  passageMap.clear()
  const passageSheet =
    wb.Sheets['passages'] || wb.Sheets['Passages'] || wb.Sheets['文章'] || wb.Sheets[wb.SheetNames[0]]
  if (passageSheet) {
    const passageRows = XLSX.utils.sheet_to_json<ExcelRow>(passageSheet, { defval: '' })
    for (const row of passageRows) {
      resolvePassage(passageMap, row)
    }
  }

  const questionSheet =
    wb.Sheets['questions'] || wb.Sheets['Questions'] || wb.Sheets['题目'] || wb.Sheets[wb.SheetNames[1]]
  if (questionSheet) {
    const qRows = XLSX.utils.sheet_to_json<ExcelRow>(questionSheet, { defval: '' })
    for (const row of qRows) {
      const passageTitle = cell(
        row,
        '文章标题',
        'passage_title',
        'passageTitle',
        'title',
        'Title',
        '标题',
      )
      const p = passageMap.get(passageTitle)
      if (p) appendQuestionFromRow(p, row)
    }
  }

  return [...passageMap.values()].filter((p) => p.questions.length > 0)
}

export async function downloadCustomReadingTemplateLocal() {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // 单 sheet 模板：每行一题，文章信息写在首行即可，后续行可只填题干/选项
  const rows = [
    {
      文章标题: '示例文章 My Passage',
      难度: '初阶',
      摘要: '这是一篇示例阅读理解',
      正文: 'This is a sample reading passage. You can replace this with your own text.',
      题干: 'What is this passage?',
      选项A: 'A sample',
      选项B: 'A novel',
      选项C: 'A poem',
      选项D: 'A recipe',
      答案: 'A',
      解析: 'The template marks it as a sample.',
    },
    {
      文章标题: '示例文章 My Passage',
      难度: '',
      摘要: '',
      正文: '',
      题干: 'Which level is used in the first row?',
      选项A: '高阶',
      选项B: '中阶',
      选项C: '初阶',
      选项D: '未知',
      答案: 'C',
      解析: '第一行难度为初阶。',
    },
  ]

  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 22 },
    { wch: 8 },
    { wch: 20 },
    { wch: 40 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 6 },
    { wch: 24 },
  ]
  XLSX.utils.book_append_sheet(wb, sheet, '阅读理解')
  XLSX.writeFile(wb, i18n.t('custom_reading.template_filename'))
}

export type QuestionDraft = {
  id: string
  stem: string
  options: Record<'A' | 'B' | 'C' | 'D', string>
  answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

export function emptyQuestion(): QuestionDraft {
  return {
    id: crypto.randomUUID(),
    stem: '',
    options: { A: '', B: '', C: '', D: '' },
    answer: 'A',
    explanation: '',
  }
}

export function draftToImportPassage(
  title: string,
  level: string,
  summary: string,
  content: string,
  questions: QuestionDraft[],
): CustomReadingImportPassage | null {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()
  if (!trimmedTitle || !trimmedContent) return null

  const parsedQuestions = questions
    .map((q, i) => {
      const stem = q.stem.trim()
      if (!stem) return null
      const options = (['A', 'B', 'C', 'D'] as const)
        .map((key) => ({ key, text: q.options[key].trim() }))
        .filter((o) => o.text)
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
    .filter(Boolean) as CustomReadingImportPassage['questions']

  if (parsedQuestions.length === 0) return null

  return {
    title: trimmedTitle,
    level: level || '初阶',
    summary: summary.trim(),
    content: trimmedContent,
    questions: parsedQuestions,
  }
}
