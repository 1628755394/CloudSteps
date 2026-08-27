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
import { useNavigate } from "react-router";
import { DatePicker, Modal } from "@arco-design/web-react";
import {
  createTeacherCoachingAppointment,
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
  measureCoachTarget,
  type CoachTargetRect,
} from "../utils/coachOnboarding";
import { showToast } from "../utils/toast";
import { useAuthStore } from "../stores/authStore";
import { useIsMobile } from "./ui/use-mobile";
import { MobileDateWheel } from "./cloudsteps/MobileWheelPicker";
import {
  CloudSelect,
  CloudDatePicker,
  CloudTimePicker,
  CloudInput,
  CloudSpin,
} from "./cloudsteps/arco";
import { CloudButton } from "./cloudsteps";

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

function studentLabel(s?: { displayName?: string; username?: string }, fallbackId?: number) {
  return s?.displayName || s?.username || (fallbackId ? `学员 #${fallbackId}` : "学员");
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"] as const;
const DAY_HEADER_H = 48;
const TIMELINE_MIN_H = 280;
const EVENT_MIN_H = 52;

const STATUS_LABEL: Record<string, string> = {
  scheduled: "待上课",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
};

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

function lessonDisplay(s: CoachingWeekSchedule): { title: string; subtitle?: string } {
  const student = s.students?.[0]?.trim() || "";
  let title = s.title?.trim() || "";
  // 兼容旧默认标题「姓名 · 陪练」
  title = title.replace(/\s*[·•]\s*陪练\s*$/u, "").trim();
  if (title && student && title !== student) {
    return { title, subtitle: student };
  }
  if (student) return { title: student };
  if (title) return { title };
  return { title: "课程" };
}

function eventLayoutOnAxis(
  startTime: string,
  endTime: string,
  axisStart: number,
  axisEnd: number,
  axisHeight: number,
): { top: number; height: number } {
  const span = Math.max(1, axisEnd - axisStart);
  let s = parseHmToMinutes(startTime);
  let e = parseEndMinutes(endTime);
  if (e <= s) e = s + 30;
  s = Math.max(axisStart, Math.min(s, axisEnd - 5));
  e = Math.max(s + 15, Math.min(e, axisEnd));
  const top = ((s - axisStart) / span) * axisHeight;
  const height = Math.max(EVENT_MIN_H, ((e - s) / span) * axisHeight);
  return { top, height };
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

/** 课表内课程块（窄列友好） */
function TimetableBlock({
  schedule,
  height,
  onClick,
}: {
  schedule: CoachingWeekSchedule;
  height: number;
  onClick: () => void;
}) {
  const soft = STATUS_SOFT[schedule.status] || STATUS_SOFT.scheduled;
  const { title } = lessonDisplay(schedule);
  const start = schedule.startTime?.slice(0, 5) || "";
  const end = schedule.endTime?.slice(0, 5) || "";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute left-1 right-1 top-0 z-[1] overflow-hidden rounded-xl ${soft.bg} text-left px-1.5 py-1 shadow-sm active:scale-[0.98] touch-manipulation`}
      style={{ height }}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${soft.bar}`} aria-hidden />
      <div className="pl-1.5 min-w-0 h-full flex flex-col justify-center">
        <div className={`text-[10px] font-semibold tabular-nums leading-tight ${soft.text}`}>
          {start}{height > 40 ? `–${end}` : ""}
        </div>
        {height > 48 ? (
          <div className="text-[11px] font-medium text-foreground leading-tight truncate mt-0.5">
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

const CELL_TIP_PREFIX = "cs_timetable_cell_tip_v1:";

function isCellTipDone(userId: number | string): boolean {
  try {
    return localStorage.getItem(`${CELL_TIP_PREFIX}${userId}`) === "done";
  } catch {
    return false;
  }
}

function markCellTipDone(userId: number | string): void {
  try {
    localStorage.setItem(`${CELL_TIP_PREFIX}${userId}`, "done");
  } catch {
    // ignore
  }
}

export function CoachingSchedulePanel({ nowTs, mode = "coach" }: Props) {
  const navigate = useNavigate();
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
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [selected, setSelected] = useState<CoachingWeekSchedule | null>(null);
  const [showCellTip, setShowCellTip] = useState(false);
  const [tipHole, setTipHole] = useState<CoachTargetRect | null>(null);
  const [tipReady, setTipReady] = useState(false);

  const [aStudent, setAStudent] = useState("");
  const [aDate, setADate] = useState(fmtYMD(new Date()));
  const [aStart, setAStart] = useState("09:00");
  const [aEnd, setAEnd] = useState("10:00");
  const [aTitle, setATitle] = useState("");
  const [creatingAppt, setCreatingAppt] = useState(false);

  const weekMon = useMemo(() => weekMonday(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekMon, i)),
    [weekMon],
  );
  const todayYMD = fmtYMD(new Date());
  const weekShortLabel = `${fmtMD(weekMon)}–${fmtMD(addDays(weekMon, 6))}`;

  const bodyRef = useRef<HTMLDivElement>(null);
  const [gridBodyH, setGridBodyH] = useState(0);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setGridBodyH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    const pad = 45;
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

  const availableH = Math.max(0, gridBodyH - DAY_HEADER_H);
  const timelineH = Math.max(availableH, TIMELINE_MIN_H);
  const emptyDayH = Math.max(availableH, 200);
  /** H5：列加宽，默认只露出工作日，周六日需右滑 */
  const dayColPx = isMobile ? 96 : 60;
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
            : "加载课表失败";
        showToast.error(msg);
        setSchedules([]);
      } finally {
        setLoadingSchedules(false);
      }
    },
    [weekAnchor, isCoach],
  );

  useEffect(() => {
    void loadWeek();
    void loadQuotas();
  }, [loadWeek, loadQuotas]);

  useEffect(() => {
    if (!isCoach || !userId || loadingSchedules) return;
    if (isCellTipDone(userId)) return;
    setShowCellTip(true);
  }, [isCoach, userId, loadingSchedules]);

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
    if (userId) markCellTipDone(userId);
    setShowCellTip(false);
    setTipHole(null);
  };

  const studentOptions = useMemo(
    () =>
      quotas.map((q) => ({
        value: String(q.studentId),
        label: studentLabel(q.student, q.studentId),
      })),
    [quotas],
  );

  const openScheduleForDay = (day: Date) => {
    if (!isCoach) return;
    if (studentOptions.length === 0) {
      showToast.info("请先在学员管理中添加学员，再来排课");
      navigate("/my-students");
      return;
    }
    setADate(fmtYMD(day));
    setAStart("09:00");
    setAEnd("10:00");
    setATitle("");
    if (!aStudent && studentOptions[0]) setAStudent(studentOptions[0].value);
    setShowScheduleForm(true);
  };

  const jumpToWeekOf = (dateString: string) => {
    if (!dateString) return;
    const d = new Date(`${dateString}T12:00:00`);
    if (!Number.isNaN(d.getTime())) setWeekAnchor(weekMonday(d));
  };

  const onCreateAppt = async () => {
    const sid = Number(aStudent);
    if (!sid) {
      showToast.warning("请选择学员");
      return;
    }
    if (!aDate || !aStart || !aEnd) {
      showToast.warning("请选择日期与时间");
      return;
    }
    const start = aStart.length === 5 ? aStart : aStart.slice(0, 5);
    const end = aEnd.length === 5 ? aEnd : aEnd.slice(0, 5);
    if (parseEndMinutes(end) <= parseHmToMinutes(start)) {
      showToast.warning("结束时间需晚于开始时间");
      return;
    }
    setCreatingAppt(true);
    try {
      const res = await createTeacherCoachingAppointment({
        studentId: sid,
        scheduledDate: aDate,
        startTime: start,
        endTime: end,
        title: aTitle || undefined,
      });
      if (res.code !== 200) {
        showToast.error(res.msg || "创建失败");
        return;
      }
      showToast.success("已创建排课");
      setShowScheduleForm(false);
      setATitle("");
      const createdDate = aDate;
      const anchor = new Date(`${createdDate}T12:00:00`);
      if (!Number.isNaN(anchor.getTime())) setWeekAnchor(anchor);
      await loadWeek(createdDate);
      void loadQuotas();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : "创建失败";
      showToast.error(msg);
    } finally {
      setCreatingAppt(false);
    }
  };

  const onDeleteAppt = async (id: number) => {
    Modal.confirm({
      title: "删除排课",
      content: "确定删除该排课？删除后不可恢复。",
      okText: "确定删除",
      cancelText: "取消",
      okButtonProps: { status: "danger" },
      onOk: async () => {
        try {
          const res = await deleteTeacherCoachingAppointment(id);
          if (res.code !== 200) {
            showToast.error(res.msg || "删除失败");
            return;
          }
          showToast.success("已删除排课");
          setSelected(null);
          void loadWeek();
        } catch (e: unknown) {
          const msg =
            e && typeof e === "object" && "msg" in e
              ? String((e as { msg: string }).msg)
              : "删除失败";
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
        showToast.error(res.msg || "无法开始");
        return;
      }
      showToast.success("已开始上课");
      setSelected(null);
      void loadWeek();
      navigate("/material-selection");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : "开始失败";
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
        showToast.error(res.msg || "无法下课");
        return;
      }
      showToast.success("已下课");
      setSelected(null);
      void loadWeek();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : "下课失败";
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
    <div className="flex flex-1 flex-col min-h-0 h-full overflow-hidden bg-card sm:rounded-xl sm:border sm:border-border">
      {/* 紧凑顶栏：标题 + 周切换同一行 */}
      <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border">
        <h2 className="text-[15px] font-semibold text-foreground shrink-0 leading-none">
          {isCoach ? "陪练排课" : "我的课表"}
        </h2>
        <span className="inline-flex items-center rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0 leading-none">
          待上 {activeCount}
        </span>

        <div className="flex-1 min-w-0" />

        <CloudButton
          variant="outline"
          size="sm"
          className="shrink-0 size-8 p-0 touch-manipulation"
          aria-label="上一周"
          onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
        >
          <ChevronLeft size={16} />
        </CloudButton>

        <div className="w-[7.5rem] sm:w-[9.5rem] shrink-0">
          {isMobile ? (
            <MobileDateWheel
              value={fmtYMD(weekMon)}
              allowClear={false}
              placeholder="选择周"
              displayValue={weekShortLabel}
              sheetTitle="选择某一天（跳转到该周）"
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
          aria-label="下一周"
          onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
        >
          <ChevronRight size={16} />
        </CloudButton>
      </div>

      {/* 周课表：点天排课；有课后按真实时间渲染 */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-hidden">
        {loadingSchedules ? (
          <div className="h-full flex items-center justify-center">
            <CloudSpin tip="加载课表…" />
          </div>
        ) : (
          <div className="h-full overflow-auto overscroll-contain">
            {!axisRange ? (
              <div
                className="grid h-full"
                style={{
                  width: isMobile ? emptyGridMinW : "100%",
                  minWidth: emptyGridMinW,
                  gridTemplateColumns: isMobile
                    ? `repeat(7, ${dayColPx}px)`
                    : `repeat(7, minmax(${dayColPx}px, 1fr))`,
                  gridTemplateRows: `${DAY_HEADER_H}px 1fr`,
                  minHeight: DAY_HEADER_H + emptyDayH,
                }}
              >
                {weekDays.map((d, i) => {
                  const ymd = fmtYMD(d);
                  const isToday = ymd === todayYMD;
                  return (
                    <button
                      key={`h-${ymd}`}
                      type="button"
                      data-coach={i === 0 ? "timetable-day" : undefined}
                      disabled={!isCoach}
                      onClick={() => {
                        if (!isCoach) return;
                        dismissCellTip();
                        openScheduleForDay(d);
                      }}
                      className={`sticky top-0 z-20 border-b border-border/70 px-0.5 py-1.5 text-center touch-manipulation ${
                        isToday ? "bg-primary-soft/70" : "bg-surface-soft"
                      } ${isCoach ? "active:bg-primary/10" : ""} ${
                        i < 6 ? "border-r border-border/40" : ""
                      }`}
                    >
                      <div
                        className={`text-[11px] font-semibold ${
                          isToday ? "text-primary" : "text-foreground"
                        }`}
                      >
                        周{WEEKDAY_LABELS[i]}
                      </div>
                      <div
                        className={`text-[10px] tabular-nums mt-0.5 ${
                          isToday ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {fmtMD(d)}
                      </div>
                    </button>
                  );
                })}
                {weekDays.map((d, i) => {
                  const ymd = fmtYMD(d);
                  const isToday = ymd === todayYMD;
                  return (
                    <button
                      key={`b-${ymd}`}
                      type="button"
                      disabled={!isCoach}
                      onClick={() => {
                        if (!isCoach) return;
                        dismissCellTip();
                        openScheduleForDay(d);
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 touch-manipulation ${
                        isToday ? "bg-primary/[0.04]" : ""
                      } ${isCoach ? "active:bg-primary/[0.08]" : ""} ${
                        i < 6 ? "border-r border-border/30" : ""
                      }`}
                      style={{ minHeight: emptyDayH }}
                    >
                      {isCoach ? (
                        <>
                          <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                            <Plus size={18} />
                          </span>
                          <span className="text-[11px] text-muted-foreground">排课</span>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">暂无课程</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                className="grid"
                style={{
                  width: isMobile ? weekGridMinW : "100%",
                  minWidth: weekGridMinW,
                  gridTemplateColumns: isMobile
                    ? `${timeGutterPx}px repeat(7, ${dayColPx}px)`
                    : `${timeGutterPx}px repeat(7, minmax(${dayColPx}px, 1fr))`,
                  gridTemplateRows: `${DAY_HEADER_H}px ${timelineH}px`,
                }}
              >
                <div className="sticky top-0 left-0 z-30 bg-surface-soft border-b border-r border-border/70" />
                {weekDays.map((d, i) => {
                  const ymd = fmtYMD(d);
                  const isToday = ymd === todayYMD;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      data-coach={i === 0 ? "timetable-day" : undefined}
                      disabled={!isCoach}
                      onClick={() => {
                        if (!isCoach) return;
                        dismissCellTip();
                        openScheduleForDay(d);
                      }}
                      className={`sticky top-0 z-20 border-b border-border/70 px-0.5 py-1.5 text-center touch-manipulation ${
                        isToday ? "bg-primary-soft/70" : "bg-surface-soft"
                      } ${isCoach ? "active:bg-primary/10" : ""} ${
                        i < 6 ? "border-r border-border/40" : ""
                      }`}
                    >
                      <div
                        className={`text-[11px] font-semibold ${
                          isToday ? "text-primary" : "text-foreground"
                        }`}
                      >
                        周{WEEKDAY_LABELS[i]}
                      </div>
                      <div
                        className={`text-[10px] tabular-nums mt-0.5 ${
                          isToday ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {fmtMD(d)}
                        {isCoach ? (
                          <Plus size={10} className="inline ml-0.5 align-[-1px] text-primary/70" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}

                <div
                  className="sticky left-0 z-10 bg-card border-r border-border/70 relative"
                  style={{ height: timelineH }}
                >
                  {axisMarks.map((m) => {
                    const top =
                      ((m - axisRange.startMin) / (axisRange.endMin - axisRange.startMin)) *
                      timelineH;
                    return (
                      <div key={m} className="absolute left-0 right-0 px-0.5" style={{ top }}>
                        <span className="text-[9px] text-muted-foreground tabular-nums leading-none relative -top-1.5">
                          {fmtMinutes(m).slice(0, 5)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {weekDays.map((d, dIdx) => {
                  const ymd = fmtYMD(d);
                  const isToday = ymd === todayYMD;
                  const dayItems = byDay[ymd] || [];
                  return (
                    <div
                      key={ymd}
                      className={`relative ${isToday ? "bg-primary/[0.04]" : ""} ${
                        dIdx < 6 ? "border-r border-border/30" : ""
                      }`}
                      style={{ height: timelineH }}
                    >
                      {axisMarks.map((m) => (
                        <div
                          key={m}
                          className="absolute left-0 right-0 border-t border-border/20 pointer-events-none"
                          style={{
                            top:
                              ((m - axisRange.startMin) /
                                (axisRange.endMin - axisRange.startMin)) *
                              timelineH,
                          }}
                        />
                      ))}

                      {isCoach ? (
                        <button
                          type="button"
                          aria-label={`${ymd} 排课`}
                          className="absolute inset-0 z-0 touch-manipulation"
                          onClick={() => {
                            dismissCellTip();
                            openScheduleForDay(d);
                          }}
                        />
                      ) : null}

                      {dayItems.map((s) => {
                        const { top, height } = eventLayoutOnAxis(
                          s.startTime,
                          s.endTime,
                          axisRange.startMin,
                          axisRange.endMin,
                          timelineH,
                        );
                        return (
                          <div key={s.id} className="absolute left-0 right-0" style={{ top }}>
                            <TimetableBlock
                              schedule={s}
                              height={height}
                              onClick={() => setSelected(s)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 新建排课 */}
      {isCoach && showScheduleForm && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={() => setShowScheduleForm(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">新建排课</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {aDate} · 请选择具体上课时间
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-muted touch-manipulation"
                onClick={() => setShowScheduleForm(false)}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CloudSelect
                label="学员"
                value={aStudent || undefined}
                onChange={(v) => setAStudent(v ?? "")}
                options={studentOptions}
                placeholder={studentOptions.length ? "选择学员" : "请先添加学员"}
                disabled={!studentOptions.length}
                allowClear={false}
                showSearch
              />
              <CloudDatePicker
                label="日期"
                value={aDate || undefined}
                onChange={(dateString) => setADate(dateString || "")}
              />
              <CloudTimePicker
                label="开始时间"
                format="HH:mm"
                value={aStart || undefined}
                onChange={(timeString) => setAStart(timeString || "")}
              />
              <CloudTimePicker
                label="结束时间"
                format="HH:mm"
                value={aEnd || undefined}
                onChange={(timeString) => setAEnd(timeString || "")}
              />
              <div className="sm:col-span-2">
                <CloudInput
                  label="标题（可选）"
                  value={aTitle}
                  onChange={setATitle}
                  placeholder="如：四级词汇陪练"
                />
              </div>
            </div>
            <CloudButton
              variant="brand"
              className="w-full min-h-11"
              loading={creatingAppt}
              onClick={() => void onCreateAppt()}
            >
              确认排课
            </CloudButton>
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {lessonDisplay(selected).title || `排课 #${selected.id}`}
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
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            {selected.students && selected.students.length > 0 ? (
              <div className="text-sm text-muted-foreground">
                学员：{selected.students.join("、")}
              </div>
            ) : null}

            <div className="flex items-center gap-2 text-sm">
              <Clock size={14} className="text-muted-foreground" />
              <span
                className={`font-medium ${(STATUS_SOFT[selected.status] || STATUS_SOFT.scheduled).text}`}
              >
                {STATUS_LABEL[selected.status] || selected.status}
              </span>
              {selected.status === "in_progress" && selectedMinsLeft != null ? (
                <span className="text-xs text-muted-foreground">
                  · 距结束约 {Math.max(0, selectedMinsLeft)} 分钟
                </span>
              ) : null}
              {selectedPast ? (
                <span className="text-xs text-muted-foreground">· 计划时段已过</span>
              ) : null}
            </div>

            {isCoach ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {selected.status === "scheduled" ? (
                  <>
                    <CloudButton
                      variant="outline"
                      size="sm"
                      className="border-destructive/35 text-destructive hover:bg-destructive/5 min-h-10"
                      onClick={() => void onDeleteAppt(selected.id)}
                    >
                      <Trash2 size={14} />
                      删除
                    </CloudButton>
                    <CloudButton
                      variant="brand"
                      size="sm"
                      className="flex-1 min-h-10"
                      loading={selectedPending === "start"}
                      disabled={selectedPending !== null}
                      onClick={() => void onStart(selected.id)}
                    >
                      开始上课
                    </CloudButton>
                  </>
                ) : null}
                {selected.status === "in_progress" ? (
                  <>
                    <CloudButton
                      variant="brandOutline"
                      size="sm"
                      className="flex-1 min-h-10"
                      onClick={() => {
                        setSelected(null);
                        navigate("/material-selection");
                      }}
                    >
                      进入训练
                    </CloudButton>
                    <CloudButton
                      variant="destructive"
                      size="sm"
                      className="min-h-10"
                      loading={selectedPending === "end"}
                      disabled={selectedPending !== null}
                      onClick={() => void onEnd(selected.id)}
                    >
                      下课
                    </CloudButton>
                  </>
                ) : null}
              </div>
            ) : (
              <CloudButton
                variant="outline"
                size="sm"
                className="w-full min-h-10"
                onClick={() => setSelected(null)}
              >
                关闭
              </CloudButton>
            )}
          </div>
        </div>
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
            <h3 className="text-sm font-semibold text-foreground">点击某一天排课</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              点「周几」或空白处自行选择时间；排好后会按真实起止时间显示在课表上。
            </p>
            <CloudButton
              variant="brand"
              size="sm"
              className="w-full mt-3 min-h-10"
              onClick={dismissCellTip}
            >
              知道了
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
            <h3 className="text-sm font-semibold text-foreground">点击某一天排课</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              点「周几」或空白处自行选择时间；排好后会按真实起止时间显示在课表上。
            </p>
            <CloudButton
              variant="brand"
              size="sm"
              className="w-full mt-3 min-h-10"
              onClick={dismissCellTip}
            >
              知道了
            </CloudButton>
          </div>
        </div>
      )}
    </div>
  );
}
