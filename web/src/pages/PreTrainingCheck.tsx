import { Volume2, Check, X, Shuffle, Loader2, ArrowDownAZ, BookOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";

import { getStudyWords, startStudySession } from "../api/study";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
import { CloudButton } from "../components/cloudsteps";
import { TopBar } from "../components/TopBar";
import { FlowPageShell } from "../components/PageTransition";
import {
  WordCardPanel,
  WordMarkStatsBar,
  WordViewModeToggle,
  type WordViewMode,
} from "../components/WordMarkView";
import { WordDetailDialog } from "../components/WordDetailDialog";
import { playFirstWordAudio, playWordAudio } from "../utils/audioPlayer";
import { formatTranslation } from "../utils/wordFormat";
import { nextWordTapState } from "../utils/wordReveal";

type WordItem = {
  id: number;
  word: string;
  translation?: string;
  audioUrl?: string;
  showTranslation?: boolean;
  heard?: boolean;
  status: null | "correct" | "wrong";
};

const PAGE_SIZE = 100;

export default function PreTrainingCheck() {
  const navigate = useNavigate();
  const [words, setWords] = useState<WordItem[]>([]);
  const [selectedCount, setSelectedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shuffleMode, setShuffleMode] = useState(false);

  const loadingRef = useRef(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const shuffleModeRef = useRef(false);
  const shuffleSeedRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelNodeRef = useRef<HTMLDivElement | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [viewMode, setViewMode] = useState<WordViewMode>("list");
  const [cardIndex, setCardIndex] = useState(0);
  const [detailMode, setDetailMode] = useState(false);
  const [detailWord, setDetailWord] = useState<{ id: number; word: string } | null>(null);

  const handlePlayAudio = useCallback((word: WordItem) => {
    if (!word.audioUrl) return;
    abortRef.current?.();
    setPlayingId(word.id);
    const abort = playWordAudio(word.audioUrl, 300, () => setPlayingId(null));
    abortRef.current = abort;
  }, []);

  const handleBack = () => {
    navigate("/word-training");
  };

  const wordBookId = useMemo(() => Number(sessionStorage.getItem("lb_wordbook_id") || 0), []);

  const loadWords = useCallback(
    async (page: number, isInitial = false) => {
      if (loadingRef.current || !wordBookId) return;

      loadingRef.current = true;
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await getStudyWords(wordBookId, page, PAGE_SIZE, {
          shuffle: shuffleModeRef.current,
          seed: shuffleSeedRef.current,
        });
        const list = res.data?.words;
        const totalCount = res.data?.total || 0;
        if (res.data?.seed && shuffleModeRef.current) {
          shuffleSeedRef.current = Number(res.data.seed);
        }
        const arr = Array.isArray(list)
          ? (list as Array<{ id: number; word: string; translation?: string; audioUrl?: string }>)
          : [];

        if (arr.length === 0) {
          hasMoreRef.current = false;
          setHasMore(false);
          if (page === 1) setWords([]);
          return;
        }

        const newWords = arr.map((w) => ({
          id: w.id,
          word: w.word,
          translation: w.translation ? formatTranslation(w.translation) : undefined,
          audioUrl: w.audioUrl,
          showTranslation: false,
          heard: false,
          status: null as WordItem["status"],
        }));

        setWords((prev) => {
          const updated = page === 1 ? newWords : [...prev, ...newWords];
          const more = arr.length >= PAGE_SIZE && updated.length < totalCount;
          hasMoreRef.current = more;
          setHasMore(more);
          return updated;
        });

        pageRef.current = page;
        setCurrentPage(page);
        setError(null);
      } catch (err) {
        console.error("加载单词失败:", err);
        setError("加载单词失败，请重试");
      } finally {
        loadingRef.current = false;
        if (isInitial) {
          setInitialLoading(false);
        } else {
          setLoading(false);
        }
      }
    },
    [wordBookId]
  );

  const attachObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    const node = sentinelNodeRef.current;
    if (!node || !hasMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const hit = entries[0]?.isIntersecting;
        if (!hit || !hasMoreRef.current || loadingRef.current) return;
        void loadWords(pageRef.current + 1, false);
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 }
    );
    observerRef.current.observe(node);
  }, [loadWords]);

  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      sentinelNodeRef.current = node;
      attachObserver();
    },
    [attachObserver]
  );

  // 初始加载
  useEffect(() => {
    if (!wordBookId) return;
    shuffleModeRef.current = false;
    shuffleSeedRef.current = 0;
    setShuffleMode(false);
    pageRef.current = 1;
    hasMoreRef.current = true;
    setCurrentPage(1);
    setHasMore(true);
    setError(null);
    setWords([]);
    void loadWords(1, true);
  }, [wordBookId, loadWords]);

  // 列表变化后重新挂观察器（首屏加载完成后哨兵才出现）
  useEffect(() => {
    if (initialLoading || viewMode !== "list") return;
    attachObserver();
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [initialLoading, viewMode, words.length, hasMore, loading, attachObserver]);

  const handleStatusClick = useCallback((id: number, newStatus: "correct" | "wrong") => {
    setWords((prev) =>
      prev.map((word) => {
        if (word.id === id) {
          const wasSelected = word.status !== null;
          const nextStatus = word.status === newStatus ? null : newStatus;
          const isNowSelected = nextStatus !== null;

          if (!wasSelected && isNowSelected) {
            setSelectedCount((s) => s + 1);
          } else if (wasSelected && !isNowSelected) {
            setSelectedCount((s) => s - 1);
          }

          return { ...word, status: nextStatus };
        }
        return word;
      })
    );
  }, []);

  const handleWordClick = useCallback((word: WordItem) => {
    if (detailMode) {
      setDetailWord({ id: word.id, word: word.word });
      return;
    }
    const next = nextWordTapState({
      showTranslation: !!word.showTranslation,
      heard: !!word.heard,
    });
    if (next.shouldPlay && word.audioUrl) {
      abortRef.current?.();
      setPlayingId(word.id);
      const abort = playFirstWordAudio(word.audioUrl, () => setPlayingId(null));
      abortRef.current = abort;
    }
    setWords((prev) =>
      prev.map((w) => {
        if (w.id === word.id) {
          return { ...w, heard: next.heard, showTranslation: next.showTranslation };
        }
        if (next.showTranslation) {
          return { ...w, showTranslation: false };
        }
        return w;
      })
    );
  }, [detailMode]);

  /** 后端乱序：换 seed 后从第 1 页重新拉取 */
  const handleShuffle = useCallback(() => {
    if (loadingRef.current) return;
    const seed = Date.now();
    shuffleModeRef.current = true;
    shuffleSeedRef.current = seed;
    setShuffleMode(true);
    setSelectedCount(0);
    setCardIndex(0);
    pageRef.current = 1;
    hasMoreRef.current = true;
    setCurrentPage(1);
    setHasMore(true);
    setWords([]);
    void loadWords(1, true);
  }, [loadWords]);

  /** 恢复正序 */
  const handleSequential = useCallback(() => {
    if (loadingRef.current) return;
    shuffleModeRef.current = false;
    shuffleSeedRef.current = 0;
    setShuffleMode(false);
    setSelectedCount(0);
    setCardIndex(0);
    pageRef.current = 1;
    hasMoreRef.current = true;
    setCurrentPage(1);
    setHasMore(true);
    setWords([]);
    void loadWords(1, true);
  }, [loadWords]);

  const handleSelectAll = useCallback(() => {
    setWords((prev) => {
      const allSelected = prev.every((word) => word.status !== null);
      if (allSelected) {
        setSelectedCount(0);
        return prev.map((word) => ({ ...word, status: null as WordItem["status"] }));
      }
      setSelectedCount(prev.length);
      return prev.map((word) => ({ ...word, status: "wrong" as WordItem["status"] }));
    });
  }, []);

  const handleSelect5 = useCallback(() => {
    setWords((prev) => {
      const unselected = prev.filter((word) => word.status === null);
      const toSelect = unselected.slice(0, 5);
      const newWords = prev.map((word) => {
        if (toSelect.find((w) => w.id === word.id)) {
          return { ...word, status: "wrong" as WordItem["status"] };
        }
        return word;
      });
      setSelectedCount(newWords.filter((w) => w.status !== null).length);
      return newWords;
    });
  }, []);

  const handleStartLearning = async () => {
    const selectedWords = words.filter((word) => word.status !== null);
    if (selectedWords.length === 0) return;

    const knownIds = selectedWords.filter((w) => w.status === "correct").map((w) => w.id);
    const unknownIds = selectedWords.filter((w) => w.status === "wrong").map((w) => w.id);

    try {
      const res = await startStudySession({ wordBookId, knownIds, unknownIds });
      const sessionId = res.data?.sessionId;
      const sessionWords = res.data?.words;
      if (sessionId) {
        sessionStorage.setItem("lb_study_session_id", String(sessionId));
      }
      if (Array.isArray(sessionWords)) {
        sessionStorage.setItem("lb_study_words", JSON.stringify(sessionWords));
        const wordCount = sessionWords.length;
        const totalBatches = Math.max(1, Math.ceil(wordCount / 5));
        sessionStorage.setItem("lb_study_total_batches", String(totalBatches));
      } else {
        sessionStorage.removeItem("lb_study_total_batches");
      }
      sessionStorage.setItem("lb_mode", "study");
      sessionStorage.setItem("lb_study_batch_idx", "0");
      sessionStorage.removeItem("lb_study_batch_results");
      sessionStorage.removeItem("lb_study_check_phase");
      sessionStorage.removeItem("lb_study_retry_words");
      sessionStorage.removeItem("lb_study_pending_action");
      sessionStorage.removeItem("lb_study_recheck_words");
      sessionStorage.removeItem("lb_study_recheck_from");
      sessionStorage.removeItem("lb_review_session_id");
      sessionStorage.removeItem("lb_review_words");
      sessionStorage.removeItem("lb_review_batch_idx");
      navigate("/word-practice");
    } catch {
      // ignore
    }
  };

  const correctCount = useMemo(() => words.filter((word) => word.status === "correct").length, [words]);
  const wrongCount = useMemo(() => words.filter((word) => word.status === "wrong").length, [words]);

  const WordItemComponent = useMemo(() => {
    const Item = ({ word }: { word: WordItem }) => (
      <div
        className={`bg-white rounded-xl p-4 flex items-center justify-between shadow-sm transition-all ${
          word.status === "correct"
            ? "border-2 border-[#66BB6A] bg-[#66BB6A]/5"
            : word.status === "wrong"
            ? "border-2 border-[#FF6B6B] bg-[#FF6B6B]/5"
            : ""
        }`}
      >
        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => handleWordClick(word)}>
          <div>
            <span className="text-base font-medium text-[#2D3748] hover:text-[#4ECDC4] transition-colors">
              {word.word}
            </span>
            {word.showTranslation && word.translation && (
              <p className="text-[#718096] text-sm mt-1 animate-in fade-in slide-in-from-top-1">
                {word.translation}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CloudButton type="button" variant="ghost" size="iconRound" onClick={() => handlePlayAudio(word)}>
            <Volume2
              size={20}
              className={playingId === word.id ? "text-[#4ECDC4] animate-pulse" : "text-[#4ECDC4]"}
            />
          </CloudButton>
          <CloudButton
            type="button"
            variant={word.status === "correct" ? "brand" : "ghost"}
            size="iconRound"
            onClick={() => handleStatusClick(word.id, "correct")}
            className={word.status === "correct" ? "bg-[#66BB6A] hover:bg-[#66BB6A]/90" : ""}
          >
            <Check size={20} />
          </CloudButton>
          <CloudButton
            type="button"
            variant={word.status === "wrong" ? "destructive" : "ghost"}
            size="iconRound"
            onClick={() => handleStatusClick(word.id, "wrong")}
          >
            <X size={20} />
          </CloudButton>
        </div>
      </div>
    );
    return Item;
  }, [handleStatusClick, handleWordClick, handlePlayAudio, playingId]);

  return (
    <FlowPageShell>
      <TopBar
        title="训前检测"
        onBack={handleBack}
        rightSlot={
          <div className="flex items-center gap-1">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                shuffleMode ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {shuffleMode ? "乱序" : "正序"}
            </span>
            <AnnotationToggleButton
              active={annotationOpen}
              onClick={() => setAnnotationOpen((v) => !v)}
            />
          </div>
        }
      />

      <AnnotationLayer
        storageKey={`pre-training:${wordBookId}`}
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-4 pb-36">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        <WordMarkStatsBar
          correctCount={correctCount}
          wrongCount={wrongCount}
          total={words.length}
        />

        {initialLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#4ECDC4]" />
          </div>
        ) : viewMode === "card" ? (
          <WordCardPanel
            words={words}
            index={cardIndex}
            onIndexChange={(i) => {
              setCardIndex(i);
              if (hasMoreRef.current && i >= words.length - 3 && !loadingRef.current) {
                void loadWords(pageRef.current + 1, false);
              }
            }}
            playingId={playingId}
            onPlay={handlePlayAudio}
            onWordClick={handleWordClick}
            onStatus={handleStatusClick}
          />
        ) : (
          <div className="space-y-3 mb-6">
            {words.map((word) => (
              <WordItemComponent key={word.id} word={word} />
            ))}

            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#4ECDC4]" />
                ) : (
                  <button
                    type="button"
                    className="text-[#718096] text-sm hover:text-primary"
                    onClick={() => {
                      if (!loadingRef.current) void loadWords(pageRef.current + 1, false);
                    }}
                  >
                    上拉加载更多
                  </button>
                )}
              </div>
            )}

            {!hasMore && words.length > 0 && (
              <div className="text-center py-4">
                <span className="text-[#718096] text-sm">已加载全部单词</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <WordViewModeToggle mode={viewMode} onChange={setViewMode} />
            <CloudButton
              variant={detailMode ? "brand" : "outline"}
              size="pill"
              onClick={() => setDetailMode((v) => !v)}
            >
              <BookOpen size={16} />
              拓展
            </CloudButton>
          </div>
          <div className="flex gap-2">
            {shuffleMode ? (
              <CloudButton variant="outline" size="pill" onClick={handleSequential}>
                <ArrowDownAZ size={16} />
                正序
              </CloudButton>
            ) : (
              <CloudButton variant="outline" size="pill" onClick={handleShuffle}>
                <Shuffle size={16} />
                乱序
              </CloudButton>
            )}
            <CloudButton variant="outline" size="pill" onClick={handleSelectAll}>
              全选
            </CloudButton>
          </div>
        </div>
        <div className="flex gap-3">
          <CloudButton variant="brandOutline" size="pill" className="flex-1" onClick={handleSelect5}>
            选择5个
          </CloudButton>
          <CloudButton
            variant="brand"
            size="pill"
            className="flex-1"
            onClick={handleStartLearning}
            disabled={selectedCount === 0}
          >
            开始识记
          </CloudButton>
        </div>
      </div>

      <WordDetailDialog
        wordId={detailWord?.id ?? null}
        wordText={detailWord?.word}
        open={!!detailWord}
        onOpenChange={(open) => { if (!open) setDetailWord(null); }}
      />
    </FlowPageShell>
  );
}
