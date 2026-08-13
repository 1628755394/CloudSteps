import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  ChevronLeft,
  CheckCircle2,
  Search,
  TrendingUp,
  BookOpen,
  GraduationCap,
  Dumbbell,
  Loader2,
} from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudMonthPicker } from "../components/cloudsteps/arco";
import {
  getStudentCoachingSessionAsTeacher,
  getStudentStudySessionAsTeacher,
  getStudentVocabRecordAsTeacher,
  listAllTeacherCoachingQuotas,
  listStudentActivityRecordsAsTeacher,
  type CoachingSessionRecordDTO,
  type StudentActivityListItem,
  type StudentActivityKind,
  type StudentActivityStats,
  type StudySessionDTO,
  type VocabTestRecordDTO,
} from "../api/coaching";

type AnswerDetail = {
  questionId: number;
  answer: string;
  correct: boolean;
  level: string;
};

const PAGE_LIMIT = 20;

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const safeParseAnswers = (s?: string) => {
  if (!s) return [] as AnswerDetail[];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as AnswerDetail[]) : [];
  } catch {
    return [] as AnswerDetail[];
  }
};

function studentLabelFromRow(r: {
  studentId: number;
  student?: { displayName?: string; username?: string; email?: string };
}) {
  const s = r.student;
  return s?.displayName || s?.username || s?.email || `学员 #${r.studentId}`;
}

function kindBadge(kind: StudentActivityKind) {
  switch (kind) {
    case "coaching_session":
      return { label: "陪练完课", className: "bg-[#4ECDC4]/15 text-[#2C7A7B]", Icon: GraduationCap };
    case "vocab_test":
      return { label: "词汇测评", className: "bg-[#55A3FF]/15 text-[#2B6CB0]", Icon: BookOpen };
    case "study_session":
      return { label: "单词训练", className: "bg-[#9F7AEA]/15 text-[#6B46C1]", Icon: Dumbbell };
    default:
      return { label: kind, className: "bg-[#F7F9FC] text-[#718096]", Icon: CheckCircle2 };
  }
}

const emptyStats: StudentActivityStats = {
  total: 0,
  coaching: 0,
  vocab: 0,
  study: 0,
  vocabAvgCorrectRate: 0,
  vocabTotalQuestions: 0,
};

