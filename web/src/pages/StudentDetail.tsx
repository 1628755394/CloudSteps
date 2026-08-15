import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import {
  BookOpen,
  ChevronLeft,
  Clock,
  KeyRound,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard, CloudEmpty, CloudInput, CloudSpin } from "../components/cloudsteps/arco";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  addStudentWordBookAsTeacher,
  getStudentVocabRecordAsTeacher,
  listAllTeacherCoachingQuotas,
  listStudentActivityRecordsAsTeacher,
  listStudentWordBooksAsTeacher,
  removeStudentWordBookAsTeacher,
  setTeacherStudentPassword,
  type StudentActivityListItem,
  type StudentWordBookItem,
  type TeacherCoachingQuotaRow,
  type VocabTestRecordDTO,
} from "../api/coaching";
import {
  loadWordBooksStaleWhileRevalidate,
  type CachedWordBook,
} from "../utils/wordBooksCache";
import { VocabTestResultView } from "../components/VocabTestResultView";
import { showToast } from "../utils/toast";
import { resolveMediaUrl } from "../utils/mediaUrl";

const DEFAULT_PASSWORD = "student123";

type TabKey = "hours" | "wordbooks" | "vocab";

function studentLabel(row: TeacherCoachingQuotaRow) {
  const s = row.student;
  return s?.displayName || s?.username || s?.email || `学员 #${row.studentId}`;
}

