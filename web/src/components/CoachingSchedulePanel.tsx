import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import { DatePicker, Modal } from "@arco-design/web-react";
import {
  deleteTeacherCoachingAppointment,
  endCoachingAppointment,
  getStudentCoachingWeek,
  getTeacherCoachingWeek,
  listAllTeacherCoachingQuotas,
  startCoachingAppointment,
  type CoachingWeekSchedule,
  type TeacherCoachingQuotaRow,
} from "../api/coaching";
import { minutesUntilCoachingEnd, parseCoachingSlotEnd } from "../utils/coachingSchedule";
import {
  isTimetableCellTipDone,
  markTimetableCellTipDone,
  measureCoachTarget,
  type CoachTargetRect,
} from "../utils/coachOnboarding";
import { showToast } from "../utils/toast";
import { useAuthStore } from "../stores/authStore";
import { useIsMobile } from "./ui/use-mobile";
import { MobileDateWheel } from "./cloudsteps/MobileWheelPicker";
import { CloudSpin } from "./cloudsteps/arco";
import { CloudButton } from "./cloudsteps";
import { useTimetableStore, blankCourseInput } from "../stores/timetableStore";
import { CourseEditorDialog } from "./timetable/CourseEditorDialog";
import { timeToSections } from "../utils/coachingSectionMap";
import { isCourseShow, weekRangeLabel } from "../utils/timetableFilter";
import {
  DEFAULT_SECTIONS,
  type Course,
  type TimetableConfig,
} from "../api/timetable";

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtMD = (d: Date) => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekMonday(d: Date) {
  const x = startOfDay(d);
  const wd = x.getDay();
  const fromMon = (wd + 6) % 7;
  x.setDate(x.getDate() - fromMon);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function studentLabel(
  t: TFunction,
  s?: { displayName?: string; username?: string },
  fallbackId?: number,
) {
  return s?.displayName || s?.username || (fallbackId ? t("ui.student_id", { id: fallbackId }) : t("ui.student_fallback"));
}

const DAY_HEADER_H = 52;
const EVENT_MIN_H = 32;
/** 时间轴相对可视区再拉高约 1/3，课块更易读 */
const AXIS_HEIGHT_SCALE = 4 / 3;

const STATUS_SOFT: Record<string, { bg: string; text: string; bar: string }> = {
  scheduled: {
    bg: "bg-primary/15",
    text: "text-primary",
    bar: "bg-primary",
  },
  in_progress: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    bar: "bg-sky-500",
  },
  completed: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    bar: "bg-muted-foreground/40",
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-600",
    bar: "bg-red-500",
  },
};

const PAST_SOFT = {
  bg: "bg-muted",
  text: "text-muted-foreground",
  bar: "bg-muted-foreground/40",
};

/** 计划时段已结束（不含进行中） */
function isSchedulePast(schedule: CoachingWeekSchedule, nowTs: number): boolean {
  if (schedule.status === "in_progress") return false;
  const end = parseCoachingSlotEnd(schedule.scheduledDate, schedule.endTime);
  if (!end) return false;
  return end.getTime() <= nowTs;
}

