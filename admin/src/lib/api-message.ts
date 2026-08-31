const KEY_FALLBACKS: Record<string, string> = {
  'common.internal_error': '服务器内部错误',
  'common.operation_failed': '操作失败',
  'common.query_failed': '查询失败',
  'common.invalid_params': '请求参数无效',
  'common.not_found': '未找到',
  'common.unauthorized': '未授权',
  'common.forbidden': '禁止访问',
  'wechat_mp_article.not_found': '图文不存在',
  'wechat_mp_article.remote_list_failed': '拉取微信已发布图文失败',
  'wechat_mp_article.sync_failed': '同步微信草稿失败',
  'wechat_mp_article.publish_failed': '发布到微信失败',
  'wechat_mp_article.thumb_required': '请先上传封面图',
  'wechat_mp_article.cover_too_large': '封面图不能超过 2MB',
}

/** Format API error msg for admin display (server should localize; this is fallback). */
export function formatAdminApiMessage(msg?: string): string {
  if (!msg?.trim()) return '请求失败'
  const trimmed = msg.trim()
  if (/[\u4e00-\u9fff]/.test(trimmed)) return trimmed
  return KEY_FALLBACKS[trimmed] ?? trimmed
}