function minsLabel(n: number) {
  if (n >= 60) {
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m ? `${h}小时${m}分` : `${h}小时`;
  }
  return `${n}分钟`;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function StudentDetail() {
  const navigate = useNavigate();
  const { studentId: studentIdParam } = useParams<{ studentId: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const studentId = Number(studentIdParam);

  const tabFromQuery = searchParams.get("tab");
  const initialTab: TabKey =
    tabFromQuery === "wordbooks" || tabFromQuery === "vocab" || tabFromQuery === "hours"
      ? tabFromQuery
      : "hours";
  const [tab, setTab] = useState<TabKey>(initialTab);

  const [quota, setQuota] = useState<TeacherCoachingQuotaRow | null>(null);
  const [title, setTitle] = useState("");
  const [loadingQuota, setLoadingQuota] = useState(true);

  const [wordBooks, setWordBooks] = useState<StudentWordBookItem[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [catalog, setCatalog] = useState<CachedWordBook[]>([]);
  const [catalogQ, setCatalogQ] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [vocabItems, setVocabItems] = useState<StudentActivityListItem[]>([]);
  const [loadingVocab, setLoadingVocab] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVocab, setDetailVocab] = useState<VocabTestRecordDTO | null>(null);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdValue, setPwdValue] = useState(DEFAULT_PASSWORD);
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    const fromNav = (location.state as { studentName?: string } | null)?.studentName;
    if (fromNav) setTitle(fromNav);
  }, [location.state]);

  useEffect(() => {
    if (!Number.isFinite(studentId) || studentId <= 0) {
      setLoadingQuota(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingQuota(true);
      try {
        const rows = await listAllTeacherCoachingQuotas();
        if (cancelled) return;
        const row = rows.find((r) => r.studentId === studentId) || null;
        setQuota(row);
        if (row) setTitle(studentLabel(row));
        else if (!title) setTitle(`学员 #${studentId}`);
      } catch {
        if (!cancelled && !title) setTitle(`学员 #${studentId}`);
      } finally {
        if (!cancelled) setLoadingQuota(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- title only for initial fallback
  }, [studentId]);

  const onTabChange = (v: string) => {
    const next = (v as TabKey) || "hours";
    setTab(next);
    const sp = new URLSearchParams(searchParams);
    if (next === "hours") sp.delete("tab");
    else sp.set("tab", next);
    setSearchParams(sp, { replace: true });
  };

  const loadWordBooks = useCallback(async () => {
    if (!Number.isFinite(studentId) || studentId <= 0) return;
    setLoadingBooks(true);
    try {
      const res = await listStudentWordBooksAsTeacher(studentId);
      if (res.code !== 200) {
        showToast.error(res.msg || "加载词库失败");
        setWordBooks([]);
        return;
      }
      setWordBooks(Array.isArray(res.data?.list) ? res.data.list : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : "加载词库失败";
      showToast.error(msg);
      setWordBooks([]);
    } finally {
      setLoadingBooks(false);
    }
  }, [studentId]);

  const loadVocabTests = useCallback(async () => {
    if (!Number.isFinite(studentId) || studentId <= 0) return;
    setLoadingVocab(true);
    try {
      const res = await listStudentActivityRecordsAsTeacher(studentId, {
        limit: 50,
        q: "vocab_test",
      });
      if (res.code !== 200) {
        showToast.error(res.msg || "加载测评失败");
        setVocabItems([]);
        return;
      }
      const list = Array.isArray(res.data?.list) ? res.data.list : [];
      setVocabItems(list.filter((x) => x.kind === "vocab_test"));
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : "加载测评失败";
      showToast.error(msg);
      setVocabItems([]);
    } finally {
      setLoadingVocab(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (tab === "wordbooks") void loadWordBooks();
  }, [tab, loadWordBooks]);

  useEffect(() => {
    if (tab === "vocab") void loadVocabTests();
  }, [tab, loadVocabTests]);

  const openAddBook = async () => {
    setAddOpen(true);
    setCatalogQ("");
    try {
      const all = await loadWordBooksStaleWhileRevalidate();
      setCatalog(all);
    } catch {
      setCatalog([]);
    }
  };

  const assignedIds = useMemo(() => new Set(wordBooks.map((b) => b.id)), [wordBooks]);

  const filteredCatalog = useMemo(() => {
    const q = catalogQ.trim().toLowerCase();
    return catalog.filter((b) => {
      if (assignedIds.has(b.id)) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        String(b.id).includes(q) ||
        (b.level || "").toLowerCase().includes(q) ||
        (b.category || "").toLowerCase().includes(q)
      );
    });
  }, [catalog, catalogQ, assignedIds]);

  const handleAddBook = async (wbId: number) => {
    setAddingId(wbId);
    try {
      const res = await addStudentWordBookAsTeacher(studentId, wbId);
      if (res.code !== 200) {
        showToast.error(res.msg || "添加失败");
        return;
      }
      showToast.success("已添加词库");
      await loadWordBooks();
      setAddOpen(false);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "添加失败";
      showToast.error(msg);
    } finally {
      setAddingId(null);
    }
  };

  const handleRemoveBook = async (wbId: number) => {
    setRemovingId(wbId);
    try {
      const res = await removeStudentWordBookAsTeacher(studentId, wbId);
      if (res.code !== 200) {
        showToast.error(res.msg || "移除失败");
        return;
      }
      showToast.success("已移除");
      setWordBooks((prev) => prev.filter((b) => b.id !== wbId));
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "移除失败";
      showToast.error(msg);
    } finally {
      setRemovingId(null);
    }
  };

  const openVocabDetail = async (item: StudentActivityListItem) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailVocab(null);
    try {
      const res = await getStudentVocabRecordAsTeacher(studentId, item.id);
      if (res.code !== 200) throw new Error(res.msg || "加载失败");
      setDetailVocab(res.data as VocabTestRecordDTO);
    } catch (e) {
      console.error(e);
      showToast.error("加载测评详情失败");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const savePassword = async (resetDefault: boolean) => {
    const pwd = resetDefault ? DEFAULT_PASSWORD : pwdValue.trim();
    if (!pwd || pwd.length < 8) {
      showToast.warning("密码至少 8 位");
      return;
    }
    setPwdSaving(true);
    try {
      const res = await setTeacherStudentPassword(studentId, pwd);
      if (res.code !== 200) {
        showToast.error(res.msg || "设置失败");
        return;
      }
      const account = res.data?.username || quota?.student?.username || title;
      showToast.success(
        resetDefault
          ? `已重置：${account} / ${DEFAULT_PASSWORD}`
          : `已更新：${account} 的密码`
      );
      setPwdOpen(false);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "设置失败";
      showToast.error(msg);
    } finally {
      setPwdSaving(false);
    }
  };

  const displayName = title || `学员 #${studentId}`;
  const avatar = resolveMediaUrl(quota?.student?.avatar);
  const remaining = quota?.remainingMinutes ?? 0;
  const total = quota?.totalAllocatedMinutes ?? 0;
  const low = remaining < 30;

  if (!Number.isFinite(studentId) || studentId <= 0) {
    return (
      <div className="p-4">
        <CloudCard className="p-8">
          <CloudEmpty description="无效的学员" />
        </CloudCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <CloudButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate("/my-students")}
          aria-label="返回学员管理"
          className="shrink-0"
        >
          <ChevronLeft size={20} />
        </CloudButton>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <div className="size-9 rounded-full bg-primary-soft border border-border overflow-hidden flex items-center justify-center shrink-0">
            {avatar ? (
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-primary">
                {(displayName || "?").trim().slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground truncate block">
              {displayName}
            </span>
            <span className="text-[11px] text-muted-foreground truncate block">
              {quota?.student?.username || quota?.student?.email || `ID ${studentId}`}
            </span>
          </div>
        </div>
        <CloudButton
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1"
          onClick={() =>
            navigate(`/my-students/${studentId}/training`, {
              state: { studentName: displayName },
            })
          }
        >
          活动
        </CloudButton>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="flex flex-col flex-1 min-h-0 gap-3">
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="hours" className="flex-1">
            课时
          </TabsTrigger>
          <TabsTrigger value="wordbooks" className="flex-1">
            词库
          </TabsTrigger>
          <TabsTrigger value="vocab" className="flex-1">
            词汇测试
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-2">
          {loadingQuota ? (
            <CloudCard className="p-10">
              <CloudSpin tip="加载中…" />
            </CloudCard>
          ) : !quota ? (
            <CloudCard className="p-8">
              <CloudEmpty description="未找到该学员的陪练额度" />
            </CloudCard>
          ) : (
            <>
              <CloudCard className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">剩余课时</div>
                    <div
                      className={`text-2xl font-bold tabular-nums mt-1 ${
                        low ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {minsLabel(remaining)}
                    </div>
                    <div className="text-[11px] text-muted-soft mt-1">
                      累计分配 {minsLabel(total)} · 约 {(remaining / 60).toFixed(1)} 学时剩余
                    </div>
                  </div>
                  <div
                    className={`size-12 rounded-2xl flex items-center justify-center ${
                      low ? "bg-destructive/10" : "bg-primary-soft"
                    }`}
                  >
                    <Clock size={22} className={low ? "text-destructive" : "text-primary"} />
                  </div>
                </div>
                {total > 0 && (
                  <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${low ? "bg-destructive" : "bg-primary"}`}
                      style={{
                        width: `${Math.min(100, Math.round((remaining / total) * 100))}%`,
                      }}
                    />
                  </div>
                )}
              </CloudCard>

              <CloudCard className="p-4 space-y-3">
                <div className="text-sm font-semibold text-foreground">快捷操作</div>
                <div className="flex flex-wrap gap-2">
                  <CloudButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      setPwdValue(DEFAULT_PASSWORD);
                      setPwdOpen(true);
                    }}
                  >
                    <KeyRound size={14} />
                    重置密码
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant="brandOutline"
                    size="sm"
                    onClick={() =>
                      navigate(`/my-students/${studentId}/training`, {
                        state: { studentName: displayName },
                      })
                    }
                  >
                    查看全部活动
                  </CloudButton>
                </div>
                <div className="text-[11px] text-muted-foreground grid grid-cols-3 gap-2 pt-1">
                  <div>
                    测评 <span className="font-medium text-foreground">{quota.vocabTestCount ?? 0}</span>
                  </div>
                  <div>
                    陪练{" "}
                    <span className="font-medium text-foreground">
                      {quota.coachingSessionCount ?? 0}
                    </span>
                  </div>
                  <div>
                    训练{" "}
                    <span className="font-medium text-foreground">{quota.studySessionCount ?? 0}</span>
                  </div>
                </div>
                {quota.latestVocabLevel && (
                  <p className="text-[11px] text-muted-soft">
                    最近测评：{quota.latestVocabLevel}
                    {quota.latestEstimatedVocab
                      ? ` · 约 ${quota.latestEstimatedVocab} 词`
                      : ""}
                    {quota.latestVocabTestAt
                      ? ` · ${formatDateTime(quota.latestVocabTestAt)}`
                      : ""}
                  </p>
                )}
              </CloudCard>
            </>
          )}
        </TabsContent>

        <TabsContent value="wordbooks" className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              已分配 {loadingBooks ? "…" : wordBooks.length} 本
            </span>
            <CloudButton
              type="button"
              variant="brand"
              size="sm"
              className="gap-1"
              onClick={() => void openAddBook()}
            >
              <Plus size={14} />
              添加词库
            </CloudButton>
          </div>

          {loadingBooks ? (
            <CloudCard className="p-10">
              <CloudSpin tip="加载词库…" />
            </CloudCard>
          ) : wordBooks.length === 0 ? (
            <CloudCard className="p-8">
              <CloudEmpty description="尚未为该学员分配词库，点击「添加词库」从全局目录选择。" />
            </CloudCard>
          ) : (
            wordBooks.map((b) => (
              <CloudCard key={b.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
                    <BookOpen size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">{b.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {b.wordCount > 0 ? `${b.wordCount} 词` : "词数未知"} · ID {b.id}
                    </div>
                  </div>
                  <CloudButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive"
                    disabled={removingId === b.id}
                    onClick={() => void handleRemoveBook(b.id)}
                    aria-label="移除词库"
                  >
                    {removingId === b.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </CloudButton>
                </div>
              </CloudCard>
            ))
          )}
        </TabsContent>

        <TabsContent value="vocab" className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-2">
          {loadingVocab ? (
            <CloudCard className="p-10">
              <CloudSpin tip="加载测评记录…" />
            </CloudCard>
          ) : vocabItems.length === 0 ? (
            <CloudCard className="p-8">
              <CloudEmpty description="暂无词汇测评记录" />
            </CloudCard>
          ) : (
            vocabItems.map((item) => (
              <button
                type="button"
                key={`${item.kind}-${item.id}`}
                className="w-full text-left"
                onClick={() => void openVocabDetail(item)}
              >
                <CloudCard className="p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{item.title}</div>
                      <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                        {item.summary}
                      </p>
                      <p className="text-[11px] text-muted-soft mt-1.5">
                        {formatDateTime(item.time)}
                      </p>
                    </div>
                    {item.vocabTest?.estimatedLevel && (
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-md bg-primary-soft text-primary">
                        {item.vocabTest.estimatedLevel}
                      </span>
                    )}
                  </div>
                </CloudCard>
              </button>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>添加词库</DialogTitle>
            <DialogDescription>从全局词库目录为学员分配</DialogDescription>
          </DialogHeader>
          <CloudInput
            value={catalogQ}
            onChange={setCatalogQ}
            placeholder="搜索词库名称…"
            prefix={<Search size={16} className="text-muted-foreground" />}
            allowClear
          />
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 max-h-[50vh] -mx-1 px-1">
            {filteredCatalog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {catalog.length === 0 ? "词库加载中或暂无可用词库" : "没有可添加的词库"}
              </p>
            ) : (
              filteredCatalog.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{b.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {b.wordCount ? `${b.wordCount} 词` : "—"}
                      {b.level ? ` · ${b.level}` : ""}
                    </div>
                  </div>
                  <CloudButton
                    type="button"
                    variant="brand"
                    size="sm"
                    loading={addingId === b.id}
                    disabled={addingId !== null}
                    onClick={() => void handleAddBook(b.id)}
                  >
                    添加
                  </CloudButton>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pwdOpen}
        onOpenChange={(open) => {
          if (pwdSaving) return;
          setPwdOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>设置登录密码</DialogTitle>
            <DialogDescription>
              {displayName}
              {quota?.student?.username ? ` · ${quota.student.username}` : ""}
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

      {detailOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
              <div className="text-[#2D3748] font-semibold">词汇测评结果</div>
              <CloudButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setDetailOpen(false);
                  setDetailVocab(null);
                }}
              >
                关闭
              </CloudButton>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-[#F7F9FC]">
              {detailLoading ? (
                <div className="text-[#718096] py-8 text-center">加载中…</div>
              ) : detailVocab ? (
                <VocabTestResultView
                  compact
                  result={{
                    level: detailVocab.estimatedLevel,
                    estimatedVocab: detailVocab.estimatedVocab,
                    correctCount: detailVocab.correctCount,
                    totalCount: detailVocab.questionCount,
                  }}
                />
              ) : (
                <div className="text-[#718096] py-8 text-center">暂无数据</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
