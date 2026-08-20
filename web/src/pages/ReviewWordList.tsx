import { useNavigate } from "react-router";
import { Volume2, Check, X, BookOpen, PanelTop } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getReviewToday, startReviewSession, completeReviewSession } from "../api/review";
import { playFirstWordAudio, playWordAudio } from "../utils/audioPlayer";
import {
  PracticeFontSettingsButton,
  PRACTICE_TRANS_CLASS,
  PRACTICE_WORD_CLASS,
} from "../components/PracticeFontSettings";
import { CloudButton } from "../components/cloudsteps";
import { FlowPageShell } from "../components/PageTransition";
import { TopBar } from "../components/TopBar";
import {
  WordCardPanel,
  WordMarkStatsBar,
  WordViewModeToggle,
  type WordViewMode,
} from "../components/WordMarkView";
import { WordDetailPanel } from "../components/WordDetailPanel";
import { nextWordTapState, syncDetailWordWithTap } from "../utils/wordReveal";
import { getReviewReturnPath } from "../utils/reviewPractice";
import { StudyNotePanel } from "../components/StudyNotePanel";

type ReviewWordItem = {
  id: number;
  word: string;
  translation?: string;
  audioUrl?: string;
  status: null | "correct" | "wrong";
  showTranslation?: boolean;
  heard?: boolean;
};

/** 将 translation 字段（可能是 JSON 数组字符串如 ["你好"]）转为可读文本 */
const formatTranslation = (raw?: string): string => {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.join("；");
    return String(arr);
  } catch {
    return raw;
  }
};

