import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Calendar, ChevronLeft, ChevronRight, Clock, RefreshCw, Users } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudEmpty, CloudSpin } from "../components/cloudsteps/arco";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useAuthStore } from "../stores/authStore";
import { getTeacherCoachingCompleted, type CoachingWeekSchedule } from "../api/coaching";

const PAGE_SIZE = 10;

function formatDateTime(raw?: string | null) {
  if (!raw) return "-";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const statusLabel: Record<string, string> = {
  completed: "已完成",
  scheduled: "已排课",
  in_progress: "进行中",
  cancelled: "已取消",
};

export default function CoachCompletedSessions() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = (user as { role?: string } | null)?.role || "user";
  const isCoach = role === "teacher" || role === "user";

  const [schedules, setSchedules] = useState<CoachingWeekSchedule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CoachingWeekSchedule | null>(null);

  const load = useCallback(
    async (nextPage = 1) => {
      if (!isCoach) return;
      setLoading(true);
      try {
        const res = await getTeacherCoachingCompleted({ page: nextPage, pageSize: PAGE_SIZE });
        if (res.code !== 200) {
          setSchedules([]);
          setTotal(0);
          return;
        }
        setSchedules(Array.isArray(res.data?.schedules) ? res.data!.schedules : []);
        setTotal(res.data?.total ?? 0);
        setPage(res.data?.page ?? nextPage);
      } catch {
        setSchedules([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [isCoach]
  );

  useEffect(() => {
    if (!isCoach) {
      navigate("/coach-center", { replace: true });
      return;
    }
    void load(1);
  }, [isCoach, load, navigate]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 h-full">
      <div className="flex items-center gap-2 shrink-0">
        <CloudButton
          variant="ghost"
          size="icon"
          onClick={() => navigate("/coach-center")}
          aria-label="返回陪练中心"
          className="shrink-0"
        >
          <ChevronLeft size={20} />
        </CloudButton>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            已上课程
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            近 90 天已完成的陪练记录
            {total > 0 ? ` · 共 ${total} 条` : ""}
          </p>
        </div>
        <CloudButton
          variant="outline"
          size="sm"
          onClick={() => void load(page)}
          disabled={loading}
          className="shrink-0 gap-1.5"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
          刷新
        </CloudButton>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="h-full min-h-[12rem] flex items-center justify-center">
              <CloudSpin tip="加载中…" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="h-full min-h-[12rem] flex items-center justify-center p-6">
              <CloudEmpty description="暂无已上课程" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {schedules.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDetail(s)}
                  className="w-full text-left px-4 py-3.5 sm:px-5 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground text-sm">
                        {s.title || `排课 #${s.id}`}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={13} className="text-primary" />
                          {s.scheduledDate?.slice?.(0, 10) || s.scheduledDate}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} />
                          {s.startTime}–{s.endTime}
                        </span>
                        {s.students && s.students.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users size={13} />
                            {s.students.join("、")}
                          </span>
                        )}
                      </div>
                      {s.session?.billedMinutes != null && (
                        <p className="text-xs text-muted-soft mt-1.5 leading-relaxed">
                          实际 {s.session.actualMinutes ?? "-"} 分钟 · 学员扣减{" "}
                          {s.session.billedMinutes} 分钟
                          {s.session.teacherCreditedMinutes != null && (
                            <> · 计入老师 {s.session.teacherCreditedMinutes} 分钟</>
                          )}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-muted-soft group-hover:text-primary shrink-0 mt-0.5 transition-colors"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between gap-3 bg-surface-soft/80">
          <span className="text-xs text-muted-foreground tabular-nums">
            {total > 0 ? `第 ${page}/${totalPages} 页` : "暂无分页"}
          </span>
          <div className="flex items-center gap-2">
            <CloudButton
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading || total === 0}
              onClick={() => void load(page - 1)}
            >
              上一页
            </CloudButton>
            <CloudButton
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading || total === 0}
              onClick={() => void load(page + 1)}
            >
              下一页
            </CloudButton>
          </div>
        </div>
      </div>

      <Dialog open={detail !== null} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-[480px] rounded-xl border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">课程详情</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-muted px-3.5 py-3">
                <div className="text-[11px] text-muted-foreground">课程标题</div>
                <div className="font-semibold text-foreground mt-0.5">
                  {detail.title || `排课 #${detail.id}`}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-border px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground">日期</div>
                  <div className="text-charcoal mt-0.5">
                    {detail.scheduledDate?.slice?.(0, 10) || detail.scheduledDate || "-"}
                  </div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground">时段</div>
                  <div className="text-charcoal mt-0.5">
                    {detail.startTime}–{detail.endTime}
                  </div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground">状态</div>
                  <div className="text-charcoal mt-0.5">
                    {statusLabel[detail.status] || detail.status || "-"}
                  </div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground">学员</div>
                  <div className="text-charcoal mt-0.5 truncate">
                    {detail.students?.length ? detail.students.join("、") : "-"}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border px-3.5 py-3 space-y-1.5">
                <div className="text-[11px] text-muted-foreground mb-1">课时结算</div>
                <div className="flex justify-between text-charcoal">
                  <span>计划时长</span>
                  <span className="tabular-nums">{detail.session?.plannedMinutes ?? "-"} 分钟</span>
                </div>
                <div className="flex justify-between text-charcoal">
                  <span>实际时长</span>
                  <span className="tabular-nums">{detail.session?.actualMinutes ?? "-"} 分钟</span>
                </div>
                <div className="flex justify-between text-charcoal">
                  <span>学员扣减</span>
                  <span className="tabular-nums">{detail.session?.billedMinutes ?? "-"} 分钟</span>
                </div>
                <div className="flex justify-between text-charcoal">
                  <span>计入老师</span>
                  <span className="tabular-nums">
                    {detail.session?.teacherCreditedMinutes ?? "-"} 分钟
                  </span>
                </div>
                <div className="pt-1.5 border-t border-border flex justify-between text-xs text-muted-foreground">
                  <span>开始 {formatDateTime(detail.session?.startedAt)}</span>
                  <span>结束 {formatDateTime(detail.session?.endedAt)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <CloudButton type="button" variant="outline" onClick={() => setDetail(null)}>
              关闭
            </CloudButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
