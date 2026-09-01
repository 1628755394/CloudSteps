const SNOWFLAKE_FIELD_RE =
  /"(id|localId|userId|user_id|studentId|bookId|wordId|wordBookId|appointmentId|sessionId|recordId|teacherId)":\s*(\d{16,})/g

/** Parse API JSON while preserving snowflake IDs as strings (JS Number loses precision). */
export function parseApiJson<T = unknown>(text: string): T {
  const patched = text.replace(SNOWFLAKE_FIELD_RE, '"$1":"$2"')
  return JSON.parse(patched) as T
}

/** Normalize a snowflake / large numeric ID for URLs and API payloads. Never use Number(). */
export function normalizeSnowflakeId(raw: string | number | null | undefined): string {
  if (raw == null) return ""
  const text = String(raw).trim()
  if (!text || text === "0") return ""
  return text
}

export function isValidSnowflakeId(raw: string | number | null | undefined): boolean {
  const id = normalizeSnowflakeId(raw)
  return /^\d+$/.test(id)
}

export function sameSnowflakeId(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  const left = normalizeSnowflakeId(a)
  const right = normalizeSnowflakeId(b)
  return left !== "" && left === right
}
