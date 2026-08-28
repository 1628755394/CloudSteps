/** Map backend auth/captcha errors to user-facing Chinese messages. */
export function formatAuthErrorMessage(msg?: string, fallback = '请求失败'): string {
  if (!msg?.trim()) return fallback
  const m = msg.trim()
  if (/invalid captcha/i.test(m)) return '验证码错误，请重新输入'
  if (/captcha is required/i.test(m)) return '请完成图形验证码'
  return m
}
