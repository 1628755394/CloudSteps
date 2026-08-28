/** Map backend auth/captcha/register errors to user-facing Chinese messages. */

const EXACT_MAP: Record<string, string> = {
  'username has exists': '该账号已存在，请换一个用户名',
  'username already exists': '该账号已存在，请换一个用户名',
  'email has exists': '该邮箱已被注册，请直接登录或换一个邮箱',
  'email exists, please use another email': '该邮箱已被注册，请直接登录或换一个邮箱',
  'email already bound': '该邮箱已被其他账号绑定',
  'user not exists': '账号不存在',
  'user not found': '账号不存在',
  unauthorized: '账号或密码错误',
  'login failed': '登录失败，请检查账号和密码',
  'user no authorization to login': '该账号暂不可登录，请联系管理员',
  'user not allow login': '该账号暂不可登录，请联系管理员',
  'user not allow signup': '当前暂不开放注册',
  'user not activated': '账号未激活',
  'empty password': '请输入密码',
  'empty email': '请输入邮箱',
  'email required': '请输入邮箱',
  'invalid email format': '邮箱格式不正确',
  'email domain is not allowed': '不支持该邮箱域名',
  'disposable email addresses are not allowed': '不支持临时邮箱，请使用常用邮箱',
  'invalid verification code': '验证码错误或已过期',
  'invalid or expired code': '验证码错误或已过期',
  'invalid captcha': '验证码错误，请重新输入',
  'captcha is required': '请完成图形验证码',
  'old password is required': '请输入原密码',
  'new password is required': '请输入新密码',
  'password too short': '密码至少 6 位',
  'confirm password mismatch': '两次输入的密码不一致',
  'token required': '登录已失效，请重新登录',
  'invalid token': '登录已失效，请重新登录',
  'bad token': '登录已失效，请重新登录',
  'token expired': '登录已过期，请重新登录',
  forbidden: '没有权限执行此操作',
  'forbidden access': '没有权限执行此操作',
  'Too many requests; please try again later': '请求过于频繁，请稍后再试',
}

const PATTERN_MAP: Array<{ re: RegExp; msg: string }> = [
  { re: /username has exists/i, msg: '该账号已存在，请换一个用户名' },
  { re: /username already exists/i, msg: '该账号已存在，请换一个用户名' },
  { re: /email has exists/i, msg: '该邮箱已被注册，请直接登录或换一个邮箱' },
  { re: /email exists/i, msg: '该邮箱已被注册，请直接登录或换一个邮箱' },
  { re: /email already bound/i, msg: '该邮箱已被其他账号绑定' },
  { re: /user not exists/i, msg: '账号不存在' },
  { re: /user not found/i, msg: '账号不存在' },
  { re: /unauthorized/i, msg: '账号或密码错误' },
  { re: /login failed/i, msg: '登录失败，请检查账号和密码' },
  { re: /not allow login/i, msg: '该账号暂不可登录，请联系管理员' },
  { re: /no authorization to login/i, msg: '该账号暂不可登录，请联系管理员' },
  { re: /not allow signup/i, msg: '当前暂不开放注册' },
  { re: /not activated/i, msg: '账号未激活' },
  { re: /invalid captcha/i, msg: '验证码错误，请重新输入' },
  { re: /captcha is required/i, msg: '请完成图形验证码' },
  { re: /invalid verification code/i, msg: '验证码错误或已过期' },
  { re: /invalid or expired/i, msg: '验证码错误或已过期' },
  { re: /invalid email format/i, msg: '邮箱格式不正确' },
  { re: /账号至少|username.*(too short|min)/i, msg: '账号至少 2 个字符' },
  { re: /账号过长|username.*(too long|max)/i, msg: '账号过长' },
  { re: /长度不符合要求/i, msg: '长度不符合要求' },
  { re: /\bmin:2\b/i, msg: '账号至少 2 个字符' },
  { re: /\bmax:30\b/i, msg: '账号过长' },
  { re: /email domain is not allowed/i, msg: '不支持该邮箱域名' },
  { re: /disposable email/i, msg: '不支持临时邮箱，请使用常用邮箱' },
  { re: /registration rate limit/i, msg: '注册过于频繁，请稍后再试' },
  { re: /too many failed registration/i, msg: '失败次数过多，请稍后再试' },
  { re: /blacklisted/i, msg: '当前网络环境暂不可注册' },
  { re: /password must be at least/i, msg: '密码至少 6 位' },
  { re: /password must contain at least one uppercase/i, msg: '密码需包含大写字母' },
  { re: /password must contain at least one lowercase/i, msg: '密码需包含小写字母' },
  { re: /password must contain at least one number/i, msg: '密码需包含数字' },
  { re: /password must contain at least one special/i, msg: '密码需包含特殊字符' },
  { re: /password too short/i, msg: '密码至少 6 位' },
  { re: /too many requests/i, msg: '请求过于频繁，请稍后再试' },
  { re: /rate limit/i, msg: '请求过于频繁，请稍后再试' },
  { re: /token expired|invalid token|bad token|token required/i, msg: '登录已失效，请重新登录' },
]

/** Strip optional `file.go:123: ` prefixes from AbortWithJSONError. */
function normalizeAuthError(msg: string): string {
  const trimmed = msg.trim()
  const m = trimmed.match(/^[A-Za-z0-9_./\\-]+:\d+:\s*(.+)$/)
  return m?.[1]?.trim() || trimmed
}

export function formatAuthErrorMessage(msg?: string, fallback = '请求失败'): string {
  if (!msg?.trim()) return fallback

  const normalized = normalizeAuthError(msg)
  const lower = normalized.toLowerCase()

  // Already Chinese — keep as-is.
  if (/[\u4e00-\u9fff]/.test(normalized)) {
    return normalized
  }

  if (EXACT_MAP[normalized] || EXACT_MAP[lower]) {
    return EXACT_MAP[normalized] || EXACT_MAP[lower]
  }

  for (const { re, msg: mapped } of PATTERN_MAP) {
    if (re.test(normalized)) return mapped
  }

  return normalized || fallback
}
