import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ChevronLeft,
  ClipboardList,
  Clock,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard, CloudEmpty, CloudInput, CloudSpin } from "../components/cloudsteps/arco";
import { AddStudentPanel } from "../components/AddStudentPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  getTeacherCoachingQuotas,
  setTeacherStudentPassword,
  type TeacherCoachingQuotaRow,
} from "../api/coaching";
import { showToast } from "../utils/toast";
import { resolveMediaUrl } from "../utils/mediaUrl";

const DEFAULT_PASSWORD = "student123";
const PAGE_LIMIT = 20;

function studentLabel(row: TeacherCoachingQuotaRow) {
  const s = row.student;
  return s?.displayName || s?.username || s?.email || `学员 #${row.studentId}`;
}

function studentInitial(row: TeacherCoachingQuotaRow) {
  return (studentLabel(row) || "?").trim().slice(0, 1).toUpperCase() || "?";
}

function studentAvatarUrl(row: TeacherCoachingQuotaRow) {
  return resolveMediaUrl(row.student?.avatar);
}

function loginAccount(row: TeacherCoachingQuotaRow) {
  return row.student?.username || row.student?.email || "";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<TeacherCoachingQuotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [showAdd, setShowAdd] = useState(() => searchParams.get("link") === "1");
  const [pwdTarget, setPwdTarget] = useState<TeacherCoachingQuotaRow | null>(null);
  const [pwdValue, setPwdValue] = useState(DEFAULT_PASSWORD);
  const [pwdSaving, setPwdSaving] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("link") === "1") {
      setShowAdd(true);
      const next = new URLSearchParams(searchParams);
      next.delete("link");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(keyword.trim()), 300);
    return () => window.clearTimeout(t);
  }, [keyword]);

  const fetchPage = useCallback(
    async (opts: { cursor?: string; append: boolean; q: string }) => {
      if (opts.append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await getTeacherCoachingQuotas({
          cursor: opts.cursor,
          limit: PAGE_LIMIT,
          q: opts.q || undefined,
        });
        if (res.code !== 200) {
          showToast.error(res.msg || "加载失败");
          if (!opts.append) setRows([]);
          return;
        }
        const list = Array.isArray(res.data?.list) ? res.data.list : [];
        setRows((prev) => (opts.append ? [...prev, ...list] : list));
        setNextCursor(res.data?.nextCursor || undefined);
        setHasMore(Boolean(res.data?.hasMore));
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "msg" in e
            ? String((e as { msg: string }).msg)
            : "加载失败";
        showToast.error(msg);
        if (!opts.append) setRows([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    void fetchPage({ append: false, q: debouncedQ });
  }, [debouncedQ, fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!hasMore || loading || loadingMoreRef.current || !nextCursor) return;
        void fetchPage({ cursor: nextCursor, append: true, q: debouncedQ });
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, nextCursor, loading, debouncedQ, fetchPage]);

  const openDetail = (r: TeacherCoachingQuotaRow) => {
    navigate(`/my-students/${r.studentId}`, {
      state: { studentName: studentLabel(r) },
    });
  };

  const openActivity = (r: TeacherCoachingQuotaRow) => {
    navigate(`/my-students/${r.studentId}/training`, {
      state: { studentName: studentLabel(r) },
    });
  };

  const openPwdModal = (r: TeacherCoachingQuotaRow) => {
    setPwdTarget(r);
    setPwdValue(DEFAULT_PASSWORD);
  };

  const closePwdModal = (open: boolean) => {
    if (pwdSaving) return;
    if (!open) {
      setPwdTarget(null);
      setPwdValue(DEFAULT_PASSWORD);
    }
  };

  const savePassword = async (resetDefault: boolean) => {
    if (!pwdTarget) return;
    const pwd = resetDefault ? DEFAULT_PASSWORD : pwdValue.trim();
    if (!pwd || pwd.length < 8) {
      showToast.warning("密码至少 8 位");
      return;
    }
    setPwdSaving(true);
    try {
      const res = await setTeacherStudentPassword(pwdTarget.studentId, pwd);
      if (res.code !== 200) {
        showToast.error(res.msg || "设置失败");
        return;
      }
      const account = res.data?.username || loginAccount(pwdTarget) || studentLabel(pwdTarget);
      showToast.success(
        resetDefault
          ? `已重置：${account} / ${DEFAULT_PASSWORD}`
          : `已更新：${account} 的密码`
      );
      setPwdTarget(null);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "设置失败";
      showToast.error(msg);
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <CloudButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          aria-label="返回首页"
          className="shrink-0"
        >
          <ChevronLeft size={20} />
        </CloudButton>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground">学员管理</span>
        </div>
        <CloudButton
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate("/my-students/new")}
          className="shrink-0 gap-1"
        >
          <UserPlus size={14} />
          新建
        </CloudButton>
        <CloudButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAdd((v) => !v)}
          className="shrink-0"
        >
          关联
        </CloudButton>
        <CloudButton
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void fetchPage({ append: false, q: debouncedQ })}
          aria-label="刷新"
          className="shrink-0"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </CloudButton>
      </div>

      <AddStudentPanel
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => void fetchPage({ append: false, q: debouncedQ })}
      />

      <Dialog open={!!pwdTarget} onOpenChange={closePwdModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>设置登录密码</DialogTitle>
            <DialogDescription>
              {pwdTarget
                ? `${studentLabel(pwdTarget)}${
                    loginAccount(pwdTarget) ? ` · ${loginAccount(pwdTarget)}` : ""
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <CloudInput
            value={pwdValue}
            onChange={setPwdValue}
            placeholder={DEFAULT_PASSWORD}
            autoComplete="new-password"
          />
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <CloudButton
              type="button"
              variant="outline"
              className="flex-1"
              disabled={pwdSaving}
              onClick={() => void savePassword(true)}
            >
              重置为 {DEFAULT_PASSWORD}
            </CloudButton>
            <CloudButton
              type="button"
              variant="brand"
              className="flex-1"
              loading={pwdSaving}
              onClick={() => void savePassword(false)}
            >
              保存密码
            </CloudButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="shrink-0">
        <CloudInput
          value={keyword}
          onChange={setKeyword}
          placeholder="搜索姓名 / 账号 / 手机…"
          prefix={<Search size={16} className="text-muted-foreground" />}
          allowClear
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-2">
        {loading ? (
          <CloudCard className="p-10">
            <CloudSpin tip="加载中…" />
          </CloudCard>
        ) : rows.length === 0 ? (
          <CloudCard className="p-8">
            <CloudEmpty
              description={
                debouncedQ
                  ? "没有匹配的学员"
                  : "暂无学员。点击右上角「新建」创建账号，或「关联」已有学员。"
              }
            />
          </CloudCard>
        ) : (
          rows.map((r) => {
            const low = (r.remainingMinutes || 0) < 30;
            const account = loginAccount(r);
            const avatar = studentAvatarUrl(r);
            return (
              <CloudCard key={r.id} className="p-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    onClick={() => openDetail(r)}
                  >
                    <div className="size-11 rounded-full bg-primary-soft border border-border overflow-hidden flex items-center justify-center shrink-0">
                      {avatar ? (
                        <img src={avatar} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-primary">
                          {studentInitial(r)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-sm font-semibold text-foreground truncate">
                          {studentLabel(r)}
                        </h2>
                        <span
                          className={`shrink-0 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                            low
                              ? "bg-destructive/5 text-destructive"
                              : "bg-primary-soft text-primary"
                          }`}
                        >
                          <Clock size={10} />
                          {minsLabel(r.remainingMinutes || 0)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {account || "—"}
                        <span className="text-muted-soft">
                          {" "}
                          · 测评 {r.vocabTestCount ?? 0} · 陪练 {r.coachingSessionCount ?? 0} · 训练{" "}
                          {r.studySessionCount ?? 0}
                        </span>
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <CloudButton
                      type="button"
                      variant="outline"
                      size="sm"
                      className="px-2.5"
                      onClick={() => openPwdModal(r)}
                    >
                      <KeyRound size={14} />
                      <span className="hidden sm:inline">密码</span>
                    </CloudButton>
                    <CloudButton
                      type="button"
                      variant="brandOutline"
                      size="sm"
                      className="px-2.5"
                      onClick={() => openActivity(r)}
                    >
                      <ClipboardList size={14} />
                      <span className="hidden sm:inline">活动</span>
                    </CloudButton>
                  </div>
                </div>
              </CloudCard>
            );
          })
        )}

        <div ref={sentinelRef} className="h-4" />
        {loadingMore && (
          <div className="flex justify-center py-2 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}
        {!loading && !hasMore && rows.length > 0 && (
          <p className="text-center text-[11px] text-muted-soft py-1">没有更多了</p>
        )}
      </div>
    </div>
  );
}
