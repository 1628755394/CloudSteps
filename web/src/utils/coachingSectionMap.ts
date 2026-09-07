/**
 * 后端教练预约 → 节次网格映射
 *
 * 后端预约用精确时间（"08:00"-"09:40"），节次网格用节次序号（1-12）。
 * 这里按 DEFAULT_SECTIONS 时间表，把预约的 startTime/endTime 映射到
 * 起始节次 / 结束节次，让两种数据能在同一个节次网格里合并渲染。
 */
import { DEFAULT_SECTIONS, type Section } from "../api/timetable";

function hmToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t || "").trim().slice(0, 5));
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * 找到时间点落在哪个节次（按节次开始时间判断）。
 * 早于第1节开始 → 1；晚于最后节次结束 → 最后一节。
 */
function minuteToSection(min: number, sections: Section[]): number {
  if (min < 0) return 1;
  for (let i = 0; i < sections.length; i++) {
    if (min < hmToMinutes(sections[i].start)) {
      return Math.max(1, i + 1 - 1) || 1;
    }
  }
  return sections.length;
}

/**
 * 把预约的 startTime/endTime 映射到 { startSection, endSection }。
 * endSection 包含在内（与 Course.endSection 语义一致）。
 *
 * 例：08:00-09:40，节次表 [1]08:00-08:45 [2]08:55-09:40 → {1, 2}
 */
export function timeToSections(
  startTime: string,
  endTime: string,
  sections: Section[] = DEFAULT_SECTIONS,
): { startSection: number; endSection: number } {
  const s = hmToMinutes(startTime);
  const e = hmToMinutes(endTime);
  if (s < 0) return { startSection: 1, endSection: 1 };
  const startSection = minuteToSection(s, sections);
  if (e < 0 || e <= s) return { startSection, endSection: startSection };
  // endSection：endTime 落在哪个节次的结束侧
  let endSection = startSection;
  for (let i = 0; i < sections.length; i++) {
    const secEnd = hmToMinutes(sections[i].end);
    if (e <= secEnd) {
      endSection = i + 1;
      break;
    }
    endSection = i + 1;
  }
  if (endSection < startSection) endSection = startSection;
  return { startSection, endSection };
}