export default function ReviewWordList() {
  const navigate = useNavigate();
  const [words, setWords] = useState<ReviewWordItem[]>([]);
  const [viewMode, setViewMode] = useState<WordViewMode>("list");
  const [cardIndex, setCardIndex] = useState(0);
  const [detailMode, setDetailMode] = useState(false);
  const [detailWord, setDetailWord] = useState<{ id: number; word: string } | null>(null);
  const [globalNoteOpen, setGlobalNoteOpen] = useState(false);
  const [noteSide, setNoteSide] = useState<"left" | "right">("right");
  const [noteWidth, setNoteWidth] = useState(() => {
    try {
      const raw = localStorage.getItem("lb_review_note_width");
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n)) return Math.max(200, n);
      }
    } catch { /* ignore */ }
    return 420;
  });
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const wordBookId = useMemo(() => {
    const url = new URL(window.location.href);
    const qp = Number(url.searchParams.get("wordBookId") || 0);
    if (qp) return qp;
    return Number(sessionStorage.getItem("lb_review_wordbook_id") || 0);
  }, []);

  const reviewDate = useMemo(() => {
    const url = new URL(window.location.href);
    const qp = url.searchParams.get("date") || "";
    if (qp) return qp;
    return sessionStorage.getItem("lb_review_date") || "";
  }, []);

  const viewOnly = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams.get("view") === "1";
  }, []);

  const [playingId, setPlayingId] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const handlePlayAudio = (item: ReviewWordItem) => {
    if (!item.audioUrl) return;
    abortRef.current?.();
    setPlayingId(item.id);
    const abort = playWordAudio(item.audioUrl, 300, () => setPlayingId(null));
    abortRef.current = abort;
  };

  const startNoteResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = noteWidth;
    let latestW = startW;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const delta = ev.clientX - startX;
      // right side: drag left increases width; left side: drag right increases width
      const next = Math.max(200, startW + (noteSide === "right" ? -delta : delta));
      latestW = next;
      setNoteWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try { localStorage.setItem("lb_review_note_width", String(latestW)); } catch { /* ignore */ }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [noteWidth, noteSide]);

  useEffect(() => {
    if (viewOnly) return;
    sessionStorage.setItem("lb_mode", "review");
  }, [viewOnly]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getReviewToday(wordBookId, {
          date: reviewDate || undefined,
          limit: 200,
        });
        const ws = Array.isArray(res.data?.words)
          ? (res.data.words as Array<{
              id: number;
              word: string;
              translation?: string;
              audioUrl?: string;
            }>)
          : [];
        const mapped: ReviewWordItem[] = ws.map((w) => ({
          id: Number(w.id),
          word: String(w.word || ""),
          translation: w.translation ? formatTranslation(String(w.translation)) : undefined,
          audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
          status: null,
          showTranslation: false,
          heard: false,
        }));
        if (!mounted) return;
        setWords(mapped);
      } catch {
        if (!mounted) return;
        setWords([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [wordBookId, reviewDate]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(getReviewReturnPath("/word-training"));
  };

  const handleStatusClick = useCallback((id: number, newStatus: "correct" | "wrong") => {
    setHint(null);
    setWords((prev) =>
      prev.map((word) => {
        if (word.id !== id) return word;
        // 再点同一状态则取消勾选
        if (word.status === newStatus) return { ...word, status: null };
        return { ...word, status: newStatus };
      })
    );
  }, []);

  const handleWordClick = (item: ReviewWordItem) => {
    const next = nextWordTapState({
      showTranslation: !!item.showTranslation,
      heard: !!item.heard,
    });
    if (next.shouldPlay && item.audioUrl) {
      abortRef.current?.();
      setPlayingId(item.id);
      const abort = playFirstWordAudio(item.audioUrl, () => setPlayingId(null));
      abortRef.current = abort;
    }
    setWords((prev) =>
      prev.map((word) => {
        if (word.id === item.id) {
          return { ...word, heard: next.heard, showTranslation: next.showTranslation };
        }
        if (next.showTranslation) {
          return { ...word, showTranslation: false };
        }
        return word;
      })
    );
    setDetailWord(syncDetailWordWithTap(detailMode, next, { id: item.id, word: item.word }));
  };

  /** 批量：全部认识 */
  const markAllCorrect = () => {
    setHint(null);
    setWords((prev) => prev.map((w) => ({ ...w, status: "correct" as const })));
  };

  /** 清空标记 */
  const clearMarks = () => {
    setHint(null);
    setWords((prev) => prev.map((w) => ({ ...w, status: null })));
  };

  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const markedWords = useMemo(() => words.filter((w) => w.status !== null), [words]);
  const markedCount = markedWords.length;
  const unmarkedCount = words.length - markedCount;
  const allMarked = words.length > 0 && unmarkedCount === 0;

  const handleSubmit = () => {
    if (submitting) return;
    if (words.length === 0) {
      setHint("当前没有可复习的单词");
      return;
    }
    if (!allMarked) {
      setHint(`还有 ${unmarkedCount} 个单词未勾选，请全部选择 ✓ 或 × 后再提交`);
      return;
    }
    setHint(null);

    (async () => {
      setSubmitting(true);
      try {
        const wordIds = markedWords.map((w) => w.id);
        const startRes = await startReviewSession({ wordBookId, wordIds });
        const sid = Number(startRes.data?.sessionId || 0);
        if (!sid) {
          setHint("无待复习单词，已返回");
          setSubmitting(false);
          handleBack();
          return;
        }

        // 直接提交复习结果：✓ = remembered, ✗ = forgot
        const results = markedWords.map((w) => ({
          wordId: w.id,
          remembered: w.status === "correct",
        }));
        const res = await completeReviewSession(sid, results);
        if (res.code !== 200) {
          throw new Error(res.msg || "提交失败");
        }
        const returnPath = getReviewReturnPath("/word-training");
        sessionStorage.removeItem("lb_review_return");
        if (sessionStorage.getItem("lb_mode") === "review") {
          sessionStorage.removeItem("lb_mode");
        }
        navigate(returnPath, { replace: true });
      } catch {
        setHint("提交复习结果失败，请稍后重试");
        setSubmitting(false);
      }
    })();
  };

  const correctCount = words.filter((word) => word.status === "correct").length;
  const wrongCount = words.filter((word) => word.status === "wrong").length;

  return (
    <FlowPageShell className="min-h-dvh bg-[#F7F9FC] pb-[max(7.5rem,env(safe-area-inset-bottom))]">
      <TopBar
        title={viewOnly ? "查看" : "开始复习"}
        onBack={handleBack}
        rightSlot={
          <div className="flex items-center gap-0.5">
            <CloudButton type="button" variant="ghost" size="iconRound" onClick={() => setGlobalNoteOpen(true)} aria-label="打开随心记" title="打开随心记"><PanelTop size={18} className="text-[#c45c78]" /></CloudButton>
            <PracticeFontSettingsButton />
          </div>
        }
      />

      {/* Split container: word content + note panel on the same layer. */}
      <div className={`px-4 pt-3 pb-4 w-full ${globalNoteOpen && isDesktop ? "lg:flex lg:gap-2 lg:max-w-none lg:px-2" : "max-w-2xl mx-auto"}`} style={globalNoteOpen && isDesktop ? { height: "calc(100dvh - 3.5rem - 6rem)" } : undefined}>
        {/* Word content pane */}
        <div className={`${globalNoteOpen && isDesktop ? "lg:flex-1 lg:min-w-0 lg:overflow-y-auto" : ""} ${globalNoteOpen && isDesktop && noteSide === "right" ? "" : globalNoteOpen && isDesktop ? "lg:order-2" : ""}`}>
          <div className="mb-3">
            <p className="text-[#718096] text-sm">
              {viewOnly ? `当前共有 ${words.length} 个单词` : `当前共有 ${words.length} 个可选单词`}
            </p>
            {words.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                该日暂无待复习单词
              </p>
            )}
          </div>

        {!viewOnly && (
          <WordMarkStatsBar
            correctCount={correctCount}
            wrongCount={wrongCount}
            total={words.length}
          />
        )}

        {viewMode === "card" ? (
          <div className="mt-3">
            <WordCardPanel
              words={words}
              index={cardIndex}
              onIndexChange={setCardIndex}
              playingId={playingId}
              onPlay={handlePlayAudio}
              onWordClick={handleWordClick}
              onStatus={handleStatusClick}
              hideStatus={viewOnly}
              amplifyDetail={detailMode}
              onDetailClose={() => setDetailWord(null)}
            />
          </div>
        ) : (
          <div className="space-y-2.5 mt-3">
            {words.map((item, index) => {
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl p-3.5 shadow-sm border border-transparent transition-all hover:shadow-md hover:border-[#4ECDC4]/35 ${
                    item.status === "correct"
                      ? "border-2 border-[#4ECDC4] bg-[#4ECDC4]/[0.06] hover:border-[#4ECDC4]"
                      : item.status === "wrong"
                      ? "border-2 border-[#FF6B6B] bg-[#FF6B6B]/5 hover:border-[#FF6B6B]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="text-[#A0AEC0] text-xs mt-1 tabular-nums w-5 shrink-0">
                        {index + 1}
                      </span>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleWordClick(item)}
                      >
                        <h3
                          className={`${PRACTICE_WORD_CLASS} !font-semibold hover:text-[#4ECDC4] transition-colors break-all`}
                        >
                          {item.word}
                        </h3>
                        {item.showTranslation && item.translation && (
                          <p
                            className={`${PRACTICE_TRANS_CLASS} mt-1.5 animate-in fade-in slide-in-from-top-1`}
                          >
                            {item.translation}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <CloudButton
                        type="button"
                        variant="ghost"
                        size="iconRound"
                        onClick={() => handlePlayAudio(item)}
                        className={playingId === item.id ? "text-[#4ECDC4]" : "text-[#55A3FF]"}
                      >
                        <Volume2 size={20} className={playingId === item.id ? "animate-pulse" : ""} />
                      </CloudButton>
                      {!viewOnly && (
                        <>
                          <CloudButton
                            type="button"
                            variant={item.status === "correct" ? "mint" : "ghost"}
                            size="iconRound"
                            onClick={() => handleStatusClick(item.id, "correct")}
                          >
                            <Check size={18} />
                          </CloudButton>
                          <CloudButton
                            type="button"
                            variant={item.status === "wrong" ? "destructive" : "ghost"}
                            size="iconRound"
                            onClick={() => handleStatusClick(item.id, "wrong")}
                          >
                            <X size={18} />
                          </CloudButton>
                        </>
                      )}
                    </div>
                  </div>
                  {detailMode && item.showTranslation && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0]" onClick={(e) => e.stopPropagation()}>
                      <WordDetailPanel
                        wordId={item.id}
                        wordText={item.word}
                        variant="inline"
                        onClose={() => setDetailWord(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Note panel pane — same layer as word content (desktop split only) */}
        {globalNoteOpen && isDesktop && (
          <>
            {/* Drag handle between word content and note panel */}
            <div
              className={`group hidden lg:flex lg:items-center lg:justify-center lg:cursor-ew-resize lg:touch-none lg:select-none ${noteSide === "right" ? "lg:order-2" : "lg:order-1"}`}
              style={{ width: "10px", flexShrink: 0 }}
              onPointerDown={startNoteResize}
              title="拖动调整随心记宽度"
              aria-label="拖动调整随心记宽度"
            >
              <span className="h-16 w-1 rounded-full bg-[#A0AEC0]/30 group-hover:bg-[#4ECDC4]/60 group-hover:w-1.5 transition-all" />
            </div>
            <div
              className={`lg:flex lg:flex-col ${noteSide === "right" ? "lg:order-3" : "lg:order-1"}`}
              style={{ width: `${noteWidth}px`, flexShrink: 0 }}
            >
              <StudyNotePanel
                open={globalNoteOpen}
                onClose={() => setGlobalNoteOpen(false)}
                storageKey={`study-note:global:${wordBookId}`}
                title="随心记"
                side={noteSide}
                split
                onSideChange={setNoteSide}
              />
            </div>
          </>
        )}
      </div>

      {/* Mobile: note panel as floating overlay */}
      {globalNoteOpen && !isDesktop && (
        <StudyNotePanel
          open={globalNoteOpen}
          onClose={() => setGlobalNoteOpen(false)}
          storageKey={`study-note:global:${wordBookId}`}
          title="随心记"
          side={noteSide}
          onSideChange={setNoteSide}
        />
      )}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E2E8F0] px-4 py-3 shadow-lg">
        <div className="max-w-2xl mx-auto w-full space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {!viewOnly && (
              <>
                <CloudButton type="button" variant="outline" size="pill" onClick={markAllCorrect}>
                  全部认识
                </CloudButton>
                <CloudButton
                  type="button"
                  variant="ghost"
                  size="pill"
                  onClick={clearMarks}
                  disabled={markedCount === 0}
                >
                  清空
                </CloudButton>
              </>
            )}
            <div className="flex-1" />
            <WordViewModeToggle mode={viewMode} onChange={setViewMode} />
            <CloudButton
              type="button"
              variant={detailMode ? "brand" : "outline"}
              size="pill"
              onClick={() => {
                setDetailMode((v) => {
                  if (v) setDetailWord(null);
                  return !v;
                });
              }}
            >
              <BookOpen size={16} />
              拓展
            </CloudButton>
          </div>
          {!viewOnly && (
            <>
              <CloudButton
                type="button"
                variant="brand"
                size="pill"
                onClick={handleSubmit}
                disabled={submitting || !allMarked}
                loading={submitting}
                loadingText="提交中…"
                className={`w-full ${!allMarked && words.length > 0 ? "opacity-80" : ""}`}
              >
                提交复习
                {words.length > 0 ? ` (${markedCount}/${words.length})` : ""}
              </CloudButton>
              {hint && (
                <p className="text-center text-xs text-amber-600 px-1 animate-in fade-in">{hint}</p>
              )}
              {!hint && !allMarked && words.length > 0 && (
                <p className="text-center text-xs text-[#FF6B6B]">
                  还有 {unmarkedCount} 个单词未勾选，请全部选择 ✓ 或 × 后再提交
                </p>
              )}
              {!hint && allMarked && words.length > 0 && (
                <p className="text-center text-xs text-[#A0AEC0]">
                  已全部勾选，可提交复习
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </FlowPageShell>
  );
}
