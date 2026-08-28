export type NotificationChannel = {
  id: number
  type: string
  code?: string
  name: string
  sortOrder: number
  enabled: boolean
  remark?: string
  configJson?: string
}

export type EmailChannelForm = {
  driver: 'smtp' | 'sendcloud'
  smtpHost?: string
  smtpPort?: number
  smtpUsername?: string
  smtpFrom?: string
  fromDisplayName?: string
  smtpPasswordSet?: boolean
  sendcloudApiUser?: string
  sendcloudApiKeySet?: boolean
  sendcloudFrom?: string
}

export type UpsertChannelReq = {
  channelType: 'email'
  name: string
  sortOrder?: number
  enabled?: boolean
  remark?: string
  driver?: 'smtp' | 'sendcloud'
  smtpHost?: string
  smtpPort?: number
  smtpUsername?: string
  smtpPassword?: string
  smtpFrom?: string
  sendcloudApiUser?: string
  sendcloudApiKey?: string
  sendcloudFrom?: string
  fromDisplayName?: string
}
