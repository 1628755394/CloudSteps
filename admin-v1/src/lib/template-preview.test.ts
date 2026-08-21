import { describe, expect, it } from 'vitest'
import { applySampleVars } from './template-preview'

describe('applySampleVars', () => {
  it('replaces Go template placeholders', () => {
    const out = applySampleVars('Hi {{.Username}} at {{.LoginTime}}', {
      Username: 'Alice',
      LoginTime: '10:00',
    })
    expect(out).toBe('Hi Alice at 10:00')
  })

  it('keeps unknown placeholders', () => {
    expect(applySampleVars('{{.Missing}}', {})).toBe('{{.Missing}}')
  })
})
