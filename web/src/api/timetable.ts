/**
 * 学习通式课程课表 — 数据访问层
 *
 * 当前实现：浏览器 localStorage 持久化（方案 A）。
 * 预留后端：本文件导出 `TimetableRepository` 接口与 `timetableRepo` 单例，
 * 未来切换到方案 B 时，只需新增一个基于 `get/post/put/del` 的 HTTP 实现并替换单例即可，
 * 上层 store / 组件无需改动。
 *
 * 预期的 RESTful 契约（方案 B）：
 *   GET    /api/timetable/config        -> TimetableConfig
 *   PUT    /api/timetable/config        -> TimetableConfig
 *   GET    /api/timetable/course        -> Course[]
 *   POST   /api/timetable/course        -> Course
 *   PUT    /api/timetable/course/:id    -> Course
 *   DELETE /api/timetable/course/:id    -> void
 */

/** 单双周：0=每周，1=单周，2=双周 */
export type WeekType = 0 | 1 | 2;

/** 节次时间配置项 */
export interface Section {
  no: number;
  start: string; // "08:00"
  end: string; // "08:45"
}

/** 课表全局配置 */
export interface TimetableConfig {
  /** 当前是第几周（1-based） */
  currentWeek: number;
  /** 学期总周数 */
  totalWeek: number;
  /** 节次时间表 */
  sections: Section[];
}

/** 课程对象 */
export interface Course {
  id: string;
  name: string;
  teacher: string;
  room: string;
  /** 星期 1~7（周一~周日） */
  weekDay: number;
  /** 开始节次（1-based，包含） */
  startSection: number;
  /** 结束节次（1-based，包含） */
  endSection: number;
  /** 起始周（1-based，包含） */
  startWeek: number;
  /** 结束周（1-based，包含） */
  endWeek: number;
  /** 单双周 */
  weekType: WeekType;
  /** 色块背景色（hex） */
  color: string;
}

/** 仓储接口：localStorage 与未来 HTTP 实现共同遵守 */
export interface TimetableRepository {
  listCourses(): Promise<Course[]>;
  saveCourse(course: Course): Promise<Course>;
  deleteCourse(id: string): Promise<void>;
  getConfig(): Promise<TimetableConfig>;
  saveConfig(config: TimetableConfig): Promise<TimetableConfig>;
}

const COURSES_KEY = "cloudsteps_timetable_courses";
const CONFIG_KEY = "cloudsteps_timetable_config";

/** 默认节次时间（学习通常见 12 节） */
export const DEFAULT_SECTIONS: Section[] = [
  { no: 1, start: "08:00", end: "08:45" },
  { no: 2, start: "08:55", end: "09:40" },
  { no: 3, start: "10:00", end: "10:45" },
  { no: 4, start: "10:55", end: "11:40" },
  { no: 5, start: "14:00", end: "14:45" },
  { no: 6, start: "14:55", end: "15:40" },
  { no: 7, start: "16:00", end: "16:45" },
  { no: 8, start: "16:55", end: "17:40" },
  { no: 9, start: "19:00", end: "19:45" },
  { no: 10, start: "19:55", end: "20:40" },
  { no: 11, start: "20:50", end: "21:35" },
  { no: 12, start: "21:45", end: "22:30" },
];

/** 课程色块预设（学习通风格，避免 AI 紫色审美） */
export const COURSE_COLORS: string[] = [
  "#4ECDC4", // mint
  "#55A3FF", // sky
  "#FF8C5A", // coral
  "#F6B26B", // amber
  "#8B7FD8", // violet
  "#E85555", // red
  "#3DB8B0", // deep mint
  "#F4A6C7", // pink
  "#67B279", // green
  "#7A8A99", // slate
];

function defaultConfig(): TimetableConfig {
  return { currentWeek: 1, totalWeek: 20, sections: DEFAULT_SECTIONS };
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 生成唯一 id（无依赖） */
export function genCourseId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * localStorage 实现。所有方法返回 Promise，签名与未来 HTTP 实现一致，
 * 便于无缝替换。
 */
class LocalTimetableRepository implements TimetableRepository {
  async listCourses(): Promise<Course[]> {
    return safeParse<Course[]>(localStorage.getItem(COURSES_KEY), []);
  }

  async saveCourse(course: Course): Promise<Course> {
    const list = await this.listCourses();
    const idx = list.findIndex((c) => c.id === course.id);
    if (idx >= 0) list[idx] = course;
    else list.push(course);
    localStorage.setItem(COURSES_KEY, JSON.stringify(list));
    return course;
  }

  async deleteCourse(id: string): Promise<void> {
    const list = (await this.listCourses()).filter((c) => c.id !== id);
    localStorage.setItem(COURSES_KEY, JSON.stringify(list));
  }

  async getConfig(): Promise<TimetableConfig> {
    return safeParse<TimetableConfig>(localStorage.getItem(CONFIG_KEY), defaultConfig());
  }

  async saveConfig(config: TimetableConfig): Promise<TimetableConfig> {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return config;
  }
}

/**
 * 仓储单例。当前指向 localStorage 实现；
 * 切换后端时把这里换成 `new HttpTimetableRepository()` 即可。
 */
export const timetableRepo: TimetableRepository = new LocalTimetableRepository();
