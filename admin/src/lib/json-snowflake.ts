const SNOWFLAKE_FIELD_RE =
  /"(id|localId|userId|user_id|bookId|wordId)":\s*(\d{16,})/g

/** Parse API JSON while preserving snowflake IDs as strings (JS Number loses precision). */
export function parseApiJson<T = unknown>(text: string): T {
  const patched = text.replace(SNOWFLAKE_FIELD_RE, '"$1":"$2"')
  return JSON.parse(patched) as T
}
