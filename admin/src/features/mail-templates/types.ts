export type NotificationTemplateType = 'email' | 'inbox'

export type NotificationTemplate = {
  id: number
  code: string
  name: string
  channelType: NotificationTemplateType
  subject?: string
  htmlBody?: string
  inboxTitle?: string
  inboxBody?: string
  textBody?: string
  description?: string
  variables?: string
  locale?: string
  enabled: boolean
}

export type NotificationTemplateUpsertReq = {
  code?: string
  name: string
  channelType?: NotificationTemplateType
  subject?: string
  htmlBody?: string
  inboxTitle?: string
  inboxBody?: string
  description?: string
  variables?: string
  locale?: string
  enabled?: boolean
}

export function channelTypeLabel(type?: string): string {
  return type === 'inbox' ? '站内信' : '邮件'
}

export function previewHtml(html: string): string {
  if (!html) return ''
  return html.replace(
    /\{\{\s*\.?([A-Za-z_][\w]*)\s*\}\}/g,
    (_, name: string) =>
      `<span style="background:#fffbe6;border:1px dashed #faad14;padding:0 2px;border-radius:2px;">{{.${name}}}</span>`
  )
}

/** @deprecated use NotificationTemplate */
export type MailTemplate = NotificationTemplate

/** @deprecated use NotificationTemplateUpsertReq */
export type MailTemplateUpsertReq = NotificationTemplateUpsertReq
