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
import { InputNumber, Modal } from "@arco-design/web-react";
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
import { minutesUntilCoachingEnd, parseCoachingSlotEnd } from "../utils/coachingSchedule";
import { showToast } from "../utils/toast";
import { CloudCard, CloudSelect, CloudDatePicker, CloudTimePicker, CloudInput, CloudEmpty, CloudSpin } from "./cloudsteps/arco";
import { CloudButton } from "./cloudsteps";

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
    const inProgress = activeSchedules.find((s) => s.status === "in_progress");
    if (inProgress) return inProgress;
    // 下一节：优先未过结束时间的 scheduled，否则取最近一节
    const upcoming = activeSchedules
      .filter((s) => s.status === "scheduled")
      .find((s) => {
        const end = parseCoachingSlotEnd(s.scheduledDate, s.endTime);
        return !end || end.getTime() >= nowTs;
      });
    return upcoming || activeSchedules.find((s) => s.status === "scheduled");
  }, [activeSchedules, nowTs]);

  const loadQuotas = useCallback(async () => {
    try {
      const res = await getTeacherCoachingQuotas();
      setQuotas(Array.isArray(res.data) ? res.data : []);
    } catch {
      setQuotas([]);
    }
  }, []);

  const loadWeek = useCallback(async (refDate?: string) => {
    const ref = refDate || fmtYMD(weekAnchor);
    setLoadingSchedules(true);
    try {
      const res = await getTeacherCoachingWeek(ref);
      setSchedules(Array.isArray(res.data?.schedules) ? res.data!.schedules : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载课表失败";
      showToast.error(msg);
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
      showToast.warning("请输入至少 2 个字符搜索学员");
      return;
    }
    setSearching(true);
    try {
      const res = await searchCoachingStudents(q);
      setSearchResults(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "搜索失败";
      showToast.error(msg);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const onAddStudent = async () => {
    if (!pickedStudent) {
      showToast.warning("请先选择学员");
      return;
    }
    const mins = Number(quotaMinutes);
    if (Number.isNaN(mins) || mins < 0) {
      showToast.warning("剩余分钟数无效");
      return;
    }
    setAddingStudent(true);
    try {
      const res = await addTeacherCoachingStudent({
        studentId: pickedStudent.id,
        remainingMinutes: mins,
      });
      if (res.code !== 200) {
        showToast.error(res.msg || "添加失败");
        return;
      }
      showToast.success("已添加学员");
      setPickedStudent(null);
      setSearchQ("");
      setSearchResults([]);
      setShowStudentForm(false);
      void loadQuotas();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "添加失败";
      showToast.error(msg);
    } finally {
      setAddingStudent(false);
    }
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
    setCreatingAppt(true);
    try {
      const res = await createTeacherCoachingAppointment({
        studentId: sid,
        scheduledDate: aDate,
        startTime: aStart.length === 5 ? aStart : aStart.slice(0, 5),
        endTime: aEnd.length === 5 ? aEnd : aEnd.slice(0, 5),
        title: aTitle || undefined,
      });
      if (res.code !== 200) {
        showToast.error(res.msg || "创建失败");
        return;
      }
      showToast.success("已创建排课");
      setShowScheduleForm(false);
      setATitle("");
      // 跳到排课所在周并立刻重拉课表（不要等 weekAnchor 异步更新）
      const createdDate = aDate;
      const anchor = new Date(`${createdDate}T12:00:00`);
      if (!Number.isNaN(anchor.getTime())) {
        setWeekAnchor(anchor);
      }
      await loadWeek(createdDate);
      void loadQuotas();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "创建失败";
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
      void loadWeek();
      navigate("/material-selection");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "开始失败";
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
      void loadWeek();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "下课失败";
      showToast.error(msg);
    } finally {
      setPendingActionById((prev) => ({ ...prev, [id]: null }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">陪练排课</h2>
          <p className="text-xs text-muted-foreground mt-1">周范围：{weekRangeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <CloudButton variant="outline" size="sm" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>
            上一周
          </CloudButton>
          <CloudButton variant="outline" size="sm" onClick={() => setWeekAnchor(new Date())}>
            本周
          </CloudButton>
          <CloudButton variant="outline" size="sm" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>
            下一周
          </CloudButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!nextClass}
          onClick={() => {
            if (nextClass?.status === "in_progress") {
              navigate("/material-selection");
            } else if (nextClass) {
              void onStart(nextClass.id);
            }
          }}
          className="h-auto min-h-[96px] flex items-center justify-start p-4 sm:p-5 rounded-xl bg-primary text-primary-foreground border-0 hover:bg-primary-deep transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="text-left w-full min-w-0">
            {nextClass ? (
              <>
                <div className="font-semibold text-sm sm:text-base truncate">
                  {nextClass.title || nextClass.students?.[0] || "当前课程"}
                </div>
                <div className="text-[11px] sm:text-xs opacity-80 mt-1 leading-snug">
                  {nextClass.scheduledDate?.slice(0, 10)} · {nextClass.startTime}–{nextClass.endTime}
                </div>
              </>
            ) : (
              <div className="text-sm opacity-80">暂无待上课程</div>
            )}
          </div>
        </button>

        <CloudCard tint="sky" className="min-h-[96px] p-4 sm:p-5 flex flex-col justify-between border-transparent">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs sm:text-sm">
            <Clock size={16} className="text-secondary-brand shrink-0" />
            <span className="truncate">待上 / 进行中</span>
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-foreground tabular-nums">{activeSchedules.length}</div>
        </CloudCard>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <CloudButton
          variant="brand"
          className="w-full"
          onClick={() => {
            setShowStudentForm(false);
            setShowScheduleForm((v) => !v);
          }}
        >
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Plus size={16} className="shrink-0" />
            新建排课
            {showScheduleForm ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
          </span>
        </CloudButton>
        <CloudButton
          variant="outline"
          className="w-full"
          onClick={() => {
            setShowScheduleForm(false);
            setShowStudentForm((v) => !v);
          }}
        >
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <UserPlus size={16} className="shrink-0" />
            添加学员
            {showStudentForm ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
          </span>
        </CloudButton>
      </div>

      {showScheduleForm && (
        <CloudCard className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#2D3748]">新建排课</h3>
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
          <CloudButton variant="brand" loading={creatingAppt} onClick={() => void onCreateAppt()}>
            确认排课
          </CloudButton>
        </CloudCard>
      )}

      {showStudentForm && (
        <CloudCard className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#2D3748]">添加学员</h3>
          <CloudInput
            value={searchQ}
            onChange={setSearchQ}
            placeholder="搜索用户名、昵称或手机号"
          />
          <CloudButton variant="brand" loading={searching} onClick={() => void onSearchStudents()}>
            搜索
          </CloudButton>
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setPickedStudent(u)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    pickedStudent?.id === u.id
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-primary/50"
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
              style={{ width: "100%", borderRadius: 12, borderColor: "#E2E8F0", height: 40 }}
            />
          </div>
          <CloudButton variant="brand" loading={addingStudent} onClick={() => void onAddStudent()}>
            确认添加
          </CloudButton>
        </CloudCard>
      )}

      <div className="space-y-3">
        {loadingSchedules ? (
          <CloudCard className="p-8">
            <CloudSpin tip="加载中…" />
          </CloudCard>
        ) : activeSchedules.length === 0 ? (
          <CloudCard className="p-6">
            <CloudEmpty description="本周暂无待上课程" />
          </CloudCard>
        ) : (
          activeSchedules.map((s) => {
            const st = s.status;
            const canStart = st === "scheduled"; // 允许提前开始，不再限制时段
            const canEnd = st === "in_progress";
            const slotEnd = parseCoachingSlotEnd(s.scheduledDate, s.endTime);
            const isPastSlot = st === "scheduled" && !!slotEnd && slotEnd.getTime() < nowTs;
            const minsLeft =
              st === "in_progress"
                ? minutesUntilCoachingEnd(s.scheduledDate, s.endTime, nowTs)
                : null;
            const canEnter = st === "in_progress";
            const pendingAction = pendingActionById[s.id] ?? null;
            return (
              <CloudCard
                key={s.id}
                interactive={canEnter}
                onClick={canEnter ? () => navigate("/material-selection") : undefined}
              >
                <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                  {st === "scheduled" && !isPastSlot && (
                    <div className="text-xs text-[#4ECDC4] mt-2">
                      可提前开始上课
                    </div>
                  )}
                  {isPastSlot && (
                    <div className="text-xs text-muted-soft mt-2">
                      计划时段已过，仍可开始或删除
                    </div>
                  )}
                  {st === "in_progress" && minsLeft != null && (
                    <div className="text-xs text-[#4ECDC4] mt-2">
                      上课中 · 距排课结束约 {Math.max(0, minsLeft)} 分钟
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 items-center">
                  {st === "scheduled" && (
                    <CloudButton
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-destructive/35 text-destructive hover:bg-destructive/5 hover:border-destructive/50"
                      aria-label="删除排课"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeleteAppt(s.id);
                      }}
                    >
                      <Trash2 size={15} />
                      删除
                    </CloudButton>
                  )}
                  {canStart && (
                    <CloudButton
                      variant="brand"
                      loading={pendingAction === "start"}
                      disabled={pendingAction !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onStart(s.id);
                      }}
                    >
                      开始上课
                    </CloudButton>
                  )}
                  {canEnd && (
                    <CloudButton
                      variant="destructive"
                      loading={pendingAction === "end"}
                      disabled={pendingAction !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onEnd(s.id);
                      }}
                    >
                      下课
                    </CloudButton>
                  )}
                </div>
                </div>
              </CloudCard>
            );
          })
        )}
      </div>
    </div>
  );
}
