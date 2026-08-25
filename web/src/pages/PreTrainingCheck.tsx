import { Volume2, Check, X, Shuffle, Loader2, ArrowDownAZ, BookOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";

import { getStudyWords, startStudySession } from "../api/study";
import { AnnotationLayer } from "../components/AnnotationLayer";
import { StudentWordMarkButton, useStudentWordMarks } from "../components/StudentWordMarkButton";
import { PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "../components/PracticeFontSettings";
import { PracticeFlowToolbar } from "../components/PracticeFlowToolbar";
import { CloudButton } from "../components/cloudsteps";
import { TopBar } from "../components/TopBar";
import { FlowPageShell } from "../components/PageTransition";
import {
  WordCardPanel,
  WordMarkStatsBar,
  WordViewModeToggle,
  isWordCardTapped,
  markWordCardClass,
  markWordCardStyle,
  type WordViewMode,
} from "../components/WordMarkView";
import { WordDetailPanel } from "../components/WordDetailPanel";
import { StudyNoteLauncher } from "../components/StudyNotePanel";
import { playFirstWordAudio, playWordAudio } from "../utils/audioPlayer";
import { formatTranslation, pickPhoneticDisplay } from "../utils/wordFormat";
import { nextWordTapState, syncDetailWordWithTap } from "../utils/wordReveal";

type WordItem = {
  id: number;
  word: string;
  phonetic?: string;
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
  /** 拓展简易模式：默认开，只展示部分标签 */
  const [simpleDetail, setSimpleDetail] = useState(true);
  const [detailWord, setDetailWord] = useState<{ id: number; word: string } | null>(null);
  const wordMarks = useStudentWordMarks(words.map((word) => word.id));

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
          ? (list as Array<{
              id: number;
              word: string;
              translation?: string;
              audioUrl?: string;
              phonetic?: string;
              phoneticUk?: string;
              phoneticUs?: string;
            }>)
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
          phonetic: pickPhoneticDisplay(w),
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
    const currentWord = words[cardIndex];
    const isSelectingCurrentCard = viewMode === "card" && currentWord?.id === id;

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

    // 卡片模式标记后自动定位下一张，边框始终提示下一次点击目标。
    if (isSelectingCurrentCard && currentWord.status !== newStatus) {
      setCardIndex((index) => Math.min(index + 1, Math.max(0, words.length - 1)));
    }
  }, [cardIndex, viewMode, words]);

  const handleWordClick = useCallback((word: WordItem) => {
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
        return { ...w, heard: false, showTranslation: false };
      })
    );
    // 拓展只增幅：释义出现时挂详情，收起时关掉
    setDetailWord(syncDetailWordWithTap(detailMode, next, word));
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

  const [starting, setStarting] = useState(false);

  const handleStartLearning = async () => {
    const selectedWords = words.filter((word) => word.status !== null);
    if (selectedWords.length === 0 || starting) return;

    const knownIds = selectedWords.filter((w) => w.status === "correct").map((w) => w.id);
    const unknownIds = selectedWords.filter((w) => w.status === "wrong").map((w) => w.id);

    setStarting(true);
    try {
      const res = await startStudySession({ wordBookId, knownIds, unknownIds });
      const sessionId = res.data?.sessionId;
      const sessionWords = res.data?.words;
      if (res.data?.finished || !Array.isArray(sessionWords) || sessionWords.length === 0) {
        setError("当前没有待练习单词，请返回词库重新选择需要识记的单词");
        setStarting(false);
        return;
      }
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
      setStarting(false);
    }
  };

  const correctCount = useMemo(() => words.filter((word) => word.status === "correct").length, [words]);
  const wrongCount = useMemo(() => words.filter((word) => word.status === "wrong").length, [words]);

  const renderWordItem = (word: WordItem) => (
    <div
      className={`rounded-xl p-3.5 sm:p-4 shadow-sm transition-all cursor-pointer ${markWordCardClass(
        word.status,
        isWordCardTapped(word, playingId, word.id)
      )}`}
      style={markWordCardStyle(word.status, isWordCardTapped(word, playingId, word.id))}
      onClick={() => handleWordClick(word)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="min-w-0">
            <span className={`${PRACTICE_WORD_CLASS} transition-colors`}>
              {word.word}
            </span>
            {word.showTranslation && (
              <div className="mt-0.5 animate-in fade-in slide-in-from-top-1">
                {word.phonetic ? (
                  <span className="block text-sm text-[#718096] font-mono">{word.phonetic}</span>
                ) : null}
                {word.translation ? (
                  <span className={`${PRACTICE_TRANS_CLASS} block`}>{word.translation}</span>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <StudentWordMarkButton
            wordId={word.id}
            wordBookId={wordBookId}
            marked={wordMarks.isMarked(word.id)}
            enabled={wordMarks.enabled}
            busy={wordMarks.busyId === word.id}
            onToggle={wordMarks.toggle}
            className="size-9"
          />
          <div onClick={(e) => e.stopPropagation()}>
            <StudyNoteLauncher
              storageKey={`study-note:word:${wordBookId}:${word.id}`}
              title={`笔记 · ${word.word}`}
              label="笔记"
              className="h-9 px-2"
            />
          </div>
          <CloudButton
            type="button"
            variant="ghost"
            size="iconRound"
            onClick={(e) => {
              e.stopPropagation();
              handlePlayAudio(word);
              setWords((prev) =>
                prev.map((w) =>
                  w.id === word.id
                    ? { ...w, heard: true }
                    : { ...w, heard: false, showTranslation: false }
                )
              );
            }}
          >
            <Volume2
              size={20}
              className={playingId === word.id ? "text-[#4ECDC4] animate-pulse" : "text-[#4ECDC4]"}
            />
          </CloudButton>
          <CloudButton
            type="button"
            variant={word.status === "correct" ? "mint" : "ghost"}
            size="iconRound"
            onClick={(e) => {
              e.stopPropagation();
              handleStatusClick(word.id, "correct");
            }}
          >
            <Check size={20} />
          </CloudButton>
          <CloudButton
            type="button"
            variant={word.status === "wrong" ? "destructive" : "ghost"}
            size="iconRound"
            onClick={(e) => {
              e.stopPropagation();
              handleStatusClick(word.id, "wrong");
            }}
          >
            <X size={20} />
          </CloudButton>
        </div>
      </div>
      {detailMode && word.showTranslation && (
        <WordDetailPanel
          wordId={word.id}
          wordText={word.word}
          variant="inline"
          simpleMode={simpleDetail}
          onClose={() => setDetailWord(null)}
        />
      )}
    </div>
  );

  return (
    <FlowPageShell>
      <TopBar
        title="训前检测"
        onBack={handleBack}
        rightSlot={
          <PracticeFlowToolbar
            annotationOpen={annotationOpen}
            onToggleAnnotation={() => setAnnotationOpen((v) => !v)}
            wordCount={selectedCount}
            extraBefore={
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                  shuffleMode ? "bg-[#4ECDC4]/15 text-[#4ECDC4]" : "bg-muted text-muted-foreground"
                }`}
              >
                {shuffleMode ? "乱序" : "正序"}
              </span>
            }
          />
        }
      />

      <AnnotationLayer
        storageKey={`pre-training:${wordBookId}`}
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-4 pb-36 max-w-2xl lg:max-w-5xl mx-auto w-full">
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
            amplifyDetail={detailMode}
            onDetailClose={() => setDetailWord(null)}
            simpleMode={simpleDetail}
            noteStorageKey={(word) => `study-note:word:${wordBookId}:${word.id}`}
          />
        ) : (
          <div className="space-y-2.5 mb-6">
            {words.map((word) => (
              <div key={word.id}>{renderWordItem(word)}</div>
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

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E2E8F0] px-4 py-3 shadow-lg">
        <div className="max-w-2xl lg:max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StudyNoteLauncher
              storageKey={`study-note:global:${wordBookId}`}
              label="随心记"
            />
            <WordViewModeToggle mode={viewMode} onChange={setViewMode} />
            <CloudButton
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
            {detailMode && (
              <CloudButton
                variant={simpleDetail ? "brand" : "outline"}
                size="pill"
                onClick={() => setSimpleDetail((v) => !v)}
                title={simpleDetail ? "当前简易：点击查看全部拓展" : "当前全部：点击切回简易"}
              >
                简易
              </CloudButton>
            )}
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
            loading={starting}
            loadingText="启动中…"
          >
            开始识记
          </CloudButton>
        </div>
        </div>
      </div>

    </FlowPageShell>
  );
}
