/**
 * 将 translation 字段（可能是 JSON 数组字符串如 ["你好","世界"]）转为可读文本。
 * 后端 Word.Translation 存储为 JSON 数组字符串，前端直接显示会带方括号和引号。
 */
export function formatTranslation(raw?: string | null): string {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.join("；");
    return String(arr);
  } catch {
    return raw;
  }
}

/** 简译：只取第一条释义 */
export function formatTranslationShort(raw?: string | null): string {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0) return String(arr[0] ?? "");
    return String(arr);
  } catch {
    const parts = raw.split(/[；;，,\n]/).map((s) => s.trim()).filter(Boolean);
    return parts[0] || raw;
  }
}

export function pickPhoneticDisplay(w: {
  phonetic?: string;
  phoneticUk?: string;
  phoneticUs?: string;
}): string {
  const p = w.phoneticUk || w.phoneticUs || w.phonetic || "";
  return p ? `/${p.replace(/^\[|\]$/g, "").replace(/^\//, "").replace(/\/$/, "")}/` : "";
}
