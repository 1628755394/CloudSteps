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
