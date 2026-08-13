import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, TrendingUp, BookOpen } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudMonthPicker } from "../components/cloudsteps/arco";
import { PageBackHeader } from "../components/PageBackHeader";
import { getVocabRecordDetail, listVocabRecords } from "../api/vocab";

type VocabTestRecord = {
  id: number;
  createdAt: string;
  completedAt?: string | null;
  estimatedLevel: string;
  estimatedVocab: number;
  questionCount: number;
  correctCount: number;
  answers?: string;
};

type AnswerDetail = {
  questionId: number;
  answer: string;
  correct: boolean;
  level: string;
};

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

const fieldClass =
  "w-full pl-10 pr-3 py-2.5 rounded-xl bg-card border border-input text-sm text-charcoal placeholder:text-muted-soft outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/25";

export default function TestRecords() {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [records, setRecords] = useState<VocabTestRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<VocabTestRecord | null>(null);

  const loadList = async (nextPage: number) => {
    const res = await listVocabRecords({ page: nextPage, pageSize });
    if (res.code !== 200) throw new Error(res.msg || "获取记录失败");
    const list = Array.isArray(res.data?.list) ? (res.data.list as VocabTestRecord[]) : [];
    setRecords(list);
    setTotal(Number(res.data?.total || 0));
    setPage(Number(res.data?.page || nextPage));
  };

  const loadDetail = async (id: number) => {
    const res = await getVocabRecordDetail(id);
    if (res.code !== 200) throw new Error(res.msg || "获取详情失败");
    setDetail(res.data as VocabTestRecord);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        await loadList(1);
      } catch (e: any) {
        if (!mounted) return;
        setErrorMsg(e?.msg || e?.message || "加载失败");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredData = useMemo(() => {
    const kw = searchKeyword.trim();
    return records.filter((r) => {
      const dateStr = String(r.completedAt || r.createdAt || "").slice(0, 10);
      if (selectedMonth) {
        const monthStr = dateStr.slice(0, 7);
        if (monthStr !== selectedMonth) return false;
      }
      if (!kw) return true;
      return (
        String(r.estimatedLevel || "").toLowerCase().includes(kw.toLowerCase()) ||
        String(r.estimatedVocab || "").includes(kw) ||
        String(r.id || "").includes(kw)
      );
    });
  }, [records, searchKeyword, selectedMonth]);

  const avgCorrectRate = useMemo(() => {
    if (filteredData.length === 0) return "0";
    const sum = filteredData.reduce((acc, r) => {
      const totalQ = Number(r.questionCount || 0);
      const correctQ = Number(r.correctCount || 0);
      if (totalQ <= 0) return acc;
      return acc + (correctQ / totalQ) * 100;
    }, 0);
    return String(Math.round(sum / filteredData.length));
  }, [filteredData]);

  const totalQuestions = useMemo(() => {
    return filteredData.reduce((sum, r) => sum + Number(r.questionCount || 0), 0);
  }, [filteredData]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageBackHeader
        title="词汇测试记录"
        subtitle="查看历史测评结果与答题明细"
        fallbackTo="/coach-center"
        maxWidthClass="max-w-[1200px]"
      />

      <div className="flex-1 flex flex-col min-h-0 max-w-[1200px] w-full mx-auto px-4 py-4 gap-3">
        {errorMsg && (
          <div className="shrink-0 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="shrink-0 grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-xl bg-tint-mint border border-transparent px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground">测试次数</div>
                <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums mt-0.5">
                  {loading ? "-" : filteredData.length}
                </div>
              </div>
              <CheckCircle2 className="text-primary shrink-0 hidden sm:block" size={20} />
            </div>
          </div>
          <div className="rounded-xl bg-tint-sky border border-transparent px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground">平均正确率</div>
                <div className="text-xl sm:text-2xl font-semibold text-secondary-brand tabular-nums mt-0.5">
                  {loading ? "-" : `${avgCorrectRate}%`}
                </div>
              </div>
              <TrendingUp className="text-secondary-brand shrink-0 hidden sm:block" size={20} />
            </div>
          </div>
          <div className="rounded-xl bg-muted border border-transparent px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground">总测试词</div>
                <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums mt-0.5">
                  {loading ? "-" : totalQuestions}
                </div>
              </div>
              <BookOpen className="text-charcoal shrink-0 hidden sm:block" size={20} />
            </div>
          </div>
        </div>

        <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="relative">
            <CloudMonthPicker
              value={selectedMonth || undefined}
              allowClear
              placeholder="全部月份"
              onChange={(v) => setSelectedMonth(v || "")}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft z-10" size={16} />
            <input
              type="text"
              placeholder="搜索等级 / 词汇量 / 记录 ID"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="h-full min-h-[12rem] flex items-center justify-center text-sm text-muted-foreground">
                加载中…
              </div>
            ) : filteredData.length === 0 ? (
              <div className="h-full min-h-[12rem] flex flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {selectedMonth || searchKeyword ? "当前筛选下暂无记录" : "暂无记录"}
                </p>
                {(selectedMonth || searchKeyword) && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      setSelectedMonth("");
                      setSearchKeyword("");
                    }}
                  >
                    清除筛选
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredData.map((item) => {
                  const totalQ = Number(item.questionCount || 0);
                  const correctQ = Number(item.correctCount || 0);
                  const wrongQ = Math.max(0, totalQ - correctQ);
                  const rate = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
                  const timeText = formatDateTime(item.completedAt || item.createdAt);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className="w-full text-left px-4 py-3.5 sm:px-5 hover:bg-muted/40 transition-colors"
                      onClick={async () => {
                        try {
                          setDetailOpen(true);
                          setDetailLoading(true);
                          setDetail(null);
                          await loadDetail(item.id);
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setDetailLoading(false);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              记录 #{item.id}
                            </span>
                            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                              等级 {item.estimatedLevel || "-"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{timeText}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-semibold text-primary tabular-nums">{rate}%</div>
                          <div className="text-[11px] text-muted-foreground">正确率</div>
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          总词 <span className="text-charcoal font-medium">{totalQ}</span>
                        </span>
                        <span>
                          正确 <span className="text-primary font-medium">{correctQ}</span>
                        </span>
                        <span>
                          错误 <span className="text-destructive font-medium">{wrongQ}</span>
                        </span>
                        <span>
                          词汇量{" "}
                          <span className="text-charcoal font-medium">{item.estimatedVocab || 0}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between gap-3 bg-surface-soft/80">
            <span className="text-xs text-muted-foreground tabular-nums">
              第 {page}/{totalPages} 页，共 {total} 条
              {selectedMonth || searchKeyword
                ? ` · 本页筛选后 ${filteredData.length} 条`
                : ""}
            </span>
            <div className="flex gap-2">
              <CloudButton
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const nextPage = Math.max(1, page - 1);
                  if (nextPage === page) return;
                  try {
                    setLoading(true);
                    await loadList(nextPage);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || page <= 1}
              >
                上一页
              </CloudButton>
              <CloudButton
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const nextPage = Math.min(totalPages, page + 1);
                  if (nextPage === page) return;
                  try {
                    setLoading(true);
                    await loadList(nextPage);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || page >= totalPages}
              >
                下一页
              </CloudButton>
            </div>
          </div>
        </div>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card rounded-xl border border-border overflow-hidden max-h-[85dvh] flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="text-sm font-semibold text-foreground">记录详情</div>
              <CloudButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDetailOpen(false);
                  setDetail(null);
                }}
              >
                关闭
              </CloudButton>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="text-sm text-muted-foreground">加载中...</div>
              ) : !detail ? (
                <div className="text-sm text-muted-foreground">暂无数据</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-muted px-3 py-2.5">
                      <div className="text-[11px] text-muted-foreground">记录ID</div>
                      <div className="text-sm font-semibold text-foreground mt-0.5">#{detail.id}</div>
                    </div>
                    <div className="rounded-xl bg-muted px-3 py-2.5">
                      <div className="text-[11px] text-muted-foreground">完成时间</div>
                      <div className="text-sm font-semibold text-foreground mt-0.5">
                        {formatDateTime(detail.completedAt || detail.createdAt)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted px-3 py-2.5">
                      <div className="text-[11px] text-muted-foreground">测评等级</div>
                      <div className="text-sm font-semibold text-foreground mt-0.5">
                        {detail.estimatedLevel}
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted px-3 py-2.5">
                      <div className="text-[11px] text-muted-foreground">估算词汇量</div>
                      <div className="text-sm font-semibold text-foreground mt-0.5">
                        {detail.estimatedVocab}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-2.5 bg-surface-soft border-b border-border text-sm font-semibold text-foreground">
                      答题明细
                    </div>
                    <div className="divide-y divide-border">
                      {safeParseAnswers(detail.answers).length === 0 ? (
                        <div className="px-4 py-4 text-sm text-muted-foreground">暂无答题明细</div>
                      ) : (
                        safeParseAnswers(detail.answers).map((a, idx) => (
                          <div
                            key={`${a.questionId}-${idx}`}
                            className="px-4 py-2.5 flex items-center justify-between"
                          >
                            <div className="text-sm text-charcoal">
                              #{idx + 1} 题（{a.level}）
                            </div>
                            <div
                              className={`text-sm font-semibold ${
                                a.correct ? "text-primary" : "text-destructive"
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
