/**
 * 学习通式课程课表 — 全局状态
 *
 * 不使用 zustand persist：持久化由 `timetableRepo`（localStorage）负责，
 * 这样未来切到后端 HTTP 实现时，store 逻辑完全不变。
 * 页面挂载时调用 `load()` 从仓储拉取数据。
 */
import { create } from "zustand";
import {
  timetableRepo,
  genCourseId,
  COURSE_COLORS,
  type Course,
  type TimetableConfig,
  type WeekType,
} from "../api/timetable";
import { validateCourse } from "../utils/timetableFilter";

interface TimetableState {
  courses: Course[];
  config: TimetableConfig;
  /** 当前查看的周（1-based），独立于 config.currentWeek，便于临时切换 */
  viewWeek: number;
  loaded: boolean;
  loading: boolean;

  load: () => Promise<void>;
  setCurrentWeek: (week: number) => Promise<void>;
  setViewWeek: (week: number) => void;
  prevWeek: () => void;
  nextWeek: () => void;
  updateConfig: (patch: Partial<TimetableConfig>) => Promise<void>;

  addCourse: (input: Omit<Course, "id">) => Promise<{ ok: boolean; error?: string }>;
  updateCourse: (id: string, input: Omit<Course, "id">) => Promise<{ ok: boolean; error?: string }>;
  removeCourse: (id: string) => Promise<void>;
}

function clampWeek(week: number, total: number): number {
  return Math.max(1, Math.min(total, Math.round(week)));
}

/** 新建课程时的默认值 */
export function blankCourseInput(config: TimetableConfig): Omit<Course, "id"> {
  return {
    name: "",
    teacher: "",
    room: "",
    weekDay: 1,
    startSection: 1,
    endSection: 2,
    startWeek: 1,
    endWeek: config.totalWeek,
    weekType: 0 as WeekType,
    color: COURSE_COLORS[0],
  };
}

export const useTimetableStore = create<TimetableState>((set, get) => ({
  courses: [],
  config: { currentWeek: 1, totalWeek: 20, sections: [] },
  viewWeek: 1,
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    const [courses, config] = await Promise.all([
      timetableRepo.listCourses(),
      timetableRepo.getConfig(),
    ]);
    set({
      courses,
      config,
      viewWeek: clampWeek(config.currentWeek, config.totalWeek),
      loaded: true,
      loading: false,
    });
  },

  setCurrentWeek: async (week) => {
    const { config } = get();
    const next = clampWeek(week, config.totalWeek);
    const newConfig = { ...config, currentWeek: next };
    await timetableRepo.saveConfig(newConfig);
    set({ config: newConfig, viewWeek: next });
  },

  setViewWeek: (week) => {
    const { config } = get();
    set({ viewWeek: clampWeek(week, config.totalWeek) });
  },

  prevWeek: () => {
    const { viewWeek } = get();
    set({ viewWeek: Math.max(1, viewWeek - 1) });
  },

  nextWeek: () => {
    const { viewWeek, config } = get();
    set({ viewWeek: Math.min(config.totalWeek, viewWeek + 1) });
  },

  updateConfig: async (patch) => {
    const { config } = get();
    const newConfig = { ...config, ...patch };
    if (patch.totalWeek != null) {
      newConfig.currentWeek = clampWeek(newConfig.currentWeek, newConfig.totalWeek);
    }
    await timetableRepo.saveConfig(newConfig);
    set({
      config: newConfig,
      viewWeek: clampWeek(get().viewWeek, newConfig.totalWeek),
    });
  },

  addCourse: async (input) => {
    const { config } = get();
    const err = validateCourse(input, config);
    if (err) return { ok: false, error: err };
    const course: Course = { ...input, id: genCourseId() };
    await timetableRepo.saveCourse(course);
    set({ courses: [...get().courses, course] });
    return { ok: true };
  },

  updateCourse: async (id, input) => {
    const { config } = get();
    const err = validateCourse(input, config);
    if (err) return { ok: false, error: err };
    const course: Course = { ...input, id };
    await timetableRepo.saveCourse(course);
    set({ courses: get().courses.map((c) => (c.id === id ? course : c)) });
    return { ok: true };
  },

  removeCourse: async (id) => {
    await timetableRepo.deleteCourse(id);
    set({ courses: get().courses.filter((c) => c.id !== id) });
  },
}));
