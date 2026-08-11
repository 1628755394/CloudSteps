import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Phone,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard, CloudEmpty, CloudInput, CloudSpin } from "../components/cloudsteps/arco";
import { PageTitle } from "../components/PageTitle";
import { getTeacherCoachingQuotas, type TeacherCoachingQuotaRow } from "../api/coaching";
import { showToast } from "../utils/toast";

function studentLabel(row: TeacherCoachingQuotaRow) {
  const s = row.student;
  return s?.displayName || s?.username || s?.email || `学员 #${row.studentId}`;
}

function studentInitial(row: TeacherCoachingQuotaRow) {
  return (studentLabel(row) || "?").trim().slice(0, 1).toUpperCase() || "?";
}

function fmtShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function minsLabel(n: number) {
  if (n >= 60) {
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m ? `${h}小时${m}分` : `${h}小时`;
  }
  return `${n}分钟`;
}

export default function MyStudents() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TeacherCoachingQuotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTeacherCoachingQuotas();
      if (res.code !== 200) {
        showToast.error(res.msg || "加载失败");
        setRows([]);
        return;
      }
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载失败";
      showToast.error(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        studentLabel(r),
        r.student?.username,
        r.student?.email,
        r.student?.phone,
        String(r.studentId),
        r.student?.city,
        r.student?.region,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, keyword]);

  const summary = useMemo(() => {
    const totalMins = rows.reduce((s, r) => s + (r.remainingMinutes || 0), 0);
    const lowQuota = rows.filter((r) => (r.remainingMinutes || 0) < 30).length;
    return { count: rows.length, totalMins, lowQuota };
  }, [rows]);

  const openActivity = (r: TeacherCoachingQuotaRow) => {
    navigate(`/my-students/${r.studentId}/training`, {
      state: { studentName: studentLabel(r) },
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex items-start gap-2 shrink-0">
        <CloudButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="返回"
          className="shrink-0 mt-0.5"
        >
          <ChevronLeft size={20} />
        </CloudButton>
        <div className="min-w-0 flex-1">
          <PageTitle description="查看额度、测评与训练活动">学员管理</PageTitle>
        </div>
        <CloudButton
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void load()}
          aria-label="刷新"
          className="shrink-0 mt-0.5"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </CloudButton>
      </div>

      <div className="grid grid-cols-3 gap-2 shrink-0">
        <CloudCard tint="mint" className="px-3 py-2.5 border-transparent text-center">
          <div className="text-[10px] text-muted-foreground">学员</div>
          <div className="text-base font-semibold text-foreground tabular-nums mt-0.5">
            {summary.count}
          </div>
        </CloudCard>
        <CloudCard tint="sky" className="px-3 py-2.5 border-transparent text-center">
          <div className="text-[10px] text-muted-foreground">剩余额度</div>
          <div className="text-base font-semibold text-foreground tabular-nums mt-0.5">
            {summary.totalMins}
            <span className="text-[10px] font-medium text-muted-soft ml-0.5">分</span>
          </div>
        </CloudCard>
        <CloudCard tint="cream" className="px-3 py-2.5 border-transparent text-center">
          <div className="text-[10px] text-muted-foreground">额度将尽</div>
          <div className="text-base font-semibold text-foreground tabular-nums mt-0.5">
            {summary.lowQuota}
          </div>
        </CloudCard>
      </div>

      <div className="shrink-0">
        <CloudInput
          value={keyword}
          onChange={setKeyword}
          placeholder="搜索姓名 / 手机 / ID…"
          prefix={<Search size={16} className="text-muted-foreground" />}
          allowClear
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-2">
        {loading ? (
          <CloudCard className="p-10">
            <CloudSpin tip="加载中…" />
          </CloudCard>
        ) : filtered.length === 0 ? (
          <CloudCard className="p-8">
            <CloudEmpty
              description={
                keyword.trim()
                  ? "没有匹配的学员"
                  : "暂无学员。可在首页「陪练排课」里添加学员。"
              }
            />
          </CloudCard>
        ) : (
          filtered.map((r) => {
            const low = (r.remainingMinutes || 0) < 30;
            const region = [r.student?.region, r.student?.city].filter(Boolean).join(" · ");
            return (
              <CloudCard
                key={r.id}
                interactive
                className="p-4"
                onClick={() => openActivity(r)}
              >
                <div className="flex items-start gap-3">
                  <div className="size-12 rounded-full bg-primary-soft border border-border overflow-hidden flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {studentInitial(r)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-foreground truncate">
                          {studentLabel(r)}
                        </h2>
                        <p className="text-[11px] text-muted-soft mt-0.5 truncate">
                          #{r.studentId}
                          {r.student?.username ? ` · ${r.student.username}` : ""}
                          {region ? ` · ${region}` : ""}
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-muted-soft shrink-0 mt-0.5"
                        aria-hidden
                      />
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium tabular-nums ${
                          low
                            ? "bg-destructive/5 text-destructive"
                            : "bg-primary-soft text-primary"
                        }`}
                      >
                        <Clock size={12} />
                        剩余 {minsLabel(r.remainingMinutes || 0)}
                      </span>
                      {typeof r.totalAllocatedMinutes === "number" && (
                        <span className="inline-flex items-center rounded-lg bg-muted px-2 py-1 text-[11px] text-muted-foreground tabular-nums">
                          累计 {r.totalAllocatedMinutes} 分
                        </span>
                      )}
                      {r.student?.phone && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                          <Phone size={11} />
                          {r.student.phone}
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-surface-soft px-1.5 py-1.5">
                        <div className="text-sm font-semibold text-foreground tabular-nums">
                          {r.vocabTestCount ?? 0}
                        </div>
                        <div className="text-[10px] text-muted-soft">测评</div>
                      </div>
                      <div className="rounded-lg bg-surface-soft px-1.5 py-1.5">
                        <div className="text-sm font-semibold text-foreground tabular-nums">
                          {r.coachingSessionCount ?? 0}
                        </div>
                        <div className="text-[10px] text-muted-soft">陪练</div>
                      </div>
                      <div className="rounded-lg bg-surface-soft px-1.5 py-1.5">
                        <div className="text-sm font-semibold text-foreground tabular-nums">
                          {r.studySessionCount ?? 0}
                        </div>
                        <div className="text-[10px] text-muted-soft">训练</div>
                      </div>
                    </div>

                    {(r.latestVocabTestAt || r.latestVocabLevel || r.latestEstimatedVocab) && (
                      <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                        最近测评 {fmtShort(r.latestVocabTestAt)}
                        {r.latestVocabLevel ? ` · ${r.latestVocabLevel}` : ""}
                        {r.latestEstimatedVocab != null ? ` · 估词 ${r.latestEstimatedVocab}` : ""}
                      </p>
                    )}

                    <div className="mt-3">
                      <CloudButton
                        type="button"
                        variant="brandOutline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          openActivity(r);
                        }}
                      >
                        <ClipboardList size={14} />
                        活动记录
                      </CloudButton>
                    </div>
                  </div>
                </div>
              </CloudCard>
            );
          })
        )}
      </div>

      {!loading && rows.length > 0 && (
        <p className="text-center text-[11px] text-muted-soft shrink-0 pb-1">
          <Users size={12} className="inline mr-1 -mt-0.5" />
          共 {filtered.length}
          {keyword.trim() ? ` / ${rows.length}` : ""} 名学员
        </p>
      )}
    </div>
  );
}
