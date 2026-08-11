import { Calendar, Clock, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { CoachingSchedulePanel } from "../components/CoachingSchedulePanel";
import { useAuthStore } from "../stores/authStore";
import { getStudentCoachingWeek, type CoachingWeekSchedule } from "../api/coaching";

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [studentSchedules, setStudentSchedules] = useState<CoachingWeekSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  const role = (user as { role?: string } | null)?.role || "user";
  const isStudent = role === "student";
  const isCoach = role === "teacher" || role === "user";

  const loadStudentWeek = useCallback(async () => {
    if (!isStudent) return;
    const ref = fmtYMD(weekAnchor);
    setLoadingSchedules(true);
    try {
      const res = await getStudentCoachingWeek(ref);
      setStudentSchedules(Array.isArray(res.data?.schedules) ? res.data!.schedules : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载课表失败";
      console.error(e);
      alert(msg);
      setStudentSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  }, [weekAnchor, isStudent]);

  useEffect(() => {
    void loadStudentWeek();
  }, [loadStudentWeek]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const studentActiveSchedules = useMemo(
    () =>
      studentSchedules.filter((s) => s.status === "scheduled" || s.status === "in_progress"),
    [studentSchedules]
  );

  const weekRangeLabel = useMemo(() => {
    const d = weekAnchor;
    const wd = d.getDay();
    const fromMon = (wd + 6) % 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - fromMon);
    const sun = addDays(mon, 6);
    return `${fmtYMD(mon).replace(/-/g, ".")} – ${fmtYMD(sun).replace(/-/g, ".")}`;
  }, [weekAnchor]);

  return (
    <div className="space-y-6">
      {isCoach && <CoachingSchedulePanel nowTs={nowTs} />}

      {isStudent && (
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">我的课表</h2>
              <p className="text-xs text-muted-foreground mt-1">周范围：{weekRangeLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <CloudButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
              >
                上一周
              </CloudButton>
              <CloudButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWeekAnchor(new Date())}
              >
                本周
              </CloudButton>
              <CloudButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
              >
                下一周
              </CloudButton>
            </div>
          </div>
          <div className="space-y-3">
            {loadingSchedules ? (
              <CloudCard className="p-6 text-center text-muted-foreground">加载中…</CloudCard>
            ) : studentActiveSchedules.length === 0 ? (
              <CloudCard className="p-6 text-center text-muted-foreground">暂无待上课程</CloudCard>
            ) : (
              studentActiveSchedules.map((s) => (
                <CloudCard key={s.id} className="p-4">
                  <div className="font-medium text-foreground">{s.title || `排课 #${s.id}`}</div>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={14} /> {s.scheduledDate?.slice?.(0, 10) || s.scheduledDate}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} /> {s.startTime}–{s.endTime}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User size={14} /> 状态：{s.status}
                    </span>
                  </div>
                </CloudCard>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
