import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { type Word } from './types'
import { WordMutateDrawer } from './word-mutate-drawer'

const getMock = vi.hoisted(() => vi.fn())
const putMock = vi.hoisted(() => vi.fn())
const postMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({
  get: getMock,
  put: putMock,
  post: postMock,
}))

const WORD: Word = {
  id: 42,
  word: 'apple',
  phonetic: '/ˈæpl/',
  translation: '["n. 苹果"]',
  audioUrl: '/uploads/a.mp3;/uploads/b.mp3;/uploads/c.mp3',
  exampleSentence: 'I ate an apple.',
}

describe('WordMutateDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({ code: 200, data: WORD })
  })

  it('opens an edit drawer with word fields and audio previews', async () => {
    const { getByRole, getByLabelText } = await render(
      <WordMutateDrawer
        open
        onOpenChange={vi.fn()}
        bookId='1255'
        word={WORD}
        onSaved={vi.fn()}
      />
    )

    await expect
      .element(getByRole('heading', { name: '编辑单词' }))
      .toBeInTheDocument()
    await expect.element(getByLabelText('单词 *')).toHaveValue('apple')
    await expect
      .element(getByLabelText('释义（JSON 数组或文本）'))
      .toHaveValue('["n. 苹果"]')

    const preview = getByLabelText('单词 预览')
    await expect.element(preview).toBeInTheDocument()
    await expect.element(preview).toHaveAttribute('src', '/uploads/a.mp3')

    await vi.waitFor(() => expect(getMock).toHaveBeenCalledWith('/words/42'))
  })

  it('opens a create drawer without audio players', async () => {
    const { getByRole, getByText } = await render(
      <WordMutateDrawer
        open
        onOpenChange={vi.fn()}
        bookId='1255'
        word={null}
        onSaved={vi.fn()}
      />
    )

    await expect
      .element(getByRole('heading', { name: '添加单词' }))
      .toBeInTheDocument()
    await expect.element(getByText(/暂无音频/)).toBeInTheDocument()
    expect(getMock).not.toHaveBeenCalled()
  })
})
