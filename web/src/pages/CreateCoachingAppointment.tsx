import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import {
  createTeacherCoachingAppointment,
  listAllTeacherCoachingQuotas,
  type TeacherCoachingQuotaRow,
} from "../api/coaching";
import { PageBackHeader } from "../components/PageBackHeader";
import { CloudButton } from "../components/cloudsteps";
import { CloudTimePicker } from "../components/cloudsteps/arco";
import {
  MobileDateWheel,
  MobileSelectSheet,
} from "../components/cloudsteps/MobileWheelPicker";
import { Textarea } from "../components/ui/textarea";
import { showToast } from "../utils/toast";
import { cn } from "../utils/cn";

const DURATION_PRESETS = [30, 45, 60] as const;

const REPEAT_OPTIONS = [
  { value: "none", label: "不重复" },
  { value: "weekly4", label: "每周（连续 4 周）" },
  { value: "daily7", label: "每天（连续 7 天）" },
] as const;

function SettingsRow({
  label,
  value,
  placeholder = "请选择",
  muted,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3 px-4 py-3.5 min-h-12">
      <span className="text-sm text-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "flex items-center gap-0.5 min-w-0 text-sm",
          value ? "text-foreground" : "text-muted-foreground",
          muted && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronRight size={16} className="shrink-0 text-muted-foreground/70" />
      </span>
    </div>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseHm(t: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatHm(totalMin: number): string {
  const m = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

function addDaysYMD(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return fmtYMD(d);
}

function studentLabel(
  s?: { displayName?: string; username?: string },
  fallbackId?: number,
) {
  return s?.displayName || s?.username || (fallbackId ? `学员 #${fallbackId}` : "学员");
}

function defaultStartEnd() {
  const now = new Date();
  const startMin = now.getHours() * 60 + now.getMinutes();
  return {
    start: formatHm(startMin),
    end: formatHm(startMin + 60),
  };
}

function clampDateToTodayOrLater(ymd: string): string {
  const today = fmtYMD(new Date());
  if (!ymd || ymd < today) return today;
  return ymd;
}

/**
 * 添加课程 — 全页排课表单（替代原备课页内模态框）
 */
export default function CreateCoachingAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const todayYmd = useMemo(() => fmtYMD(new Date()), []);
  const initialDate = clampDateToTodayOrLater(
    searchParams.get("date") || todayYmd,
  );
  const defaults = useMemo(() => defaultStartEnd(), []);

  const [quotas, setQuotas] = useState<TeacherCoachingQuotaRow[]>([]);
  const [loadingQuotas, setLoadingQuotas] = useState(true);
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [repeat, setRepeat] = useState<string>("none");
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const studentOptions = useMemo(
    () =>
      quotas.map((q) => ({
        value: String(q.studentId),
        label: studentLabel(q.student, q.studentId),
      })),
    [quotas],
  );

  const selectedStudentLabel =
    studentOptions.find((o) => o.value === studentId)?.label || "";
  const selectedRepeatLabel =
    REPEAT_OPTIONS.find((o) => o.value === repeat)?.label || "不重复";

  const durationMin = useMemo(() => {
    const a = parseHm(start);
    const b = parseHm(end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    return b - a;
  }, [start, end]);

  useEffect(() => {
    let cancelled = false;
    setLoadingQuotas(true);
    listAllTeacherCoachingQuotas()
      .then((list) => {
        if (cancelled) return;
        setQuotas(list);
        if (list.length === 1) setStudentId(String(list[0].studentId));
      })
      .catch(() => {
        if (!cancelled) showToast.error("加载学员列表失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingQuotas(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyDuration = (minutes: number) => {
    const a = parseHm(start);
    if (!Number.isFinite(a)) {
      showToast.warning("请先选择开始时间");
      return;
    }
    setEnd(formatHm(a + minutes));
  };

  const scheduleDates = (): string[] => {
    let dates: string[];
    if (repeat === "weekly4") {
      dates = [0, 1, 2, 3].map((i) => addDaysYMD(date, i * 7));
    } else if (repeat === "daily7") {
      dates = [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysYMD(date, i));
    } else {
      dates = [date];
    }
    return dates.filter((d) => d >= todayYmd);
  };

  const onCancel = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/lesson-prep");
  };

  const onSubmit = async () => {
    const sid = Number(studentId);
    if (!sid) {
      showToast.warning("请选择学生");
      return;
    }
    if (!date || !start || !end) {
      showToast.warning("请选择日期与时间");
      return;
    }
    if (date < todayYmd) {
      showToast.warning("不能给今天之前的日期排课");
      setDate(todayYmd);
      return;
    }
    const startHm = start.length === 5 ? start : start.slice(0, 5);
    const endHm = end.length === 5 ? end : end.slice(0, 5);
    if (parseHm(endHm) <= parseHm(startHm)) {
      showToast.warning("结束时间需晚于开始时间");
      return;
    }

    const dates = scheduleDates();
    if (dates.length === 0) {
      showToast.warning("没有可排的日期（需为今天或之后）");
      return;
    }
    setSubmitting(true);
    let ok = 0;
    let fail = 0;
    let lastMsg = "";
    try {
      for (const scheduledDate of dates) {
        try {
          const res = await createTeacherCoachingAppointment({
            studentId: sid,
            scheduledDate,
            startTime: startHm,
            endTime: endHm,
            notes: notes.trim() || undefined,
          });
          if (res.code === 200) ok++;
          else {
            fail++;
            lastMsg = res.msg || "创建失败";
          }
        } catch (e: unknown) {
          fail++;
          lastMsg =
            e && typeof e === "object" && "msg" in e
              ? String((e as { msg: string }).msg)
              : "创建失败";
        }
      }
      if (ok > 0 && fail === 0) {
        showToast.success(ok > 1 ? `已创建 ${ok} 节课` : "已添加课程");
        navigate("/lesson-prep", { replace: true, state: { refreshDate: date } });
        return;
      }
      if (ok > 0) {
        showToast.warning(`成功 ${ok} 节，失败 ${fail} 节${lastMsg ? `：${lastMsg}` : ""}`);
        navigate("/lesson-prep", { replace: true, state: { refreshDate: date } });
        return;
      }
      showToast.error(lastMsg || "添加失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-0 flex flex-col flex-1 bg-background">
      <PageBackHeader title="添加课程" fallbackTo="/lesson-prep" maxWidthClass="max-w-none" />

      <div className="flex-1 w-full space-y-4 py-3">
        <section className="space-y-2">
          <p className="text-xs text-muted-foreground px-3">学生信息</p>
          <div className="bg-card border-y border-border overflow-hidden sm:border sm:rounded-2xl">
            <MobileSelectSheet
              title="选择学生"
              value={studentId || undefined}
              options={studentOptions}
              onChange={setStudentId}
              showSearch
              disabled={loadingQuotas || !studentOptions.length}
              placeholder={
                loadingQuotas
                  ? "加载中…"
                  : studentOptions.length
                    ? "请点击选择"
                    : "请先添加学员"
              }
              trigger={
                <SettingsRow
                  label="选择学生"
                  value={selectedStudentLabel || undefined}
                  placeholder={
                    loadingQuotas
                      ? "加载中…"
                      : studentOptions.length
                        ? "请点击选择"
                        : "请先添加学员"
                  }
                />
              }
            />
            {!loadingQuotas && studentOptions.length === 0 ? (
              <button
                type="button"
                className="w-full px-4 py-3 text-sm text-primary text-left border-t border-border flex items-center justify-between"
                onClick={() => navigate("/my-students")}
              >
                去学员管理添加
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            ) : null}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs text-muted-foreground px-3">授课时间</p>
          <div className="bg-card border-y border-border overflow-hidden divide-y divide-border sm:border sm:rounded-2xl">
            <MobileDateWheel
              value={date || undefined}
              sheetTitle="选择日期"
              onChange={(dateString) => {
                const next = dateString || "";
                if (next && next < todayYmd) {
                  showToast.info("不能选择今天之前的日期");
                  setDate(todayYmd);
                  return;
                }
                setDate(next);
              }}
              trigger={
                <SettingsRow
                  label="日期"
                  value={date ? date.replace(/-/g, "/") : undefined}
                  placeholder="请选择日期"
                />
              }
            />
            <MobileSelectSheet
              title="重复设置"
              value={repeat}
              options={[...REPEAT_OPTIONS]}
              onChange={(v) => setRepeat(v || "none")}
              trigger={
                <SettingsRow label="重复设置" value={selectedRepeatLabel} />
              }
            />
            <div className="px-4 py-5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">开始时间</p>
                  <CloudTimePicker
                    format="HH:mm"
                    value={start || undefined}
                    onChange={(timeString) => setStart(timeString || "")}
                  />
                </div>
                <span className="pb-3 text-sm text-muted-foreground">至</span>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">结束时间</p>
                  <CloudTimePicker
                    format="HH:mm"
                    value={end || undefined}
                    onChange={(timeString) => setEnd(timeString || "")}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {DURATION_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => applyDuration(m)}
                    className={cn(
                      "h-9 px-4 rounded-full text-sm font-medium border transition-colors touch-manipulation",
                      durationMin === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/50",
                    )}
                  >
                    {m}分钟
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs text-muted-foreground px-3">课程备注</p>
          <div className="bg-card border-y border-border p-3 sm:border sm:rounded-2xl">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="请填写课程内容"
              className="min-h-[100px] border-0 bg-transparent shadow-none focus-visible:ring-0 px-1"
            />
          </div>
        </section>
      </div>

      <div className="w-full px-3 pb-8 flex gap-3">
        <CloudButton
          type="button"
          variant="outline"
          className="flex-1 min-h-11 rounded-xl"
          disabled={submitting}
          onClick={onCancel}
        >
          取消
        </CloudButton>
        <CloudButton
          type="button"
          variant="brand"
          className="flex-1 min-h-11 rounded-xl"
          loading={submitting}
          onClick={() => void onSubmit()}
        >
          确认添加
        </CloudButton>
      </div>
    </div>
  );
}
