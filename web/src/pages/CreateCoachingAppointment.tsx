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
import {
  CloudDatePicker,
  CloudSelect,
  CloudTimePicker,
} from "../components/cloudsteps/arco";
import { Textarea } from "../components/ui/textarea";
import { showToast } from "../utils/toast";
import { cn } from "../utils/cn";

const DURATION_PRESETS = [30, 45, 60] as const;

const REPEAT_OPTIONS = [
  { value: "none", label: "不重复" },
  { value: "weekly4", label: "每周（连续 4 周）" },
  { value: "daily7", label: "每天（连续 7 天）" },
] as const;

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

/**
 * 添加课程 — 全页排课表单（替代原备课页内模态框）
 */
export default function CreateCoachingAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get("date") || fmtYMD(new Date());
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
    if (repeat === "weekly4") {
      return [0, 1, 2, 3].map((i) => addDaysYMD(date, i * 7));
    }
    if (repeat === "daily7") {
      return [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysYMD(date, i));
    }
    return [date];
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
    const startHm = start.length === 5 ? start : start.slice(0, 5);
    const endHm = end.length === 5 ? end : end.slice(0, 5);
    if (parseHm(endHm) <= parseHm(startHm)) {
      showToast.warning("结束时间需晚于开始时间");
      return;
    }

    const dates = scheduleDates();
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
      <PageBackHeader title="添加课程" fallbackTo="/lesson-prep" maxWidthClass="max-w-lg" />

      <div className="flex-1 max-w-lg w-full mx-auto px-4 py-4 space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">添加课程</h1>

        <section className="space-y-2">
          <p className="text-xs text-muted-foreground px-0.5">学生信息</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <CloudSelect
              label="选择学生"
              sheetTitle="选择学生"
              value={studentId || undefined}
              onChange={(v) => setStudentId(v ?? "")}
              options={studentOptions}
              placeholder={
                loadingQuotas
                  ? "加载中…"
                  : studentOptions.length
                    ? "请点击选择"
                    : "请先添加学员"
              }
              disabled={loadingQuotas || !studentOptions.length}
              allowClear={false}
              showSearch
              className="w-full"
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
            {selectedStudentLabel ? (
              <p className="px-4 pb-3 text-xs text-muted-foreground -mt-1">
                已选：{selectedStudentLabel}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs text-muted-foreground px-0.5">授课时间</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            <div className="px-3 py-2">
              <CloudDatePicker
                label="日期"
                value={date || undefined}
                onChange={(dateString) => setDate(dateString || "")}
              />
            </div>
            <div className="px-3 py-2">
              <CloudSelect
                label="重复设置"
                sheetTitle="重复设置"
                value={repeat}
                onChange={(v) => setRepeat(v || "none")}
                options={[...REPEAT_OPTIONS]}
                allowClear={false}
              />
            </div>
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
          <p className="text-xs text-muted-foreground px-0.5">课程备注</p>
          <div className="bg-card border border-border rounded-2xl p-3">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="请填写课程内容"
              className="min-h-[100px] border-0 bg-transparent shadow-none focus-visible:ring-0 px-1"
            />
          </div>
        </section>
      </div>

      <div className="max-w-lg w-full mx-auto px-4 pb-8 flex gap-3">
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
