/**
 * 学习通式课表 — 核心过滤逻辑
 *
 * 课表灵魂：不是所有课程每周都出现，要按「起止周 + 单双周」判断当前周是否显示。
 */
import type { Course, TimetableConfig, WeekType } from "../api/timetable";

/**
 * 判断课程在指定周是否显示。
 * @param course 课程
 * @param weekNo 第几周（1-based）
 */
export function isCourseShow(course: Course, weekNo: number): boolean {
  // 不在起止周范围内直接隐藏
  if (weekNo < course.startWeek || weekNo > course.endWeek) {
    return false;
  }
  // 单双周过滤
  if (course.weekType === 1) {
    // 单周
    return weekNo % 2 === 1;
  }
  if (course.weekType === 2) {
    // 双周
    return weekNo % 2 === 0;
  }
  // 0 = 每周
  return true;
}

/** 单双周文案 */
export function weekTypeLabel(weekType: WeekType): string {
  if (weekType === 1) return "single"; // 单周
  if (weekType === 2) return "double"; // 双周
  return "all"; // 每周
}

/** 周范围文案，如 "1-16周" / "1-16周(单)" */
export function weekRangeLabel(course: Course): string {
  const base = `${course.startWeek}-${course.endWeek}周`;
  if (course.weekType === 1) return `${base}(单)`;
  if (course.weekType === 2) return `${base}(双)`;
  return base;
}

/** 节次范围文案，如 "1-2节" */
export function sectionRangeLabel(course: Course): string {
  return `${course.startSection}-${course.endSection}节`;
}

/** 把星期 1~7 转成中文 */
export function weekDayLabel(weekDay: number): string {
  return ["一", "二", "三", "四", "五", "六", "日"][weekDay - 1] ?? String(weekDay);
}

/** 课程在某周是否「正在进行」（用于高亮当前节次，可选） */
export function isCurrentWeek(course: Course, config: TimetableConfig): boolean {
  return isCourseShow(course, config.currentWeek);
}

/**
 * 校验课程数据合法性，返回错误信息（首个错误），合法返回 null。
 * 防止节次/周次倒置、星期越界等常见坑。
 */
export function validateCourse(course: Omit<Course, "id">, config: TimetableConfig): string | null {
  if (!course.name.trim()) return "课程名不能为空";
  if (course.weekDay < 1 || course.weekDay > 7) return "星期必须在 1~7 之间";
  if (course.startSection < 1) return "开始节次不能小于 1";
  if (course.endSection < course.startSection) return "结束节次不能小于开始节次";
  if (course.endSection > config.sections.length) return `结束节次不能超过 ${config.sections.length}`;
  if (course.startWeek < 1) return "起始周不能小于 1";
  if (course.endWeek < course.startWeek) return "结束周不能小于起始周";
  if (course.endWeek > config.totalWeek) return `结束周不能超过总周数 ${config.totalWeek}`;
  return null;
}
