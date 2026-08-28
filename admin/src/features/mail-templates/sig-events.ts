/** Template code → how it is triggered in the backend. */
export type TemplateTriggerKind = 'sig' | 'direct'

export type TemplateEventMeta = {
  /** common.Sig event name, e.g. user.create */
  sigEvent?: string
  sigLabel?: string
  trigger: TemplateTriggerKind
  /** When trigger is direct — where the mailer is called from. */
  directNote?: string
  sampleVars?: Record<string, unknown>
}

export const TEMPLATE_EVENT_BY_CODE: Record<string, TemplateEventMeta> = {
  welcome: {
    sigEvent: 'user.create',
    sigLabel: '用户注册',
    trigger: 'sig',
    sampleVars: { Username: '测试用户', VerifyURL: 'https://example.com/login' },
  },
  email_verification: {
    sigEvent: 'user.verifyemail',
    sigLabel: '邮箱验证',
    trigger: 'sig',
    sampleVars: {
      Username: '测试用户',
      VerifyURL: 'https://example.com/auth/verify-email?token=demo',
    },
  },
  password_reset: {
    sigEvent: 'user.resetpassword',
    sigLabel: '密码重置',
    trigger: 'sig',
    sampleVars: {
      Username: '测试用户',
      ResetURL: 'https://example.com/reset-password?token=demo',
    },
  },
  new_device_login: {
    sigEvent: 'user.newdevicelogin',
    sigLabel: '新设备登录',
    trigger: 'sig',
    sampleVars: {
      Username: '测试用户',
      LoginTime: '2026-08-19 22:00:00',
      IPAddress: '127.0.0.1',
      Location: '本地',
      DeviceType: 'desktop',
      OS: 'macOS',
      Browser: 'Chrome',
      DeviceLabel: '桌面端 · macOS · Chrome',
      IsSuspicious: false,
    },
  },
  login: {
    sigEvent: 'user.login',
    sigLabel: '用户登录',
    trigger: 'sig',
    sampleVars: {
      Username: '测试用户',
      LoginTime: '2026-08-19 22:00:00',
      IPAddress: '127.0.0.1',
    },
  },
  logout: {
    sigEvent: 'user.logout',
    sigLabel: '用户登出',
    trigger: 'sig',
    sampleVars: {
      Username: '测试用户',
      LogoutTime: '2026-08-19 22:05:00',
      IPAddress: '127.0.0.1',
    },
  },
  change_email: {
    sigEvent: 'user.changeemail',
    sigLabel: '更换邮箱',
    trigger: 'sig',
    sampleVars: {
      Username: '测试用户',
      NewEmail: 'new@example.com',
      VerifyURL: 'https://example.com/auth/change-email?token=demo',
    },
  },
  change_email_done: {
    sigEvent: 'user.changeemaildone',
    sigLabel: '更换邮箱完成',
    trigger: 'sig',
    sampleVars: {
      Username: '测试用户',
      OldEmail: 'old@example.com',
      NewEmail: 'new@example.com',
    },
  },
  verification: {
    trigger: 'direct',
    directNote: 'POST /auth/send/email 验证码（不经 Sig）',
    sampleVars: { Code: '123456' },
  },
  device_verification: {
    trigger: 'direct',
    directNote: 'Mailer.SendDeviceVerificationCode（不经 Sig）',
    sampleVars: { Username: '测试用户', Code: '654321', DeviceID: 'device-demo' },
  },
  group_invitation: {
    trigger: 'direct',
    directNote: 'Mailer.SendGroupInvitationEmail（不经 Sig）',
    sampleVars: {
      InviteeName: '受邀人',
      InviterName: '邀请人',
      GroupName: '示例团队',
      GroupType: 'team',
      GroupDescription: '团队简介',
      AcceptURL: 'https://example.com/invite/accept',
    },
  },
}

/** Sig events defined in backend but not wired to notification templates yet. */
export const UNBOUND_SIG_EVENTS: { event: string; label: string; note: string }[] =
  []

export function getTemplateEventMeta(code: string): TemplateEventMeta | undefined {
  return TEMPLATE_EVENT_BY_CODE[code.trim()]
}

export function formatTemplateTrigger(code: string): string {
  const meta = getTemplateEventMeta(code)
  if (!meta) return '—'
  if (meta.trigger === 'sig' && meta.sigEvent) {
    return meta.sigLabel ? `${meta.sigEvent}（${meta.sigLabel}）` : meta.sigEvent
  }
  return meta.directNote || '直接调用'
}

export function defaultVarsJSON(code: string): string {
  const meta = getTemplateEventMeta(code)
  if (!meta?.sampleVars) return '{}'
  try {
    return JSON.stringify(meta.sampleVars, null, 2)
  } catch {
    return '{}'
  }
}
