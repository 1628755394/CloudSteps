/** Replace Go template placeholders {{.Var}} with sample values for admin preview. */
export function applySampleVars(
  src: string,
  vars: Record<string, unknown> | undefined
): string {
  if (!src) return ''
  return src.replace(/\{\{\s*\.?([A-Za-z_][\w]*)\s*\}\}/g, (_, key: string) => {
    if (!vars || !(key in vars)) return `{{.${key}}}`
    const v = vars[key]
    if (v == null) return ''
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    return String(v)
  })
}