export default function StudentTrainingRecords() {
  const navigate = useNavigate();
  const { studentId: studentIdParam } = useParams<{ studentId: string }>();
  const location = useLocation();
  const studentId = Number(studentIdParam);

  const [studentTitle, setStudentTitle] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  /** 默认全部月份，避免当月无测评时统计显示「-」 */
  const [selectedMonth, setSelectedMonth] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [items, setItems] = useState<StudentActivityListItem[]>([]);
  const [stats, setStats] = useState<StudentActivityStats>(emptyStats);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailKind, setDetailKind] = useState<StudentActivityKind | null>(null);
  const [detailVocab, setDetailVocab] = useState<VocabTestRecordDTO | null>(null);
  const [detailCoaching, setDetailCoaching] = useState<CoachingSessionRecordDTO | null>(null);
  const [detailStudy, setDetailStudy] = useState<StudySessionDTO | null>(null);
  const [detailWordBookName, setDetailWordBookName] = useState("");

  useEffect(() => {
    if (!Number.isFinite(studentId) || studentId <= 0) return;
    const fromNav = (location.state as { studentName?: string } | null)?.studentName;
    if (fromNav) {
      setStudentTitle(fromNav);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listAllTeacherCoachingQuotas();
        if (cancelled) return;
        const row = rows.find((r) => r.studentId === studentId);
        if (row) setStudentTitle(studentLabelFromRow(row));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, location.key, location.state]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchKeyword.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchKeyword]);

  const fetchPage = useCallback(
    async (opts: { cursor?: string; append: boolean }) => {
      if (!Number.isFinite(studentId) || studentId <= 0) {
        setErrorMsg("无效的学员");
        setLoading(false);
        return;
      }
      if (opts.append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
        setErrorMsg(null);
      }
      try {
        const res = await listStudentActivityRecordsAsTeacher(studentId, {
          cursor: opts.cursor,
          limit: PAGE_LIMIT,
          month: selectedMonth || undefined,
          q: debouncedQ || undefined,
        });
        if (res.code !== 200) throw new Error(res.msg || "获取记录失败");
        const list = Array.isArray(res.data?.list) ? res.data.list : [];
        setItems((prev) => (opts.append ? [...prev, ...list] : list));
        setNextCursor(res.data?.nextCursor || undefined);
        setHasMore(Boolean(res.data?.hasMore));
        if (res.data?.stats) setStats(res.data.stats);
        else if (!opts.append) setStats(emptyStats);
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "msg" in e
            ? String((e as { msg: string }).msg)
            : e instanceof Error
              ? e.message
              : "加载失败";
        if (!opts.append) {
          setErrorMsg(msg);
          setItems([]);
          setStats(emptyStats);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [studentId, selectedMonth, debouncedQ]
  );

  useEffect(() => {
    void fetchPage({ append: false });
  }, [fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!hasMore || loading || loadingMoreRef.current || !nextCursor) return;
        void fetchPage({ cursor: nextCursor, append: true });
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, nextCursor, loading, fetchPage]);

  const displayName = studentTitle || `学员 #${studentId}`;

  const openDetail = async (item: StudentActivityListItem) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailKind(item.kind);
    setDetailVocab(null);
    setDetailCoaching(null);
    setDetailStudy(null);
    setDetailWordBookName("");
    try {
      if (item.kind === "vocab_test") {
        const res = await getStudentVocabRecordAsTeacher(studentId, item.id);
        if (res.code !== 200) throw new Error(res.msg || "加载失败");
        setDetailVocab(res.data as VocabTestRecordDTO);
      } else if (item.kind === "coaching_session") {
        const res = await getStudentCoachingSessionAsTeacher(studentId, item.id);
        if (res.code !== 200) throw new Error(res.msg || "加载失败");
        setDetailCoaching(res.data as CoachingSessionRecordDTO);
      } else if (item.kind === "study_session") {
        const res = await getStudentStudySessionAsTeacher(studentId, item.id);
        if (res.code !== 200) throw new Error(res.msg || "加载失败");
        setDetailStudy(res.data.session);
        setDetailWordBookName(res.data.wordBookName || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
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
        <div className="min-w-0">
          <span className="text-sm font-semibold text-[#2D3748] truncate block">{displayName}</span>
          <span className="text-[11px] text-[#A0AEC0]">活动记录</span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-white rounded-xl p-4 border border-[#FF6B6B]/30 text-[#FF6B6B]">{errorMsg}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#718096] text-xs mb-1">筛选后条数</div>
              <div className="text-[#2D3748] text-xl font-bold">{loading ? "-" : stats.total}</div>
              <div className="text-[11px] text-[#A0AEC0] mt-1">
                陪练 {stats.coaching} · 测评 {stats.vocab} · 训练 {stats.study}
              </div>
            </div>
            <div className="w-10 h-10 bg-[#4ECDC4]/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="text-[#4ECDC4]" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#718096] text-xs mb-1">词汇测评平均正确率</div>
              <div className="text-[#55A3FF] text-xl font-bold">
                {loading ? "-" : stats.vocab > 0 ? `${stats.vocabAvgCorrectRate}%` : "0%"}
              </div>
            </div>
            <div className="w-10 h-10 bg-[#55A3FF]/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-[#55A3FF]" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#718096] text-xs mb-1">词汇测评总题数</div>
              <div className="text-[#4ECDC4] text-xl font-bold">
                {loading ? "-" : stats.vocabTotalQuestions}
              </div>
            </div>
            <div className="w-10 h-10 bg-[#4ECDC4]/10 rounded-lg flex items-center justify-center">
              <BookOpen className="text-[#4ECDC4]" size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3 border border-[#E2E8F0]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CloudMonthPicker
            value={selectedMonth || undefined}
            allowClear
            placeholder="全部月份"
            onChange={(v) => setSelectedMonth(v || "")}
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0]" size={18} />
            <input
              type="text"
              placeholder="搜索标题、摘要、类型、记录 ID"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#2D3748] placeholder:text-[#A0AEC0] focus:outline-none focus:border-[#4ECDC4]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl p-6 text-[#718096] border border-[#E2E8F0]">加载中…</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-[#718096] border border-[#E2E8F0]">暂无记录</div>
        ) : (
          items.map((item) => {
            const badge = kindBadge(item.kind);
            const Icon = badge.Icon;
            const timeText = formatDateTime(item.time);
            return (
              <button
                type="button"
                key={`${item.kind}-${item.id}`}
                className="w-full text-left bg-white rounded-xl p-4 hover:shadow-md border border-[#E2E8F0] transition-shadow"
                onClick={() => void openDetail(item)}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${badge.className}`}
                  >
                    <Icon size={14} />
                    {badge.label}
                  </span>
                  <span className="text-xs text-[#A0AEC0] font-mono">#{item.id}</span>
                </div>
                <h3 className="text-[#2D3748] font-semibold text-sm">{item.title}</h3>
                <p className="text-sm text-[#718096] mt-1 leading-relaxed">{item.summary}</p>
                <p className="text-xs text-[#A0AEC0] mt-2">{timeText}</p>
              </button>
            );
          })
        )}

        <div ref={sentinelRef} className="h-4" />
        {loadingMore && (
          <div className="flex justify-center py-2 text-[#A0AEC0]">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}
        {!loading && !hasMore && items.length > 0 && (
          <p className="text-center text-[11px] text-[#A0AEC0] py-1">没有更多了</p>
        )}
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
              <div className="text-[#2D3748] font-semibold">记录详情</div>
              <CloudButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setDetailOpen(false);
                  setDetailKind(null);
                  setDetailVocab(null);
                  setDetailCoaching(null);
                  setDetailStudy(null);
                }}
              >
                关闭
              </CloudButton>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="text-[#718096]">加载中…</div>
              ) : detailKind === "vocab_test" && detailVocab ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">记录 ID</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">#{detailVocab.id}</div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">完成时间</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        {formatDateTime(detailVocab.completedAt || detailVocab.createdAt)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">测评等级</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        {detailVocab.estimatedLevel}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">估算词汇量</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        {detailVocab.estimatedVocab}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">正确题数</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        {detailVocab.correctCount}/{detailVocab.questionCount}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-[#E2E8F0] overflow-hidden">
                    <div className="px-4 py-3 bg-white border-b border-[#E2E8F0] text-sm font-semibold text-[#2D3748]">
                      答题明细
                    </div>
                    <div className="divide-y divide-[#E2E8F0]">
                      {safeParseAnswers(detailVocab.answers).length === 0 ? (
                        <div className="px-4 py-4 text-sm text-[#718096]">暂无答题明细</div>
                      ) : (
                        safeParseAnswers(detailVocab.answers).map((a, idx) => (
                          <div
                            key={`${a.questionId}-${idx}`}
                            className="px-4 py-3 flex items-center justify-between"
                          >
                            <div className="text-sm text-[#2D3748]">
                              #{idx + 1} 题（{a.level}）
                            </div>
                            <div
                              className={`text-sm font-semibold ${
                                a.correct ? "text-[#4ECDC4]" : "text-[#FF6B6B]"
                              }`}
                            >
                              {a.correct ? "正确" : "错误"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : detailKind === "coaching_session" && detailCoaching ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">完课记录 ID</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        #{detailCoaching.id}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">排课 ID</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        #{detailCoaching.appointmentId}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3 col-span-2">
                      <div className="text-xs text-[#718096]">上课时间</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        {formatDateTime(detailCoaching.startedAt)} —{" "}
                        {formatDateTime(detailCoaching.endedAt)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">实际分钟</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        {detailCoaching.actualMinutes}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">学员扣减</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        {detailCoaching.billedMinutes} 分钟
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">计入老师</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        {detailCoaching.teacherCreditedMinutes} 分钟
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F7F9FC] p-3">
                      <div className="text-xs text-[#718096]">状态</div>
                      <div className="text-sm font-semibold text-[#2D3748] mt-1">
                        {detailCoaching.status}
                      </div>
                    </div>
                  </div>
                  {detailCoaching.appointment && (
                    <div className="rounded-xl border border-[#E2E8F0] p-4 text-sm">
                      <div className="font-semibold text-[#2D3748] mb-2">关联排课</div>
                      <div className="text-[#718096]">
                        {detailCoaching.appointment.title || "（无标题）"} ·{" "}
                        {String(detailCoaching.appointment.scheduledDate || "").slice(0, 10)}{" "}
                        {detailCoaching.appointment.startTime}–{detailCoaching.appointment.endTime}
                      </div>
                    </div>
                  )}
                </div>
              ) : detailKind === "study_session" && detailStudy ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#F7F9FC] p-3">
                    <div className="text-xs text-[#718096]">会话 ID</div>
                    <div className="text-sm font-semibold text-[#2D3748] mt-1">#{detailStudy.id}</div>
                  </div>
                  <div className="rounded-xl bg-[#F7F9FC] p-3">
                    <div className="text-xs text-[#718096]">词库</div>
                    <div className="text-sm font-semibold text-[#2D3748] mt-1">
                      {detailWordBookName || `词库 #${detailStudy.wordBookId}`}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F7F9FC] p-3">
                    <div className="text-xs text-[#718096]">类型</div>
                    <div className="text-sm font-semibold text-[#2D3748] mt-1">
                      {detailStudy.sessionType}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F7F9FC] p-3">
                    <div className="text-xs text-[#718096]">状态</div>
                    <div className="text-sm font-semibold text-[#2D3748] mt-1">{detailStudy.status}</div>
                  </div>
                  <div className="rounded-xl bg-[#F7F9FC] p-3 col-span-2">
                    <div className="text-xs text-[#718096]">时间</div>
                    <div className="text-sm font-semibold text-[#2D3748] mt-1">
                      开始 {formatDateTime(detailStudy.startedAt)}
                      {detailStudy.completedAt
                        ? ` · 结束 ${formatDateTime(detailStudy.completedAt)}`
                        : ""}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F7F9FC] p-3">
                    <div className="text-xs text-[#718096]">词数</div>
                    <div className="text-sm font-semibold text-[#2D3748] mt-1">
                      {detailStudy.wordCount}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F7F9FC] p-3">
                    <div className="text-xs text-[#718096]">答对</div>
                    <div className="text-sm font-semibold text-[#2D3748] mt-1">
                      {detailStudy.correctCount}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[#718096]">暂无数据</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
