/** 多轮单词练习：同一「结束训练」前累计的 study session id（雪花字符串） */
const ROUND_IDS_KEY = "lb_study_round_ids";

function normalizeId(id: string | number | null | undefined): string {
  if (id == null) return "";
  const s = String(id).trim();
  return s;
}

export function getStudyRoundSessionIds(): string[] {
  try {
    const raw = sessionStorage.getItem(ROUND_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const item of parsed) {
      const id = normalizeId(item as string | number);
      if (id && !out.includes(id)) out.push(id);
    }
    return out;
  } catch {
    return [];
  }
}

export function appendStudyRoundSessionId(id: string | number | null | undefined): void {
  const sid = normalizeId(id);
  if (!sid) return;
  const ids = getStudyRoundSessionIds();
  if (!ids.includes(sid)) ids.push(sid);
  sessionStorage.setItem(ROUND_IDS_KEY, JSON.stringify(ids));
}

export function clearStudyRoundSessionIds(): void {
  sessionStorage.removeItem(ROUND_IDS_KEY);
}

/** 结束训练跳转报告用：保证包含当前轮 id */
export function takeStudyRoundSessionIdsForReport(
  currentId?: string | number | null
): string[] {
  const ids = getStudyRoundSessionIds();
  const cur = normalizeId(currentId);
  if (cur && !ids.includes(cur)) ids.push(cur);
  return ids;
}
