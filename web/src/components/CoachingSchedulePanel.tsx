import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  UserPlus,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Button,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Select,
  Spin,
  TimePicker,
} from "@arco-design/web-react";
import {
  addTeacherCoachingStudent,
  createTeacherCoachingAppointment,
  deleteTeacherCoachingAppointment,
  endCoachingAppointment,
  getTeacherCoachingQuotas,
  getTeacherCoachingWeek,
  searchCoachingStudents,
  startCoachingAppointment,
  type CoachingStudentSearchResult,
  type CoachingWeekSchedule,
  type TeacherCoachingQuotaRow,
} from "../api/coaching";
import { isWithinCoachingStartWindow, minutesUntilCoachingEnd } from "../utils/coachingSchedule";

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

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

type Props = {
  nowTs: number;
};

export function CoachingSchedulePanel({ nowTs }: Props) {
  const navigate = useNavigate();
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [schedules, setSchedules] = useState<CoachingWeekSchedule[]>([]);
  const [quotas, setQuotas] = useState<TeacherCoachingQuotaRow[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [pendingActionById, setPendingActionById] = useState<Record<number, "start" | "end" | null>>({});
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);

  const [aStudent, setAStudent] = useState("");
  const [aDate, setADate] = useState(fmtYMD(new Date()));
  const [aStart, setAStart] = useState("09:00");
  const [aEnd, setAEnd] = useState("10:00");
  const [aTitle, setATitle] = useState("");
  const [creatingAppt, setCreatingAppt] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<CoachingStudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedStudent, setPickedStudent] = useState<CoachingStudentSearchResult | null>(null);
  const [quotaMinutes, setQuotaMinutes] = useState(60);
  const [addingStudent, setAddingStudent] = useState(false);

  const weekMon = useMemo(() => weekMonday(weekAnchor), [weekAnchor]);
  const weekSun = useMemo(() => addDays(weekMon, 6), [weekMon]);
  const weekRangeLabel = useMemo(
    () => `${fmtYMD(weekMon).replace(/-/g, ".")} – ${fmtYMD(weekSun).replace(/-/g, ".")}`,
    [weekMon, weekSun]
  );

  const activeSchedules = useMemo(
    () =>
      schedules.filter((s) => s.status === "scheduled" || s.status === "in_progress"),
    [schedules]
  );

  const nextClass = useMemo(() => {
    const now = nowTs;
    const inProgress = activeSchedules.find((s) => s.status === "in_progress");
    if (inProgress) return inProgress;
    return activeSchedules.find(
      (s) =>
        s.status === "scheduled" &&
        isWithinCoachingStartWindow(s.scheduledDate, s.startTime, s.endTime, now)
    );
  }, [activeSchedules, nowTs]);

  const loadQuotas = useCallback(async () => {
    try {
      const res = await getTeacherCoachingQuotas();
      setQuotas(Array.isArray(res.data) ? res.data : []);
    } catch {
      setQuotas([]);
    }
  }, []);

  const loadWeek = useCallback(async () => {
    const ref = fmtYMD(weekAnchor);
    setLoadingSchedules(true);
    try {
      const res = await getTeacherCoachingWeek(ref);
      setSchedules(Array.isArray(res.data?.schedules) ? res.data!.schedules : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载课表失败";
      alert(msg);
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  }, [weekAnchor]);

  useEffect(() => {
    void loadWeek();
    void loadQuotas();
  }, [loadWeek, loadQuotas]);

  const studentOptions = useMemo(
    () =>
      quotas.map((q) => ({
        value: String(q.studentId),
        label: studentLabel(q.student, q.studentId),
      })),
    [quotas]
  );

  const onSearchStudents = async () => {
    const q = searchQ.trim();
    if (q.length < 2) {
      alert("请输入至少 2 个字符搜索学员");
      return;
    }
    setSearching(true);
    try {
      const res = await searchCoachingStudents(q);
      setSearchResults(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "搜索失败";
      alert(msg);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const onAddStudent = async () => {
    if (!pickedStudent) {
      alert("请先选择学员");
      return;
    }
    const mins = Number(quotaMinutes);
    if (Number.isNaN(mins) || mins < 0) {
      alert("剩余分钟数无效");
      return;
    }
    setAddingStudent(true);
    try {
      const res = await addTeacherCoachingStudent({
        studentId: pickedStudent.id,
        remainingMinutes: mins,
      });
      if (res.code !== 200) {
        alert(res.msg || "添加失败");
        return;
      }
      setPickedStudent(null);
      setSearchQ("");
      setSearchResults([]);
      setShowStudentForm(false);
      void loadQuotas();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "添加失败";
      alert(msg);
    } finally {
      setAddingStudent(false);
    }
  };

  const onCreateAppt = async () => {
    const sid = Number(aStudent);
    if (!sid) {
      alert("请选择学员");
      return;
    }
    setCreatingAppt(true);
    try {
      const res = await createTeacherCoachingAppointment({
        studentId: sid,
        scheduledDate: aDate,
        startTime: aStart,
        endTime: aEnd,
        title: aTitle || undefined,
      });
      if (res.code !== 200) {
        alert(res.msg || "创建失败");
        return;
      }
      setShowScheduleForm(false);
      setATitle("");
      void loadWeek();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "创建失败";
      alert(msg);
    } finally {
      setCreatingAppt(false);
    }
  };

  const onDeleteAppt = async (id: number) => {
    if (!confirm("确定删除该排课？")) return;
    try {
      const res = await deleteTeacherCoachingAppointment(id);
      if (res.code !== 200) {
        alert(res.msg || "删除失败");
        return;
      }
      void loadWeek();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "删除失败";
      alert(msg);
    }
  };

  const onStart = async (id: number) => {
    setPendingActionById((prev) => ({ ...prev, [id]: "start" }));
    try {
      const res = await startCoachingAppointment(id);
      if (res.code !== 200) {
        alert(res.msg || "无法开始");
        return;
      }
      void loadWeek();
      navigate("/material-selection");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "开始失败";
      alert(msg);
    } finally {
      setPendingActionById((prev) => ({ ...prev, [id]: null }));
    }
  };

  const onEnd = async (id: number) => {
    setPendingActionById((prev) => ({ ...prev, [id]: "end" }));
    try {
      const res = await endCoachingAppointment(id);
      if (res.code !== 200) {
        alert(res.msg || "无法下课");
        return;
      }
      void loadWeek();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "下课失败";
      alert(msg);
    } finally {
      setPendingActionById((prev) => ({ ...prev, [id]: null }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[#2D3748]">陪练排课</h2>
          <p className="text-xs text-[#718096] mt-1">周范围：{weekRangeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="small" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>
            上一周
          </Button>
          <Button size="small" onClick={() => setWeekAnchor(new Date())}>
            本周
          </Button>
          <Button size="small" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>
            下一周
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          type="primary"
          disabled={!nextClass}
          onClick={() => {
            if (nextClass?.status === "in_progress") {
              navigate("/material-selection");
            } else if (nextClass) {
              void onStart(nextClass.id);
            }
          }}
          className="!h-auto min-h-[96px] !flex !items-center !justify-start !p-5 !rounded-2xl !bg-gradient-to-br !from-[#4ECDC4] !to-[#55A3FF] !border-0 shadow-md hover:shadow-lg"
        >
          <div className="text-left w-full">
            {nextClass ? (
              <>
                <div className="font-semibold text-base truncate">
                  {nextClass.title || nextClass.students?.[0] || "当前课程"}
                </div>
                <div className="text-xs opacity-80 mt-1">
                  {nextClass.scheduledDate?.slice(0, 10)} · {nextClass.startTime}–{nextClass.endTime}
                </div>
              </>
            ) : (
              <div className="text-sm opacity-80">暂无待上课程</div>
            )}
          </div>
        </Button>

        <div className="min-h-[96px] rounded-2xl bg-white border border-[#E2E8F0] p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 text-[#718096] text-sm">
            <Clock size={16} className="text-[#55A3FF]" />
            <span>待上 / 进行中</span>
          </div>
          <div className="text-3xl font-bold text-[#2D3748] tabular-nums">{activeSchedules.length}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="primary" onClick={() => setShowScheduleForm((v) => !v)}>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Plus size={16} className="shrink-0" />
            新建排课
            {showScheduleForm ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
          </span>
        </Button>
        <Button onClick={() => setShowStudentForm((v) => !v)}>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <UserPlus size={16} className="shrink-0" />
            添加学员
            {showStudentForm ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
          </span>
        </Button>
      </div>

      {showScheduleForm && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-[#2D3748]">新建排课</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#718096] mb-1 block">学员</label>
              <Select
                value={aStudent || undefined}
                onChange={(v) => setAStudent(v ?? "")}
                options={studentOptions}
                placeholder={studentOptions.length ? "选择学员" : "请先添加学员"}
                disabled={!studentOptions.length}
                allowClear={false}
                showSearch
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="text-xs text-[#718096] mb-1 block">日期</label>
              <DatePicker
                value={aDate || undefined}
                onChange={(dateString) => setADate(dateString || "")}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="text-xs text-[#718096] mb-1 block">开始时间</label>
              <TimePicker
                format="HH:mm"
                value={aStart || undefined}
                onChange={(timeString) => setAStart(timeString || "")}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="text-xs text-[#718096] mb-1 block">结束时间</label>
              <TimePicker
                format="HH:mm"
                value={aEnd || undefined}
                onChange={(timeString) => setAEnd(timeString || "")}
                style={{ width: "100%" }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-[#718096] mb-1 block">标题（可选）</label>
              <Input
                value={aTitle}
                onChange={setATitle}
                placeholder="如：四级词汇陪练"
              />
            </div>
          </div>
          <Button type="primary" loading={creatingAppt} onClick={() => void onCreateAppt()}>
            确认排课
          </Button>
        </div>
      )}

      {showStudentForm && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-[#2D3748]">添加学员</h3>
          <Input.Search
            value={searchQ}
            onChange={setSearchQ}
            placeholder="搜索用户名、昵称或手机号"
            searchButton="搜索"
            loading={searching}
            onSearch={() => void onSearchStudents()}
          />
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setPickedStudent(u)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    pickedStudent?.id === u.id
                      ? "border-[#4ECDC4] bg-[#4ECDC4]/5"
                      : "border-[#E2E8F0] hover:border-[#4ECDC4]/50"
                  }`}
                >
                  <div className="text-sm font-medium text-[#2D3748]">
                    {u.displayName || u.username}
                  </div>
                  <div className="text-xs text-[#718096] mt-0.5">
                    {u.username} {u.phone ? `· ${u.phone}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div>
            <label className="text-xs text-[#718096] mb-1 block">陪练剩余分钟</label>
            <InputNumber
              min={0}
              value={quotaMinutes}
              onChange={(v) => setQuotaMinutes(typeof v === "number" ? v : 0)}
              style={{ width: "100%" }}
            />
          </div>
          <Button type="primary" loading={addingStudent} onClick={() => void onAddStudent()}>
            确认添加
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {loadingSchedules ? (
          <div className="bg-white rounded-2xl p-8 flex justify-center shadow-sm">
            <Spin tip="加载中…" />
          </div>
        ) : activeSchedules.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <Empty description="本周暂无待上课程" />
          </div>
        ) : (
          activeSchedules.map((s) => {
            const st = s.status;
            const inStartWindow =
              st === "scheduled" &&
              isWithinCoachingStartWindow(s.scheduledDate, s.startTime, s.endTime, nowTs);
            const canStart = st === "scheduled" && inStartWindow;
            const canEnd = st === "in_progress";
            const minsLeft =
              st === "in_progress"
                ? minutesUntilCoachingEnd(s.scheduledDate, s.endTime, nowTs)
                : null;
            const canEnter = st === "in_progress";
            const pendingAction = pendingActionById[s.id] ?? null;
            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  canEnter ? "cursor-pointer hover:border-[#4ECDC4] hover:shadow-md transition-all" : ""
                }`}
                onClick={() => {
                  if (canEnter) navigate("/material-selection");
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[#2D3748]">{s.title || `排课 #${s.id}`}</div>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-[#718096]">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={14} /> {s.scheduledDate?.slice?.(0, 10) || s.scheduledDate}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} /> {s.startTime}–{s.endTime}
                    </span>
                    {s.students && s.students.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users size={14} /> {s.students.join("、")}
                      </span>
                    )}
                  </div>
                  {st === "scheduled" && !inStartWindow && (
                    <div className="text-xs text-amber-600 mt-2">
                      仅可在排课时段 {s.startTime}–{s.endTime} 内开始上课
                    </div>
                  )}
                  {st === "in_progress" && minsLeft != null && (
                    <div className="text-xs text-[#4ECDC4] mt-2">
                      上课中 · 距排课结束约 {Math.max(0, minsLeft)} 分钟
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {st === "scheduled" && (
                    <Button
                      icon={<Trash2 size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeleteAppt(s.id);
                      }}
                    />
                  )}
                  {canStart && (
                    <Button
                      type="primary"
                      loading={pendingAction === "start"}
                      disabled={pendingAction !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onStart(s.id);
                      }}
                    >
                      开始上课
                    </Button>
                  )}
                  {canEnd && (
                    <Button
                      status="danger"
                      type="primary"
                      loading={pendingAction === "end"}
                      disabled={pendingAction !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onEnd(s.id);
                      }}
                    >
                      下课
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
