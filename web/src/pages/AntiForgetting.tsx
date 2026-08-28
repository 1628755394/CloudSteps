import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, ChevronLeft, ChevronRight, Clock, Eye } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard, CloudDatePicker, CloudEmpty, CloudSpin } from "../components/cloudsteps/arco";
import { listReviewBooksByDate, type ReviewBookStatRow } from "../api/review";
import { useAuthStore } from "../stores/authStore";
import { formatPracticeTimeRange } from "../utils/reviewPracticeTime";
import { reviewCurveLabel } from "../utils/reviewCurve";

type ReviewBookStat = ReviewBookStatRow;

type ReviewTask = {
  id: string;
  practiceTimeLabel: string;
  student: string;
  vocabularyPack: string;
  trainingTime: string;
  status: "pending" | "completed";
  wordBookId: number;
  sessionId: number;
  count: number;
};

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYMDLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export default function AntiForgetting() {
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const navigate = useNavigate();
  const reviewCurvePreset = useAuthStore((s) => s.user?.reviewCurvePreset) || "times5";

  const [bookStats, setBookStats] = useState<ReviewBookStat[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingBooks(true);
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
        const res = await listReviewBooksByDate(selectedDate, tz);
        const arr = Array.isArray(res.data) ? (res.data as ReviewBookStat[]) : [];
        if (mounted) setBookStats(arr);
      } catch {
        if (mounted) setBookStats([]);
      } finally {
        if (mounted) setLoadingBooks(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  const reviewTasks = useMemo<ReviewTask[]>(() => {
    const student = sessionStorage.getItem("lb_user_name") || "当前用户";
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
    return bookStats.map((b) => ({
      id: `${b.wordBookId}-${b.sessionId ?? 0}`,
      practiceTimeLabel: formatPracticeTimeRange(b.practiceStartedAt, b.practiceEndedAt, tz),
      student,
      vocabularyPack: b.name,
      trainingTime: `${Math.min(60, Math.max(10, Math.ceil(b.cnt / 20) * 10))}分钟`,
      status: "pending",
      wordBookId: b.wordBookId,
      sessionId: b.sessionId ?? 0,
      count: b.cnt,
    }));
  }, [bookStats]);

  const groupedByStudent: { [key: string]: typeof reviewTasks } = {};
  reviewTasks.forEach((task) => {
    if (!groupedByStudent[task.student]) {
      groupedByStudent[task.student] = [];
    }
    groupedByStudent[task.student].push(task);
  });

  const shiftDate = (deltaDays: number) => {
    const d = parseYMDLocal(selectedDate);
    d.setDate(d.getDate() + deltaDays);
    setSelectedDate(toDateInputValue(d));
  };

  const isToday = selectedDate === toDateInputValue(new Date());

  const handleOpenTask = (task: ReviewTask) => {
    if (task.count <= 0) return;
    sessionStorage.setItem("lb_review_wordbook_id", String(task.wordBookId));
    sessionStorage.setItem("lb_review_wordbook_name", task.vocabularyPack);
    sessionStorage.setItem("lb_review_date", selectedDate);
    sessionStorage.setItem("lb_review_return", "/anti-forgetting");
    if (task.sessionId > 0) {
      sessionStorage.setItem("lb_review_study_session_id", String(task.sessionId));
    } else {
      sessionStorage.removeItem("lb_review_study_session_id");
    }
    if (isToday) {
      sessionStorage.setItem("lb_mode", "review");
      const sessionQ =
        task.sessionId > 0 ? `&studySessionId=${encodeURIComponent(String(task.sessionId))}` : "";
      navigate(
        `/review-word-list?wordBookId=${task.wordBookId}&date=${encodeURIComponent(selectedDate)}${sessionQ}`
      );
      return;
    }
    sessionStorage.removeItem("lb_mode");
    const sessionQ =
      task.sessionId > 0 ? `&studySessionId=${encodeURIComponent(String(task.sessionId))}` : "";
    navigate(
      `/review-word-list?wordBookId=${task.wordBookId}&date=${encodeURIComponent(selectedDate)}&view=1${sessionQ}`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">
          曲线：{reviewCurveLabel(reviewCurvePreset)}
        </p>
        <CloudButton variant="ghost" size="sm" onClick={() => navigate("/create-anti-forgetting")}>
          调整曲线
        </CloudButton>
      </div>
      <CloudCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-4">
          <CloudButton
            variant="ghost"
            size="icon"
            onClick={() => shiftDate(-1)}
            aria-label="上一天"
          >
            <ChevronLeft size={20} />
          </CloudButton>
          <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">选择日期</p>
            <div className="w-full max-w-[280px]">
              <CloudDatePicker
                value={selectedDate || undefined}
                allowClear={false}
                onChange={(dateString) => {
                  if (dateString) setSelectedDate(dateString);
                }}
              />
            </div>
          </div>
          <CloudButton
            variant="ghost"
            size="icon"
            onClick={() => shiftDate(1)}
            aria-label="下一天"
          >
            <ChevronRight size={20} />
          </CloudButton>
        </div>
      </CloudCard>

      {loadingBooks ? (
        <CloudSpin tip="加载中…" />
      ) : reviewTasks.length === 0 ? (
        <CloudCard className="p-6">
          <CloudEmpty description="该日暂无待复习词库任务（或已全部完成）。可切换日期查看其它天的计划。" />
        </CloudCard>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByStudent).map(([student, tasks]) => (
            <CloudCard key={student} className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-4 sm:px-5 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                  {student.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-foreground truncate">{student}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    本日 {tasks.length} 个复习任务（按所选日期统计）
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 sm:px-5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {task.practiceTimeLabel ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground tabular-nums shrink-0 max-w-[11rem] sm:max-w-none">
                          <Clock size={14} className="text-primary shrink-0" />
                          <span className="truncate">{task.practiceTimeLabel}</span>
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-2 min-w-0 flex-1">
                        <BookOpen size={15} className="text-secondary-brand shrink-0" />
                        <span className="text-sm text-charcoal truncate">{task.vocabularyPack}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                        {task.count} 词 · {task.trainingTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground sm:hidden">{task.trainingTime}</span>
                      <CloudButton
                        variant="brand"
                        size="sm"
                        onClick={() => handleOpenTask(task)}
                        disabled={task.count <= 0}
                        className="gap-1.5"
                      >
                        <Eye size={14} />
                        {task.count <= 0 ? "暂无词" : isToday ? "复习" : "查看"}
                      </CloudButton>
                    </div>
                  </div>
                ))}
              </div>
            </CloudCard>
          ))}
        </div>
      )}
    </div>
  );
}
