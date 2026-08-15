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

/**
 * 简译：每个词性只取第一个释义，去掉英文释义只保留中文。
 * 例：["adj. incorrect 不正确的；有误的", "n. mistake 错误；过失"]
 * → "adj. 不正确的；n. 错误"
 */
export function formatTranslationShort(raw?: string | null): string {
  if (!raw) return "";
  let items: string[] = [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      items = arr.map((x) => String(x ?? "").trim()).filter(Boolean);
    } else {
      items = [String(arr)];
    }
  } catch {
    items = raw
      .split(/\n|；|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (items.length === 0) return "";

  return items
    .map((item) => {
      const posMatch = item.match(/^([a-zA-Z]+\.?)\s+(.+)$/);
      if (posMatch) {
        const pos = posMatch[1].replace(/\.$/, "");
        const rest = posMatch[2];
        // 取中文片段（去掉英文释义），保留词性
        const zh = rest
          .replace(/[a-zA-Z][a-zA-Z\s\-']*/g, " ")
          .replace(/[；;，,]/g, "；")
          .replace(/\s+/g, " ")
          .replace(/^；|；$/g, "")
          .trim();
        // 简译：只取第一个释义（按；/，/, 分割）
        const firstZh = (zh || rest).split(/[；;，,]/)[0]?.trim() || (zh || rest).trim();
        return `${pos}. ${firstZh}`;
      }
      // 无词性：只取第一个释义
      const first = item.split(/[；;，,]/)[0]?.trim() || item;
      return first;
    })
    .join("；");
}

/** 若释义文本已含词性，则不再重复拼接 partOfSpeech */
export function withPartOfSpeech(pos: string | undefined | null, meaning: string): string {
  const p = (pos || "").trim().replace(/\.$/, "");
  const m = (meaning || "").trim();
  if (!m) return p ? `${p}.` : "";
  if (!p) return m;
  const lower = m.toLowerCase();
  if (lower.startsWith(`${p.toLowerCase()}.`) || lower.startsWith(`${p.toLowerCase()} `)) {
    return m;
  }
  return `${p}. ${m}`;
}

export function pickPhoneticDisplay(w: {
  phonetic?: string;
  phoneticUk?: string;
  phoneticUs?: string;
}): string {
  const p = w.phoneticUk || w.phoneticUs || w.phonetic || "";
  return p ? `/${p.replace(/^\[|\]$/g, "").replace(/^\//, "").replace(/\/$/, "")}/` : "";
}
