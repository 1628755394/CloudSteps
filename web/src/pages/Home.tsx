import { Calendar, Clock, FileText, User, Users, Timer, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudButton, CloudImageWithFallback } from "../components/cloudsteps";
import { CoachingSchedulePanel } from "../components/CoachingSchedulePanel";
import { useAuthStore } from "../stores/authStore";
import {
  getCoachingTimeStats,
  getStudentCoachingWeek,
  type CoachingTimeStats,
  type CoachingWeekSchedule,
} from "../api/coaching";
import { kickoffVocabTestPrefetch } from "../utils/vocabTestCache";

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [studentSchedules, setStudentSchedules] = useState<CoachingWeekSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [timeStats, setTimeStats] = useState<CoachingTimeStats | null>(null);
  const [loadingTimeStats, setLoadingTimeStats] = useState(true);

  const role = (user as { role?: string } | null)?.role || "user";
  const isStudent = role === "student";
  const isCoach = role === "teacher" || role === "user";
  const displayName =
    (user as { displayName?: string; username?: string })?.displayName ||
    (user as { username?: string })?.username ||
    "-";

  const greetingMeta = useMemo(() => {
    const hour = new Date(nowTs).getHours();
    if (hour < 12) return { en: "Good morning", zh: "上午好", badge: "MORNING · 清晨" };
    if (hour < 18) return { en: "Good afternoon", zh: "下午好", badge: "AFTERNOON · 午后" };
    return { en: "Good evening", zh: "晚上好", badge: "EVENING · 夜晚" };
  }, [nowTs]);

  const todayLabel = useMemo(() => {
    const d = new Date(nowTs);
    const wd = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
    return `${fmtYMD(d).replace(/-/g, ".")} · ${wd}`;
  }, [nowTs]);

  const loadTimeStats = useCallback(async () => {
    if (!user) return;
    setLoadingTimeStats(true);
    try {
      const res = await getCoachingTimeStats();
      setTimeStats(res.data ?? null);
    } catch (e: unknown) {
      console.error("加载时长统计失败:", e);
      setTimeStats(null);
    } finally {
      setLoadingTimeStats(false);
    }
  }, [user]);

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
    void loadTimeStats();
  }, [loadTimeStats]);

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
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4ECDC4]/10 border border-[#4ECDC4]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4]" />
          <span className="text-[11px] font-medium text-[#4ECDC4] tracking-wide">{greetingMeta.badge}</span>
        </div>

        <div>
          <div className="text-xs text-[#718096]">{greetingMeta.en}</div>
          <h1 className="text-2xl font-bold text-[#2D3748] mt-1">{greetingMeta.zh}</h1>
          <p className="text-sm text-[#718096] mt-1">{todayLabel}</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#F7F9FC] border-2 border-[#E2E8F0] overflow-hidden flex items-center justify-center shrink-0">
              {user?.avatar ? (
                <CloudImageWithFallback
                  src={user.avatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-[#4ECDC4]">
                  {(displayName || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold text-[#2D3748] truncate">{displayName}</div>
              <div className="text-sm text-[#718096] mt-0.5">正式陪练 · 单词带背</div>
            </div>
          </div>
        </div>
      </div>

      {(isStudent || isCoach) && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#4ECDC4]/10 rounded-xl flex items-center justify-center">
              <Timer className="text-[#4ECDC4]" size={16} />
            </div>
            <h3 className="text-base font-semibold text-[#2D3748]">陪练时长统计</h3>
          </div>

          {loadingTimeStats ? (
            <div className="text-center text-[#718096] py-4">加载中...</div>
          ) : timeStats ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F7F9FC] rounded-2xl p-4">
                <div className="text-2xl font-bold text-[#2D3748] tabular-nums">
                  {timeStats.todayMinutes}分钟
                </div>
                <div className="text-sm text-[#718096] mt-1">今日陪练时长</div>
                <div className="text-xs text-[#A0AEC0] mt-2">{timeStats.todaySessions} 次陪练</div>
              </div>
              <div className="bg-[#F7F9FC] rounded-2xl p-4">
                <div className="text-2xl font-bold text-[#2D3748] tabular-nums">
                  {timeStats.totalMinutes}分钟
                </div>
                <div className="text-sm text-[#718096] mt-1">累积陪练时长</div>
                <div className="text-xs text-[#A0AEC0] mt-2">{timeStats.totalSessions} 次陪练</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-[#718096] py-4">暂无数据</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CloudButton
          type="button"
          variant="card"
          onClick={() => {
            kickoffVocabTestPrefetch();
            navigate("/vocabulary-test");
          }}
          className="min-h-[112px] !flex-row !items-center gap-5 !p-6 rounded-2xl shadow-sm"
        >
          <div className="w-14 h-14 shrink-0 bg-[#4ECDC4]/10 rounded-2xl flex items-center justify-center">
            <FileText className="text-[#4ECDC4]" size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[#2D3748] text-base md:text-lg font-semibold">词汇测试</div>
            <p className="text-sm text-[#718096] mt-1.5 truncate">进入测评流程</p>
          </div>
          <ChevronRight className="text-[#CBD5E0] shrink-0" size={20} />
        </CloudButton>

        {isCoach ? (
          <CloudButton
            type="button"
            variant="card"
            onClick={() => navigate("/my-students")}
            className="min-h-[112px] !flex-row !items-center gap-5 !p-6 rounded-2xl shadow-sm"
          >
            <div className="w-14 h-14 shrink-0 bg-[#55A3FF]/10 rounded-2xl flex items-center justify-center">
              <Users className="text-[#55A3FF]" size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[#2D3748] text-base md:text-lg font-semibold">学员管理</div>
              <p className="text-sm text-[#718096] mt-1.5 truncate">查看名下学员与陪练剩余时长</p>
            </div>
            <ChevronRight className="text-[#CBD5E0] shrink-0" size={20} />
          </CloudButton>
        ) : (
          <CloudButton
            type="button"
            variant="card"
            onClick={() => navigate("/material-selection")}
            className="min-h-[112px] !flex-row !items-center gap-5 !p-6 rounded-2xl shadow-sm"
          >
            <div className="w-14 h-14 shrink-0 bg-[#55A3FF]/10 rounded-2xl flex items-center justify-center">
              <FileText className="text-[#55A3FF]" size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[#2D3748] text-base md:text-lg font-semibold">单词训练</div>
              <p className="text-sm text-[#718096] mt-1.5 truncate">选择词库开始练习</p>
            </div>
            <ChevronRight className="text-[#CBD5E0] shrink-0" size={20} />
          </CloudButton>
        )}
      </div>

      {isCoach && <CoachingSchedulePanel nowTs={nowTs} />}

      {isStudent && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[#2D3748]">我的课表</h2>
              <p className="text-xs text-[#718096] mt-1">周范围：{weekRangeLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <CloudButton
                type="button"
                className="px-3 py-1.5 rounded-full text-xs border border-[#E2E8F0] text-[#4A5568] bg-white"
                onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
              >
                上一周
              </CloudButton>
              <CloudButton
                type="button"
                className="px-3 py-1.5 rounded-full text-xs border border-[#E2E8F0] text-[#4A5568] bg-white"
                onClick={() => setWeekAnchor(new Date())}
              >
                本周
              </CloudButton>
              <CloudButton
                type="button"
                className="px-3 py-1.5 rounded-full text-xs border border-[#E2E8F0] text-[#4A5568] bg-white"
                onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
              >
                下一周
              </CloudButton>
            </div>
          </div>
          <div className="space-y-3">
            {loadingSchedules ? (
              <div className="bg-white rounded-2xl p-6 text-center text-[#718096] shadow-sm">加载中…</div>
            ) : studentActiveSchedules.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-[#718096] shadow-sm">暂无待上课程</div>
            ) : (
              studentActiveSchedules.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm"
                >
                  <div className="font-medium text-[#2D3748]">{s.title || `排课 #${s.id}`}</div>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-[#718096]">
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
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