function parseHmToMinutes(t: string): number {
  const raw = (t || "").trim().slice(0, 5);
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 结束 00:00 视为次日 0 点（当天末） */
function parseEndMinutes(t: string): number {
  const raw = (t || "").trim().slice(0, 5);
  if (raw === "00:00" || raw === "0:00") return 24 * 60;
  return parseHmToMinutes(t);
}

function fmtMinutes(mins: number): string {
  if (mins >= 24 * 60) return "24:00";
  const clamped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

function lessonDisplay(t: TFunction, s: CoachingWeekSchedule): { title: string; subtitle?: string } {
  const student = s.students?.[0]?.trim() || "";
  let title = s.title?.trim() || "";
  // 兼容旧默认标题「姓名 · 陪练」
  title = title.replace(/\s*[·•]\s*陪练\s*$/u, "").trim();
  if (title && student && title !== student) {
    return { title, subtitle: student };
  }
  if (student) return { title: student };
  if (title) return { title };
  return { title: t("coaching.lesson_default") };
}

function buildAxisMarks(axisStart: number, axisEnd: number): number[] {
  const span = axisEnd - axisStart;
  const step = span <= 180 ? 30 : span <= 480 ? 60 : 120;
  const first = Math.ceil(axisStart / step) * step;
  const marks: number[] = [];
  for (let m = first; m < axisEnd; m += step) marks.push(m);
  if (marks.length === 0 || marks[0] !== axisStart) marks.unshift(axisStart);
  return marks;
}

function layoutDayEvents(
  items: CoachingWeekSchedule[],
  axisStart: number,
  axisEnd: number,
  axisHeightPx: number,
): Array<{
  schedule: CoachingWeekSchedule;
  topPx: number;
  heightPx: number;
  showDetail: boolean;
  col: number;
  colCount: number;
}> {
  const span = Math.max(1, axisEnd - axisStart);
  const raw = items.map((schedule) => {
    let s = parseHmToMinutes(schedule.startTime);
    let e = parseEndMinutes(schedule.endTime);
    if (e <= s) e = s + 30;
    s = Math.max(axisStart, Math.min(s, axisEnd - 5));
    e = Math.max(s + 15, Math.min(e, axisEnd));
    return { schedule, start: s, end: e };
  });

  const sorted = [...raw].sort((a, b) => a.start - b.start || b.end - a.end);
  const cols = new Array(sorted.length).fill(0);
  for (let i = 0; i < sorted.length; i++) {
    const used = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (sorted[j].end > sorted[i].start && sorted[j].start < sorted[i].end) {
        used.add(cols[j]);
      }
    }
    let c = 0;
    while (used.has(c)) c++;
    cols[i] = c;
  }

  const colCounts = new Array(sorted.length).fill(1);
  for (let i = 0; i < sorted.length; i++) {
    let max = cols[i];
    for (let j = 0; j < sorted.length; j++) {
      if (sorted[j].end > sorted[i].start && sorted[j].start < sorted[i].end) {
        max = Math.max(max, cols[j]);
      }
    }
    colCounts[i] = max + 1;
  }

  return sorted.map((ev, i) => {
    const topPx = ((ev.start - axisStart) / span) * axisHeightPx;
    const heightPx = Math.max(EVENT_MIN_H, ((ev.end - ev.start) / span) * axisHeightPx);
    return {
      schedule: ev.schedule,
      topPx,
      heightPx,
      showDetail: heightPx >= 40,
      col: cols[i],
      colCount: colCounts[i],
    };
  });
}

/** 课表内课程块（窄列友好，支持并排） */
function TimetableBlock({
  schedule,
  topPx,
  heightPx,
  showDetail,
  col,
  colCount,
  nowTs,
  onClick,
  t,
}: {
  schedule: CoachingWeekSchedule;
  topPx: number;
  heightPx: number;
  showDetail: boolean;
  col: number;
  colCount: number;
  nowTs: number;
  onClick: () => void;
  t: TFunction;
}) {
  const past = isSchedulePast(schedule, nowTs);
  const soft = past
    ? PAST_SOFT
    : STATUS_SOFT[schedule.status] || STATUS_SOFT.scheduled;
  const { title } = lessonDisplay(t, schedule);
  const start = schedule.startTime?.slice(0, 5) || "";
  const end = schedule.endTime?.slice(0, 5) || "";
  const widthPct = 100 / colCount;
  const leftPct = col * widthPct;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute z-[1] overflow-hidden rounded-lg ${soft.bg} text-left px-1 py-1 shadow-sm active:scale-[0.98] touch-manipulation ${
        past ? "opacity-90" : ""
      }`}
      style={{
        top: topPx,
        height: heightPx,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${soft.bar}`} aria-hidden />
      <div className="pl-1.5 min-w-0 h-full flex flex-col justify-center">
        <div className={`text-[10px] font-semibold tabular-nums leading-tight ${soft.text}`}>
          {start}{showDetail ? `–${end}` : ""}
        </div>
        {showDetail ? (
          <div
            className={`text-[11px] font-medium leading-snug line-clamp-2 mt-0.5 ${
              past ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {title}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function toPickerDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate: () => Date }).toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

type Props = {
  nowTs: number;
  mode?: "coach" | "student";
};

const MODAL_OVERLAY_CLASS =
  "fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 pb-20 sm:pb-4";

const MODAL_SHEET_CLASS =
  "w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-xl flex flex-col max-h-[min(calc(100dvh-6rem),720px)] sm:max-h-[90dvh]";

const MODAL_BODY_CLASS = "flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4";

const MODAL_FOOTER_CLASS =
  "shrink-0 p-5 pt-3 border-t border-border bg-card pb-[max(1.25rem,env(safe-area-inset-bottom))]";

export function CoachingSchedulePanel({ nowTs, mode = "coach" }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ? Number(user.id) : 0;
  const isCoach = mode === "coach";

  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [schedules, setSchedules] = useState<CoachingWeekSchedule[]>([]);
  const [quotas, setQuotas] = useState<TeacherCoachingQuotaRow[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [pendingActionById, setPendingActionById] = useState<
    Record<number, "start" | "end" | null>
  >({});
  const [selected, setSelected] = useState<CoachingWeekSchedule | null>(null);
  const [showCellTip, setShowCellTip] = useState(false);
  const [tipHole, setTipHole] = useState<CoachTargetRect | null>(null);
  const [tipReady, setTipReady] = useState(false);

  // localStorage 自定义课程
  const ttLoad = useTimetableStore((s) => s.load);
  const ttLoaded = useTimetableStore((s) => s.loaded);
  const ttCourses = useTimetableStore((s) => s.courses);
  const ttConfig = useTimetableStore((s) => s.config);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [coursePreset, setCoursePreset] = useState<{ weekDay: number; startSection: number } | null>(null);

  const timetableHostRef = useRef<HTMLDivElement>(null);
  const [axisHeightPx, setAxisHeightPx] = useState(280);

  const weekMon = useMemo(() => weekMonday(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekMon, i)),
    [weekMon],
  );
  const todayYMD = fmtYMD(new Date());
  const weekShortLabel = `${fmtMD(weekMon)}–${fmtMD(addDays(weekMon, 6))}`;

  const byDay = useMemo(() => {
    const map: Record<string, CoachingWeekSchedule[]> = {};
    for (const d of weekDays) map[fmtYMD(d)] = [];
    for (const s of schedules) {
      const key = s.scheduledDate?.slice?.(0, 10) || s.scheduledDate;
      if (!key || !map[key]) continue;
      map[key].push(s);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    }
    return map;
  }, [schedules, weekDays]);

  /** 有课才画时间轴：按本周最早～最晚自适应 */
  const axisRange = useMemo(() => {
    if (schedules.length === 0) return null;
    let minM = Infinity;
    let maxM = -Infinity;
    for (const s of schedules) {
      const a = parseHmToMinutes(s.startTime);
      let b = parseEndMinutes(s.endTime);
      if (b <= a) b = a + 30;
      minM = Math.min(minM, a);
      maxM = Math.max(maxM, b);
    }
    if (!Number.isFinite(minM) || !Number.isFinite(maxM)) return null;
    const pad = 20;
    minM = Math.max(0, minM - pad);
    maxM = Math.min(24 * 60, maxM + pad);
    if (maxM - minM < 120) {
      const mid = (minM + maxM) / 2;
      minM = Math.max(0, Math.floor(mid - 60));
      maxM = Math.min(24 * 60, Math.ceil(mid + 60));
    }
    return { startMin: minM, endMin: maxM };
  }, [schedules]);

  const axisMarks = useMemo(
    () => (axisRange ? buildAxisMarks(axisRange.startMin, axisRange.endMin) : []),
    [axisRange],
  );

  const axisSpan = axisRange ? Math.max(1, axisRange.endMin - axisRange.startMin) : 1;
  /** H5：列宽适中，周六日可右滑 */
  const dayColPx = isMobile ? 88 : 64;
  const timeGutterPx = 40;
  const weekGridMinW = timeGutterPx + dayColPx * 7;
  const emptyGridMinW = dayColPx * 7;

  const activeCount = useMemo(
    () =>
      schedules.filter((s) => s.status === "scheduled" || s.status === "in_progress")
        .length,
    [schedules],
  );

  const loadQuotas = useCallback(async () => {
    if (!isCoach) return;
    try {
      setQuotas(await listAllTeacherCoachingQuotas());
    } catch {
      setQuotas([]);
    }
  }, [isCoach]);

  const loadWeek = useCallback(
    async (refDate?: string) => {
      const ref = refDate || fmtYMD(weekAnchor);
      setLoadingSchedules(true);
      try {
        const res = isCoach
          ? await getTeacherCoachingWeek(ref)
          : await getStudentCoachingWeek(ref);
        setSchedules(Array.isArray(res.data?.schedules) ? res.data!.schedules : []);
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "msg" in e
            ? String((e as { msg: string }).msg)
            : t("coaching.load_schedule_failed");
        showToast.error(msg);
        setSchedules([]);
      } finally {
        setLoadingSchedules(false);
      }
    },
    [weekAnchor, isCoach, t],
  );

  useEffect(() => {
    void loadWeek();
    void loadQuotas();
    if (!ttLoaded) void ttLoad();
  }, [loadWeek, loadQuotas, ttLoad, ttLoaded]);

  useLayoutEffect(() => {
    const el = timetableHostRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h > DAY_HEADER_H + 120) {
        setAxisHeightPx(Math.round((h - DAY_HEADER_H) * AXIS_HEIGHT_SCALE));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [loadingSchedules, axisRange, isMobile]);

  useEffect(() => {
    if (!isCoach || !userId || loadingSchedules) return;
    if (isTimetableCellTipDone(userId)) return;
    setShowCellTip(true);
  }, [isCoach, userId, loadingSchedules]);

  // 一旦展示过就写入浏览器缓存，避免下次进入重复弹出
  useEffect(() => {
    if (!showCellTip || !userId) return;
    markTimetableCellTipDone(userId);
  }, [showCellTip, userId]);

  useEffect(() => {
    if (!showCellTip || loadingSchedules) {
      setTipReady(false);
      return;
    }
    const t = window.setTimeout(() => setTipReady(true), 220);
    return () => window.clearTimeout(t);
  }, [showCellTip, loadingSchedules, schedules]);

  const remountTipHole = useCallback(() => {
    if (!showCellTip) {
      setTipHole(null);
      return;
    }
    const run = () => setTipHole(measureCoachTarget("timetable-day"));
    run();
    window.setTimeout(run, 120);
  }, [showCellTip]);

  useLayoutEffect(() => {
    remountTipHole();
  }, [remountTipHole, schedules, weekAnchor]);

  useEffect(() => {
    if (!showCellTip) return;
    const onResize = () => remountTipHole();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [showCellTip, remountTipHole]);

  const dismissCellTip = () => {
    if (userId) markTimetableCellTipDone(userId);
    setShowCellTip(false);
    setTipHole(null);
  };

  const studentOptions = useMemo(
    () =>
      quotas.map((q) => ({
        value: String(q.studentId),
        label: studentLabel(t, q.student, q.studentId),
      })),
    [quotas, t],
  );

  const openScheduleForDay = async (day: Date) => {
    if (!isCoach) return;
    const dayYmd = fmtYMD(day);
    const todayYmd = fmtYMD(new Date());
    if (dayYmd < todayYmd) {
      showToast.info(t("coaching.cannot_schedule_past"));
      return;
    }

    let options = studentOptions;
    if (options.length === 0) {
      try {
        const list = await listAllTeacherCoachingQuotas();
        setQuotas(list);
        options = list.map((q) => ({
          value: String(q.studentId),
          label: studentLabel(t, q.student, q.studentId),
        }));
      } catch {
        // fall through to empty check
      }
    }
    if (options.length === 0) {
      showToast.info(t("coaching.add_student_before_schedule"));
      navigate("/my-students");
      return;
    }
    navigate(`/lesson-prep/new?date=${dayYmd}`);
  };

  const jumpToWeekOf = (dateString: string) => {
    if (!dateString) return;
    const d = new Date(`${dateString}T12:00:00`);
    if (!Number.isNaN(d.getTime())) setWeekAnchor(weekMonday(d));
  };

  useEffect(() => {
    const st = location.state as { refreshDate?: string } | null;
    const refreshDate = st?.refreshDate;
    if (!refreshDate) return;
    jumpToWeekOf(refreshDate);
    void loadWeek(refreshDate);
    void loadQuotas();
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const onDeleteAppt = async (id: number) => {
    Modal.confirm({
      title: t("coaching.delete_confirm_title"),
      content: t("coaching.delete_confirm_desc"),
      okText: t("coaching.confirm_delete"),
      cancelText: t("ui.cancel"),
      okButtonProps: { status: "danger" },
      onOk: async () => {
        try {
          const res = await deleteTeacherCoachingAppointment(id);
          if (res.code !== 200) {
            showToast.error(res.msg || t("coaching.delete_failed"));
            return;
          }
          showToast.success(t("coaching.deleted"));
          setSelected(null);
          void loadWeek();
        } catch (e: unknown) {
          const msg =
            e && typeof e === "object" && "msg" in e
              ? String((e as { msg: string }).msg)
              : t("coaching.delete_failed");
          showToast.error(msg);
        }
      },
    });
  };

  const onStart = async (id: number) => {
    setPendingActionById((prev) => ({ ...prev, [id]: "start" }));
    try {
      const res = await startCoachingAppointment(id);
      if (res.code !== 200) {
        showToast.error(res.msg || t("coaching.cannot_start"));
        return;
      }
      showToast.success(t("coaching.started"));
      setSelected(null);
      void loadWeek();
      navigate("/material-selection");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : t("coaching.start_failed");
      showToast.error(msg);
    } finally {
      setPendingActionById((prev) => ({ ...prev, [id]: null }));
    }
  };

  const onEnd = async (id: number) => {
    setPendingActionById((prev) => ({ ...prev, [id]: "end" }));
    try {
      const res = await endCoachingAppointment(id);
      if (res.code !== 200) {
        showToast.error(res.msg || t("coaching.cannot_end"));
        return;
      }
      showToast.success(t("coaching.ended"));
      setSelected(null);
      void loadWeek();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : t("coaching.end_failed");
      showToast.error(msg);
    } finally {
      setPendingActionById((prev) => ({ ...prev, [id]: null }));
    }
  };

  const selectedPending = selected ? pendingActionById[selected.id] ?? null : null;
  const selectedMinsLeft =
    selected?.status === "in_progress"
      ? minutesUntilCoachingEnd(selected.scheduledDate, selected.endTime, nowTs)
      : null;
  const selectedPast =
    selected?.status === "scheduled" &&
    !!parseCoachingSlotEnd(selected.scheduledDate, selected.endTime) &&
    parseCoachingSlotEnd(selected.scheduledDate, selected.endTime)!.getTime() < nowTs;

  /**
   * 节次网格合并项：后端预约（按时间映射到节次）+ localStorage 自定义课程。
   * 每项带来源标记 kind，点击时按 kind 分流交互。
   */
  const gridItems = useMemo(() => {
    const sections = ttConfig.sections.length > 0 ? ttConfig.sections : DEFAULT_SECTIONS;
    const items: GridItem[] = [];

    // 后端预约：按 scheduledDate 算出属于本周第几天，时间映射到节次
    for (const s of schedules) {
      const ymd = s.scheduledDate?.slice?.(0, 10) || s.scheduledDate;
      if (!ymd) continue;
      const dayIdx = weekDays.findIndex((d) => fmtYMD(d) === ymd);
      if (dayIdx < 0) continue;
      const { startSection, endSection } = timeToSections(s.startTime, s.endTime, sections);
      const past = isSchedulePast(s, nowTs);
      const soft = past ? PAST_SOFT : STATUS_SOFT[s.status] || STATUS_SOFT.scheduled;
      const { title, subtitle } = lessonDisplay(t, s);
      items.push({
        key: `co-${s.id}`,
        kind: "coaching",
        weekDay: dayIdx + 1,
        startSection,
        endSection,
        color: soft.bar.replace("bg-", "").startsWith("muted") ? "#7A8A99" : "#4ECDC4",
        title,
        subtitle,
        meta: `${s.startTime?.slice(0, 5)}-${s.endTime?.slice(0, 5)}`,
        schedule: s,
      });
    }

    // localStorage 自定义课程：按 weekDay 归属到本周（不区分具体日期）
    for (const c of ttCourses) {
      if (c.weekDay < 1 || c.weekDay > 7) continue;
      items.push({
        key: `cu-${c.id}`,
        kind: "course",
        weekDay: c.weekDay,
        startSection: c.startSection,
        endSection: c.endSection,
        color: c.color,
        title: c.name,
        subtitle: c.room ? `@${c.room}` : undefined,
        meta: weekRangeLabel(c),
        course: c,
      });
    }

    return items;
  }, [schedules, ttCourses, ttConfig.sections, weekDays, t, nowTs]);

  function openCourseEditor(course: Course | null, preset: { weekDay: number; startSection: number } | null) {
    setEditingCourse(course);
    setCoursePreset(preset);
    setEditorOpen(true);
  }

  const weekTrigger = (
    <button
      type="button"
      className="w-full h-8 inline-flex items-center justify-center gap-1 rounded-lg border border-input bg-card px-2 text-xs font-medium text-foreground tabular-nums active:bg-muted/50 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 transition-colors touch-manipulation"
    >
      <Calendar size={14} className="text-muted-foreground shrink-0" />
      <span>{weekShortLabel}</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col min-h-0 overflow-hidden bg-card sm:rounded-xl sm:border sm:border-border">
      {/* 紧凑顶栏：标题 + 周切换同一行 */}
      <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border">
        <h2 className="text-[15px] font-semibold text-foreground shrink-0 leading-none">
          {isCoach ? t("coaching.schedule_title") : t("coaching.my_schedule")}
        </h2>
        <span className="inline-flex items-center rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0 leading-none">
          {t("coaching.pending_count", { count: activeCount })}
        </span>

        <div className="flex-1 min-w-0" />

        <CloudButton
          variant="outline"
          size="sm"
          className="shrink-0 size-8 p-0 touch-manipulation"
          aria-label={t("ui.prev_week")}
          onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
        >
          <ChevronLeft size={16} />
        </CloudButton>

        <div className="w-[7.5rem] sm:w-[9.5rem] shrink-0">
          {isMobile ? (
            <MobileDateWheel
              value={fmtYMD(weekMon)}
              allowClear={false}
              placeholder={t("coaching.select_week")}
              displayValue={weekShortLabel}
              sheetTitle={t("coaching.select_week_day")}
              className="!h-8 !min-h-8 !text-xs !text-center !flex !items-center !justify-center !px-1 !rounded-lg"
              onChange={(dateString) => jumpToWeekOf(dateString)}
            />
          ) : (
            <DatePicker.WeekPicker
              dayStartOfWeek={1}
              allowClear={false}
              value={weekMon}
              className="cloud-datepicker w-full"
              style={{ width: "100%", borderRadius: 8, height: 32 }}
              triggerElement={weekTrigger}
              onChange={(_val, date) => {
                const d = toPickerDate(date) || toPickerDate(_val);
                if (d) setWeekAnchor(weekMonday(d));
              }}
            />
          )}
        </div>

        <CloudButton
          variant="outline"
          size="sm"
          className="shrink-0 size-8 p-0 touch-manipulation"
          aria-label={t("ui.next_week")}
          onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
        >
          <ChevronRight size={16} />
        </CloudButton>
      </div>

      {/* 周课表：高度贴合可视区，仅横向滑动 */}
      <div ref={timetableHostRef} className="flex-1 min-h-0 overflow-hidden">
        {loadingSchedules ? (
          <div className="h-full flex items-center justify-center">
            <CloudSpin tip={t("coaching.loading_schedule")} />
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-auto overscroll-contain">
            <SectionGrid
              weekDays={weekDays}
              todayYMD={todayYMD}
              sections={ttConfig.sections.length > 0 ? ttConfig.sections : DEFAULT_SECTIONS}
              items={gridItems}
              isCoach={isCoach}
              t={t}
              onDayHeaderClick={(d) => {
                if (!isCoach) return;
                dismissCellTip();
                openScheduleForDay(d);
              }}
              onCellClick={(weekDay, section) => {
                if (!isCoach) return;
                dismissCellTip();
                openCourseEditor(null, { weekDay, startSection: section });
              }}
              onItemClick={(item) => {
                dismissCellTip();
                if (item.kind === "coaching" && item.schedule) {
                  setSelected(item.schedule);
                } else if (item.kind === "course" && item.course) {
                  openCourseEditor(item.course, null);
                }
              }}
            />
          </div>
        )}
      </div>

      {selected &&
        createPortal(
          <div className={MODAL_OVERLAY_CLASS} onClick={() => setSelected(null)}>
            <div
              className={`${MODAL_SHEET_CLASS} max-h-[min(calc(100dvh-6rem),640px)]`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={MODAL_BODY_CLASS}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {lessonDisplay(t, selected).title || t("coaching.lesson_fallback", { id: selected.id })}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selected.scheduledDate?.slice?.(0, 10) || selected.scheduledDate} ·{" "}
                      {selected.startTime}–{selected.endTime}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-muted touch-manipulation"
                    onClick={() => setSelected(null)}
                    aria-label={t("ui.close")}
                  >
                    <X size={18} />
                  </button>
                </div>

                {selected.students && selected.students.length > 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {t("coaching.student_label", { names: selected.students.join("、") })}
                  </div>
                ) : null}

                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-muted-foreground" />
                  <span
                    className={`font-medium ${(STATUS_SOFT[selected.status] || STATUS_SOFT.scheduled).text}`}
                  >
                    {t(`coaching.status.${selected.status}`, { defaultValue: selected.status })}
                  </span>
                  {selected.status === "in_progress" && selectedMinsLeft != null ? (
                    <span className="text-xs text-muted-foreground">
                      {t("coaching.mins_until_end", { count: Math.max(0, selectedMinsLeft) })}
                    </span>
                  ) : null}
                  {selectedPast ? (
                    <span className="text-xs text-muted-foreground">{t("coaching.slot_passed")}</span>
                  ) : null}
                </div>
              </div>

              <div className={`${MODAL_FOOTER_CLASS} space-y-0`}>
                {isCoach ? (
                  <div className="flex flex-wrap gap-2">
                    {selected.status === "scheduled" ? (
                      <>
                        <CloudButton
                          variant="outline"
                          size="sm"
                          className="border-destructive/35 text-destructive hover:bg-destructive/5 min-h-10 touch-manipulation"
                          onClick={() => void onDeleteAppt(selected.id)}
                        >
                          <Trash2 size={14} />
                          {t("coaching.delete")}
                        </CloudButton>
                        <CloudButton
                          variant="brand"
                          size="sm"
                          className="flex-1 min-h-10 touch-manipulation"
                          loading={selectedPending === "start"}
                          disabled={selectedPending !== null}
                          onClick={() => void onStart(selected.id)}
                        >
                          {t("coaching.start_class")}
                        </CloudButton>
                      </>
                    ) : null}
                    {selected.status === "in_progress" ? (
                      <>
                        <CloudButton
                          variant="brandOutline"
                          size="sm"
                          className="flex-1 min-h-10 touch-manipulation"
                          onClick={() => {
                            setSelected(null);
                            navigate("/material-selection");
                          }}
                        >
                          {t("coaching.enter_training")}
                        </CloudButton>
                        <CloudButton
                          variant="destructive"
                          size="sm"
                          className="min-h-10 touch-manipulation"
                          loading={selectedPending === "end"}
                          disabled={selectedPending !== null}
                          onClick={() => void onEnd(selected.id)}
                        >
                          {t("coaching.end_class")}
                        </CloudButton>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <CloudButton
                    variant="outline"
                    size="sm"
                    className="w-full min-h-10 touch-manipulation"
                    onClick={() => setSelected(null)}
                  >
                    {t("ui.close")}
                  </CloudButton>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showCellTip && tipHole && (
        <div className="fixed inset-0 z-[65]">
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-primary transition-[top,left,width,height] duration-300"
            style={{
              top: Math.max(0, tipHole.top - 6),
              left: Math.max(0, tipHole.left - 6),
              width: tipHole.width + 12,
              height: tipHole.height + 12,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              animation: "coach-pulse 1.6s ease-in-out infinite",
            }}
          />
          <div className="absolute inset-0" onClick={dismissCellTip} />
          <div
            className="absolute z-[66] w-[min(100vw-2rem,20rem)] rounded-2xl border border-border bg-card p-4 shadow-xl"
            style={{
              top: Math.min(
                (typeof window !== "undefined" ? window.innerHeight : 800) - 180,
                tipHole.top + tipHole.height + 14,
              ),
              left: Math.min(
                Math.max(16, tipHole.left + tipHole.width / 2 - 160),
                (typeof window !== "undefined" ? window.innerWidth : 400) - 336,
              ),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground">{t("coaching.cell_tip_title")}</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {t("coaching.cell_tip_desc")}
            </p>
            <CloudButton
              variant="brand"
              size="sm"
              className="w-full mt-3 min-h-10"
              onClick={dismissCellTip}
            >
              {t("announcements.got_it")}
            </CloudButton>
          </div>
          <style>{`
            @keyframes coach-pulse {
              0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.5), 0 0 0 0 rgba(78,205,196,0.45); }
              50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.5), 0 0 0 10px rgba(78,205,196,0); }
            }
          `}</style>
        </div>
      )}

      {showCellTip && tipReady && !tipHole && !loadingSchedules && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-foreground">{t("coaching.cell_tip_title")}</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {t("coaching.cell_tip_desc")}
            </p>
            <CloudButton
              variant="brand"
              size="sm"
              className="w-full mt-3 min-h-10"
              onClick={dismissCellTip}
            >
              {t("announcements.got_it")}
            </CloudButton>
          </div>
        </div>
      )}

      <CourseEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        course={editingCourse}
        preset={coursePreset}
        config={ttConfig}
      />
    </div>
  );
}

// ===== 节次网格子组件 =====

type GridItem = {
  key: string;
  kind: "coaching" | "course";
  weekDay: number;
  startSection: number;
  endSection: number;
  color: string;
  title: string;
  subtitle?: string;
  meta?: string;
  schedule?: CoachingWeekSchedule;
  course?: Course;
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function SectionGrid({
  weekDays,
  todayYMD,
  sections,
  items,
  isCoach,
  t,
  onDayHeaderClick,
  onCellClick,
  onItemClick,
}: {
  weekDays: Date[];
  todayYMD: string;
  sections: TimetableConfig["sections"];
  items: GridItem[];
  isCoach: boolean;
  t: TFunction;
  onDayHeaderClick: (d: Date) => void;
  onCellClick: (weekDay: number, section: number) => void;
  onItemClick: (item: GridItem) => void;
}) {
  const totalRows = sections.length;
  const gridStyle = {
    gridTemplateColumns: `48px repeat(7, minmax(0, 1fr))`,
    gridTemplateRows: `40px repeat(${totalRows}, 60px)`,
  } as const;

  return (
    <div className="grid min-w-[680px] rounded-md border border-border bg-card" style={gridStyle}>
      {/* 左上角 */}
      <div className="flex items-center justify-center border-b border-r border-border text-[10px] font-medium text-muted-foreground">
        {t("timetable.section")}
      </div>
      {/* 表头：7 天 */}
      {weekDays.map((d, i) => {
        const ymd = fmtYMD(d);
        const isToday = ymd === todayYMD;
        return (
          <button
            key={`h-${ymd}`}
            type="button"
            data-coach={i === 0 ? "timetable-day" : undefined}
            onClick={() => onDayHeaderClick(d)}
            className={`flex flex-col items-center justify-center border-b border-border px-0.5 text-center touch-manipulation ${
              isToday ? "bg-primary-soft/70" : "bg-surface-soft"
            } ${isCoach ? "active:bg-primary/10" : ""} ${i < 6 ? "border-r border-border/40" : ""}`}
          >
            <span className={`text-[11px] font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
              {t("coaching.weekday_prefix", { day: t(`coaching.weekday.${i}`) })}
            </span>
            <span className={`text-[10px] tabular-nums ${isToday ? "text-primary" : "text-muted-foreground"}`}>
              {fmtMD(d)}
            </span>
          </button>
        );
      })}

      {/* 节次标签 + 空白格 */}
      {sections.map((sec) => (
        <div key={`sec-${sec.no}`} className="contents">
          <div className="flex flex-col items-center justify-center border-b border-r border-border px-0.5 text-center">
            <span className="text-xs font-semibold text-foreground">{sec.no}</span>
            <span className="text-[9px] leading-tight text-muted-foreground">{sec.start}</span>
            <span className="text-[9px] leading-tight text-muted-foreground">{sec.end}</span>
          </div>
          {Array.from({ length: 7 }, (_, dayIdx) => (
            <button
              key={`cell-${sec.no}-${dayIdx}`}
              type="button"
              onClick={() => onCellClick(dayIdx + 1, sec.no)}
              className={`border-b border-border ${dayIdx < 6 ? "border-r" : ""} hover:bg-accent/40 transition-colors`}
              aria-label={`${t(`coaching.weekday.${dayIdx}`)} ${sec.no}`}
            />
          ))}
        </div>
      ))}

      {/* 课程/预约色块 */}
      {items.map((item) => {
        const col = item.weekDay + 1;
        const rowStart = item.startSection + 1;
        const rowEnd = item.endSection + 2;
        const span = item.endSection - item.startSection + 1;
        const showDetail = span >= 2;
        return (
          <button
            key={item.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onItemClick(item);
            }}
            className="group relative m-0.5 flex flex-col overflow-hidden rounded-md p-1 text-left text-white shadow-sm transition-transform hover:z-10 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{
              gridColumn: col,
              gridRow: `${rowStart} / ${rowEnd}`,
              backgroundColor: item.color,
              borderColor: hexToRgba(item.color, 0.5),
            }}
            title={`${item.title}${item.subtitle ? " " + item.subtitle : ""}${item.meta ? " · " + item.meta : ""}`}
          >
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{item.title}</span>
            {showDetail && (
              <>
                {item.subtitle && (
                  <span className="mt-0.5 line-clamp-1 text-[9px] leading-tight opacity-90">{item.subtitle}</span>
                )}
                {item.meta && (
                  <span className="mt-auto line-clamp-1 text-[9px] leading-tight opacity-80">{item.meta}</span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
