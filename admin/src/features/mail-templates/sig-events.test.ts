import { describe, expect, it } from 'vitest'
import { formatTemplateTrigger, getTemplateEventMeta } from './sig-events'

describe('sig-events', () => {
  it('maps welcome to user.create', () => {
    expect(formatTemplateTrigger('welcome')).toContain('user.create')
  })

  it('maps login to user.login', () => {
    expect(formatTemplateTrigger('login')).toContain('user.login')
  })

  it('marks verification as direct call', () => {
    expect(getTemplateEventMeta('verification')?.trigger).toBe('direct')
    expect(formatTemplateTrigger('verification')).toContain('/auth/send/email')
  })
})
