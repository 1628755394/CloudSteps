import { useEffect, useState, useCallback } from "react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { BookOpen, RotateCcw, X, Volume2, Download } from "lucide-react";
import { listStudySessions, getStudySessionDetail, type StudySessionListItem, type StudyWordItem } from "../api/study";
import { playFirstWordAudio } from "../utils/audioPlayer";
import { formatTranslation } from "../utils/wordFormat";
import { downloadExcelRows } from "../utils/excelExport";
import { showToast } from "../utils/toast";

type Tab = "study" | "review";

export default function TrainingRecords() {
  const [tab, setTab] = useState<Tab>("study");
  const [list, setList] = useState<StudySessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailWords, setDetailWords] = useState<StudyWordItem[]>([]);
  const [detailSession, setDetailSession] = useState<StudySessionListItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listStudySessions({
        page,
        pageSize,
        sessionType: tab,
      });
      if (res.code === 200) {
        setList(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } catch (e) {
      console.error("加载记录失败:", e);
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openDetail = async (item: StudySessionListItem) => {
    setDetailOpen(true);
    setDetailSession(item);
    setDetailWords([]);
    setDetailLoading(true);
    try {
      const res = await getStudySessionDetail(item.id);
      if (res.code === 200) {
        const words = (res.data?.words || []).map((w: any) => ({
          ...w,
          translation: w.translation ? formatTranslation(w.translation) : undefined,
        }));
        setDetailWords(words);
      }
    } catch (e) {
      console.error("加载详情失败:", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePlayAudio = (word: StudyWordItem) => {
    if (!word.audioUrl) return;
    setPlayingId(word.id);
    playFirstWordAudio(word.audioUrl, () => setPlayingId(null));
  };

  const fmtTime = (ts?: string | null) => {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return ts;
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const all: StudySessionListItem[] = [];
      let p = 1;
      const size = 100;
      // 拉取当前 tab 全部记录再导出
      for (;;) {
        const res = await listStudySessions({ page: p, pageSize: size, sessionType: tab });
        if (res.code !== 200) break;
        const chunk = res.data?.list || [];
        all.push(...chunk);
        const t = res.data?.total || 0;
        if (all.length >= t || chunk.length === 0) break;
        p += 1;
        if (p > 50) break;
      }

      const title = tab === "study" ? "正课记录" : "抗遗忘记录";
      const rows: Array<Array<string | number>> = [
        ["词库", "状态", "开始时间", "单词数", "正确数", "正确率(%)"],
        ...all.map((item) => {
          const rate = item.wordCount > 0 ? Math.round((item.correctCount / item.wordCount) * 100) : 0;
          return [
            item.wordBookName || `词书 #${item.wordBookId || "—"}`,
            item.status === "completed" ? "已完成" : "进行中",
            fmtTime(item.startedAt),
            item.wordCount || 0,
            item.correctCount || 0,
            rate,
          ];
        }),
      ];
      const stamp = new Date().toISOString().slice(0, 10);
      downloadExcelRows(`学习记录-${title}-${stamp}.xls`, title, rows);
      showToast.success("导出成功");
    } catch (e) {
      console.error(e);
      showToast.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">学习记录</h1>
          <p className="text-sm text-muted-foreground mt-1">正课与抗遗忘复习记录</p>
        </div>
        <CloudButton
          type="button"
          variant="outline"
          size="sm"
          disabled={exporting || loading}
          onClick={() => void handleExport()}
          className="shrink-0"
        >
          <Download size={16} />
          {exporting ? "导出中…" : "导出 Excel"}
        </CloudButton>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("study")}
          className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            tab === "study"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground border border-border"
          }`}
        >
          正课记录
        </button>
        <button
          type="button"
          onClick={() => setTab("review")}
          className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            tab === "review"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground border border-border"
          }`}
        >
          抗遗忘记录
        </button>
      </div>

      {loading ? (
        <CloudCard className="p-10 text-center text-muted-foreground">加载中...</CloudCard>
      ) : list.length === 0 ? (
        <CloudCard className="p-10 text-center">
          <div className="text-foreground font-semibold text-lg">
            {tab === "study" ? "暂无正课记录" : "暂无抗遗忘记录"}
          </div>
          <div className="text-muted-foreground text-sm mt-2">
            {tab === "study" ? "开始学习后这里会显示记录" : "开始复习后这里会显示记录"}
          </div>
        </CloudCard>
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const correctRate =
              item.wordCount > 0 ? Math.round((item.correctCount / item.wordCount) * 100) : 0;
            return (
              <CloudCard
                key={item.id}
                interactive
                className="p-4 hover:border-primary/40 transition-colors"
                onClick={() => openDetail(item)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {tab === "study" ? (
                      <BookOpen size={16} className="text-primary shrink-0" />
                    ) : (
                      <RotateCcw size={16} className="text-secondary-brand shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-foreground truncate">
                      {item.wordBookName || `词书 #${item.wordBookId || "—"}`}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md shrink-0 ${
                      item.status === "completed"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {item.status === "completed" ? "已完成" : "进行中"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{fmtTime(item.startedAt)}</span>
                  <span>单词 {item.wordCount} 个</span>
                  <span>正确 {item.correctCount} 个</span>
                  {item.wordCount > 0 && <span>正确率 {correctRate}%</span>}
                </div>
              </CloudCard>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <CloudButton
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </CloudButton>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <CloudButton
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </CloudButton>
            </div>
          )}
        </div>
      )}

      {detailOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl border border-border max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-soft-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h3 className="text-base font-semibold text-foreground">
                {detailSession?.wordBookName || "学习详情"}
              </h3>
              <CloudButton type="button" variant="ghost" size="iconRound" onClick={() => setDetailOpen(false)}>
                <X size={20} className="text-muted-foreground" />
              </CloudButton>
            </div>
            <div className="px-4 py-2 border-b border-border shrink-0">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{fmtTime(detailSession?.startedAt)}</span>
                <span>单词 {detailSession?.wordCount || 0} 个</span>
                <span>正确 {detailSession?.correctCount || 0} 个</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {detailLoading ? (
                <div className="text-center text-muted-foreground py-8">加载中...</div>
              ) : detailWords.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">暂无单词数据</div>
              ) : (
                <div className="space-y-2">
                  {detailWords.map((word, idx) => (
                    <div
                      key={word.id}
                      className="flex items-center justify-between bg-muted/60 rounded-xl p-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-xs text-muted-soft shrink-0">{idx + 1}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{word.word}</div>
                          {word.translation && (
                            <div className="text-xs text-muted-foreground truncate">{word.translation}</div>
                          )}
                        </div>
                      </div>
                      {word.audioUrl && (
                        <CloudButton
                          type="button"
                          variant="ghost"
                          size="iconRound"
                          className="shrink-0"
                          onClick={() => handlePlayAudio(word)}
                        >
                          <Volume2
                            size={18}
                            className={
                              playingId === word.id ? "text-primary animate-pulse" : "text-secondary-brand"
                            }
                          />
                        </CloudButton>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
