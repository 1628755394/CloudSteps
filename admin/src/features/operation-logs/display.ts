export type OperationLog = {
  id: number
  user_id?: number
  username?: string
  action?: string
  target?: string
  details?: string
  ip_address?: string
  user_agent?: string
  referer?: string
  device?: string
  browser?: string
  operating_system?: string
  location?: string
  request_method?: string
  created_at?: string
}

export function httpMethod(log: OperationLog): string {
  return (log.request_method || log.action || '').toUpperCase()
}

export function methodVariant(
  method?: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch ((method || '').toUpperCase()) {
    case 'POST':
      return 'default'
    case 'PUT':
    case 'PATCH':
      return 'secondary'
    case 'DELETE':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function operationTitle(log: OperationLog): string {
  return log.details?.trim() || httpMethod(log) || '操作记录'
}

export function shortPath(path?: string): string {
  const value = path?.trim()
  if (!value) return '—'
  return value.length > 42 ? `…${value.slice(-41)}` : value
}

export function clientSummary(log: OperationLog): string {
  return (
    [log.browser, log.operating_system, log.device]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' · ') || '—'
  )
}

export function operatorLabel(log: OperationLog): string {
  return log.username?.trim() || (log.user_id ? `用户 #${log.user_id}` : '—')
}
