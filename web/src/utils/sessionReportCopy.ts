import type { StudySessionReport } from "../api/study";

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** 2026年08月28日 */
export function formatChineseDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${pad2(d.getMonth() + 1)}月${pad2(d.getDate())}日`;
}

/** 周五14：00~15：05 */
export function formatLessonTimeRange(
  startedAt?: string,
  completedAt?: string,
  _durationMinutes?: number
): string {
  if (!startedAt) return "";
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return "";
  const end = completedAt ? new Date(completedAt) : null;
  const endValid = end && !Number.isNaN(end.getTime()) ? end : null;
  const weekday = `周${WEEKDAY_ZH[start.getDay()]}`;
  const startHm = `${pad2(start.getHours())}：${pad2(start.getMinutes())}`;
  const endHm = endValid
    ? `${pad2(endValid.getHours())}：${pad2(endValid.getMinutes())}`
    : "";
  return endHm ? `${weekday}${startHm}~${endHm}` : `${weekday}${startHm}`;
}

/** 巩固词：只保留「单词 + 释义」，去掉词性与 ✅ */
export function formatConsolidateWord(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  const m = text.match(/^(\S+)\s+(?:[a-z]+\.\s+)?(.+)$/i);
  if (!m) return text;
  const word = m[1];
  const gloss = m[2].trim();
  return gloss ? `${word}  ${gloss}` : word;
}

/**
 * Parent / WeChat-style classroom feedback copy.
 * 词库与学习进度单独列出；不罗列本课学过词条；仅训后遗忘词用 ⭐ 标出。
 */
export function buildSessionReportCopyText(
  report: StudySessionReport,
  note: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const name = (report.studentName || t("session_report.student_fallback")).trim();
  const book = (report.wordBookName || t("session_report.wordbook_fallback")).trim();
  const when = report.completedAt || report.startedAt;
  const dateZh = formatChineseDate(when);
  const timeLine = formatLessonTimeRange(report.startedAt, report.completedAt, report.durationMinutes);
  const accuracy = Math.round(report.accuracyPercent);
  const totalWords = Math.max(0, Number(report.wordBookWordCount) || 0);
  const learned = Math.max(0, Number(report.learnedCount) || 0);
  const newWords = Math.max(report.screenedUnknownCount, report.wordCount);
  const coachNote = (note || report.reportSummary || "").trim();

  const lines: string[] = [];
  lines.push(
    t("session_report.copy_header", {
      date: dateZh || t("session_report.copy_date_fallback"),
      name,
    })
  );
  lines.push(t("session_report.copy_name_line", { name }));
  if (timeLine) {
    lines.push(t("session_report.copy_time_line", { time: timeLine }));
  }
  lines.push(t("session_report.copy_book_line", { book }));
  lines.push(t("session_report.copy_content_line", { book }));
  lines.push("");
  lines.push(t("session_report.copy_perf_title"));
  if (totalWords > 0) {
    lines.push(t("session_report.copy_perf_total", { total: totalWords }));
  }
  lines.push(
    t("session_report.copy_perf_progress", {
      from: learned > 0 ? 1 : 0,
      to: learned,
    })
  );
  lines.push(t("session_report.copy_perf_new", { newWords }));

  const forgot = (report.forgotWords || []).filter(Boolean);
  lines.push(
    t("session_report.copy_perf_check", {
      remembered: report.correctCount,
      forgot: report.forgotCount,
      accuracy,
    })
  );
  for (const w of forgot) {
    const label = formatConsolidateWord(w);
    if (label) lines.push(`⭐${label}`);
  }

  lines.push("");
  lines.push(t("session_report.copy_eval_title"));
  lines.push(
    coachNote ||
      t("session_report.copy_eval_fallback", {
        name,
        accuracy,
        forgot: report.forgotCount,
        newWords,
      })
  );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
