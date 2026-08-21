import { previewHtml } from './types'

describe('previewHtml', () => {
  it('highlights go template placeholders', () => {
    expect(previewHtml('Hi {{.Username}}')).toContain('{{.Username}}')
    expect(previewHtml('Hi {{Username}}')).toContain('{{.Username}}')
    expect(previewHtml('')).toBe('')
  })
})
