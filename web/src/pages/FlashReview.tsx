import { CloudButton } from "../components/cloudsteps";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
import { PracticeFontSettingsButton, PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "../components/PracticeFontSettings";
import { PracticePauseMenu } from "../components/PracticePauseMenu";
import { TopBar } from "../components/TopBar";
import { WordDetailPanel } from "../components/WordDetailPanel";
import { WordViewModeToggle, type WordViewMode } from "../components/WordMarkView";
import { Pause, Volume2, Scissors, Shuffle, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import { playFirstWordAudio, playSecondWordAudio } from "../utils/audioPlayer";
import { formatTranslation, formatTranslationShort, pickPhoneticDisplay } from "../utils/wordFormat";
import { nextWordTapState, syncDetailWordWithTap } from "../utils/wordReveal";
import {
  clearStudyRetryFlash,
  getStudyRetryWords,
  getTotalBatches,
  resolveCheckPhase,
  setStudyRecheckWords,
  shouldEnterPostTrainingCheck,
} from "../utils/studyBatchFlow";
import { getReviewReturnPath } from "../utils/reviewPractice";

const CHECK_PHASE_KEY = "lb_study_check_phase";

type FlashWord = {
  uid: string;
  id: number;
  word: string;
  phonetic: string;
  translation: string;
  translationShort: string;
  audioUrl?: string;
  scissorCount: number;
  showTranslation: boolean;
  heard: boolean;
};

function newUid(id: number): string {
  return `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapToFlashWord(w: Record<string, unknown>): FlashWord {
  const id = Number(w.id);
  const rawTranslation = w.translation as string;
  return {
    uid: newUid(id),
    id,
    word: String(w.word || ""),
    phonetic: pickPhoneticDisplay(w as { phonetic?: string; phoneticUk?: string; phoneticUs?: string }),
    translation: formatTranslation(rawTranslation),
    translationShort: formatTranslationShort(rawTranslation),
    audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
    scissorCount: 0,
    showTranslation: false,
    heard: false,
  };
}

export default function FlashReview() {
  const navigate = useNavigate();
  const [words, setWords] = useState<FlashWord[]>([]);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [viewMode, setViewMode] = useState<WordViewMode>("list");
  const [cardIndex, setCardIndex] = useState(0);
  const [detailMode, setDetailMode] = useState(false);
  const [detailWord, setDetailWord] = useState<{ id: number; word: string } | null>(null);
  /** false=简译（默认），true=全部意思；与单词练习/听音辨义一致 */
  const [fullMeaning, setFullMeaning] = useState(false);

  const mode = useMemo(() => sessionStorage.getItem("lb_mode") || "study", []);

  const batchIdx = useMemo(() => {
    const key = mode === "review" ? "lb_review_batch_idx" : "lb_study_batch_idx";
    return Number(sessionStorage.getItem(key) || 0);
  }, [mode]);

  const isRetryMode = useMemo(() => getStudyRetryWords() !== null, []);

  const handleBack = () => {
    if (isRetryMode) {
      clearStudyRetryFlash();
      navigate("/post-training-check", { replace: true });
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate(mode === "review" ? getReviewReturnPath("/word-training") : "/word-practice");
  };

  useEffect(() => {
    try {
      const retryList = getStudyRetryWords();
      if (retryList) {
        setWords(retryList.map((w) => mapToFlashWord(w as Record<string, unknown>)));
        return;
      }
      const wordsKey = mode === "review" ? "lb_review_words" : "lb_study_words";
      const raw = sessionStorage.getItem(wordsKey) || "[]";
      const arr = JSON.parse(raw);
      const all: unknown[] = Array.isArray(arr) ? arr : [];
      const start = batchIdx * 5;
      const slice = all.slice(start, start + 5);
      setWords(slice.map((w) => mapToFlashWord(w as Record<string, unknown>)));
    } catch {
      // ignore
    }
  }, [batchIdx, mode, isRetryMode]);

  const [playingId, setPlayingId] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const handleScissorClick = (word: FlashWord, action: "red" | "green") => {
    setWords((prev) =>
      prev.map((w) => {
        if (w.uid !== word.uid) return w;
        // 红/绿都会剪掉：红=不熟(1)，绿=掌握(2)
        return { ...w, scissorCount: action === "red" ? 1 : 2 };
      })
    );
  };

  const handlePlayAudio = (word: FlashWord) => {
    if (!word.audioUrl) return;
    abortRef.current?.();
    setPlayingId(word.id);
    // 快闪喇叭固定播第 2 段（单词三遍）；按分号槽位取，避免空段压缩后误播第 3 段
    const abort = playSecondWordAudio(word.audioUrl, () => setPlayingId(null));
    abortRef.current = abort;
  };

  const handleShuffle = () => {
    setWords((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCardIndex(0);
  };

  const handleWordTap = (word: FlashWord) => {
    const next = nextWordTapState({
      showTranslation: word.showTranslation,
      heard: word.heard,
    });
    if (next.shouldPlay && word.audioUrl) {
      abortRef.current?.();
      setPlayingId(word.id);
      const abort = playFirstWordAudio(word.audioUrl, () => setPlayingId(null));
      abortRef.current = abort;
    }
    setWords((prev) =>
      prev.map((w) => {
        if (w.uid === word.uid) {
          return { ...w, heard: next.heard, showTranslation: next.showTranslation };
        }
        if (next.showTranslation) {
          return { ...w, showTranslation: false };
        }
        return w;
      })
    );
    setDetailWord(syncDetailWordWithTap(detailMode, next, { id: word.id, word: word.word }));
  };

  const allCut = words.length > 0 && words.every((word) => word.scissorCount > 0);

  const [round, setRound] = useState(0);

  // 当所有词都剪完后，如果有红剪词（不熟），重新出现再来一轮
  useEffect(() => {
    if (!allCut || showCompleteDialog) return;
    const redWords = words.filter((w) => w.scissorCount === 1);
    if (redWords.length > 0) {
      // 有红剪词，重置它们再来一轮
      const timer = setTimeout(() => {
        setWords((prev) =>
          prev.map((w) =>
            w.scissorCount === 1 ? { ...w, scissorCount: 0, showTranslation: false, heard: false } : w
          )
        );
        setRound((r) => r + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
    // 没有红剪词，全部掌握，显示完成
    handleComplete();
  }, [allCut, showCompleteDialog, words]);

  const continueAfterRetry = () => {
    const retried = getStudyRetryWords();
    clearStudyRetryFlash();
    if (retried) {
      setStudyRecheckWords(retried);
    }
    navigate("/post-training-check", { replace: true });
  };

  const proceedAfterFlash = () => {
    if (isRetryMode) {
      continueAfterRetry();
      return;
    }
    if (mode === "review") {
      try {
        const raw = sessionStorage.getItem("lb_review_words") || "[]";
        const all = JSON.parse(raw);
        const total = Array.isArray(all) ? all.length : 0;
        const reviewBatches = Math.max(1, Math.ceil(total / 5));
        if (batchIdx + 1 < reviewBatches) {
          sessionStorage.setItem("lb_review_batch_idx", String(batchIdx + 1));
          navigate("/word-practice", { replace: true });
          return;
        }
      } catch {
        // fall through
      }
      navigate("/post-training-check");
      return;
    }
    try {
      const raw = sessionStorage.getItem("lb_study_words") || "[]";
      const all = JSON.parse(raw);
      const total = Array.isArray(all) ? all.length : 0;
      const totalBatches =
        Number(sessionStorage.getItem("lb_study_total_batches") || 0) || getTotalBatches(total);

      if (!shouldEnterPostTrainingCheck(batchIdx, totalBatches)) {
        const nextIdx = batchIdx + 1;
        if (nextIdx >= totalBatches) {
          sessionStorage.setItem(CHECK_PHASE_KEY, "final");
          navigate("/post-training-check", { replace: true });
          return;
        }
        sessionStorage.setItem("lb_study_batch_idx", String(nextIdx));
        navigate("/word-practice", { replace: true });
        return;
      }
      sessionStorage.setItem(CHECK_PHASE_KEY, resolveCheckPhase(batchIdx, totalBatches));
      navigate("/post-training-check");
    } catch {
      navigate("/post-training-check");
    }
  };

  const handleComplete = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    setShowCompleteDialog(true);
  };

  const headerTitle = isRetryMode
    ? "错词快闪重练"
    : `第 ${batchIdx + 1} 组快闪`;

  const proceedLabel = isRetryMode
    ? "完成重练"
    : mode === "study" &&
        !shouldEnterPostTrainingCheck(
          batchIdx,
          Number(sessionStorage.getItem("lb_study_total_batches") || 1)
        )
      ? "继续下一组"
      : "进入组内复习";

  const uncutCount = words.filter((w) => w.scissorCount === 0).length;
  const visibleWords = words.filter((w) => w.scissorCount === 0);

  const meaningText = (word: FlashWord) =>
    fullMeaning ? word.translation || word.translationShort : word.translationShort || word.translation;

  const renderMeaning = (word: FlashWord, opts?: { centered?: boolean }) => {
    if (!word.showTranslation) return null;
    const meaning = meaningText(word);
    return (
      <div className={`animate-in fade-in slide-in-from-top-1 ${opts?.centered ? "text-center mt-2" : ""}`}>
        {word.phonetic ? (
          <div className={`text-sm text-[#718096] font-mono ${opts?.centered ? "mb-0.5" : "mb-0.5"}`}>
            {word.phonetic}
          </div>
        ) : null}
        {meaning ? <div className={PRACTICE_TRANS_CLASS}>{meaning}</div> : null}
        {(word.translation || word.translationShort) && (
          <button
            type="button"
            className="text-xs text-[#4ECDC4] hover:underline mt-1"
            onClick={(e) => {
              e.stopPropagation();
              setFullMeaning((v) => !v);
            }}
          >
            {fullMeaning ? "简译" : "全部意思"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <TopBar
        title={headerTitle}
        onBack={handleBack}
        rightSlot={
          <div className="flex items-center gap-0.5">
            <AnnotationToggleButton
              active={annotationOpen}
              onClick={() => setAnnotationOpen((v) => !v)}
            />
            <PracticeFontSettingsButton />
            <CloudButton
              type="button"
              variant="ghost"
              size="iconRound"
              onClick={() => setShowPauseMenu((v) => !v)}
            >
              <Pause size={18} className="text-[#2D3748]" />
            </CloudButton>
          </div>
        }
      />

      <AnnotationLayer
        storageKey="flash-review"
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-6 max-w-2xl mx-auto w-full pb-28">
        <p className="text-center text-sm text-[#718096] mb-6">
          {isRetryMode
            ? "点红剪刀表示不熟（会重新排队），点绿剪刀表示掌握"
            : `${uncutCount} 个待剪${round > 0 ? ` · 第 ${round + 1} 轮` : ""}`}
        </p>

        {viewMode === "card" && visibleWords.length > 0 ? (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="flex items-center gap-3 w-full">
              <CloudButton
                type="button"
                variant="ghost"
                size="iconRound"
                disabled={cardIndex <= 0}
                onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
                className="shrink-0 bg-muted disabled:opacity-40"
              >
                <ChevronLeft size={22} />
              </CloudButton>
              <div
                className="flex-1 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm px-5 py-8 flex flex-col items-center justify-center cursor-pointer transition-colors"
                style={{ minHeight: "max(8rem, calc(var(--practice-word-size) * 6))" }}
                onClick={() => handleWordTap(visibleWords[cardIndex])}
              >
                <p className="text-xs text-[#718096] mb-4">
                  {cardIndex + 1} / {visibleWords.length}
                </p>
                <div className={`${PRACTICE_WORD_CLASS} text-center break-all`}>
                  {visibleWords[cardIndex].word}
                </div>
                {renderMeaning(visibleWords[cardIndex], { centered: true })}
              </div>
              <CloudButton
                type="button"
                variant="ghost"
                size="iconRound"
                disabled={cardIndex >= visibleWords.length - 1}
                onClick={() => setCardIndex((i) => Math.min(visibleWords.length - 1, i + 1))}
                className="shrink-0 bg-muted disabled:opacity-40"
              >
                <ChevronRight size={22} />
              </CloudButton>
            </div>
            <div className="flex items-center gap-3">
              <CloudButton
                type="button"
                variant="ghost"
                size="iconRound"
                onClick={() => handlePlayAudio(visibleWords[cardIndex])}
              >
                <Volume2
                  size={20}
                  className={playingId === visibleWords[cardIndex].id ? "text-[#4ECDC4] animate-pulse" : "text-[#4ECDC4]"}
                />
              </CloudButton>
              <CloudButton
                type="button"
                variant="ghost"
                size="iconRound"
                onClick={() => handleScissorClick(visibleWords[cardIndex], "red")}
                title="红剪：不熟，重新排队"
              >
                <Scissors size={20} className="text-[#FF6B6B]" />
              </CloudButton>
              <CloudButton
                type="button"
                variant="ghost"
                size="iconRound"
                onClick={() => handleScissorClick(visibleWords[cardIndex], "green")}
                title="绿剪：掌握"
              >
                <Scissors size={20} className="text-[#66BB6A]" />
              </CloudButton>
            </div>
            {detailMode && visibleWords[cardIndex]?.showTranslation && (
              <div className="w-full">
                <WordDetailPanel
                  wordId={visibleWords[cardIndex].id}
                  wordText={visibleWords[cardIndex].word}
                  variant="inline"
                  onClose={() => setDetailWord(null)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {visibleWords.map((word) => (
              <div
                key={word.uid}
                className="bg-white rounded-xl p-4 shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer pr-3"
                    onClick={() => handleWordTap(word)}
                  >
                    <div>
                      <div className={`${PRACTICE_WORD_CLASS} mb-1 hover:text-[#4ECDC4] transition-colors`}>
                        {word.word}
                      </div>
                      {renderMeaning(word)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CloudButton
                      type="button"
                      variant="ghost"
                      size="iconRound"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAudio(word);
                      }}
                    >
                      <Volume2
                        size={20}
                        className={
                          playingId === word.id ? "text-[#4ECDC4] animate-pulse" : "text-[#4ECDC4]"
                        }
                      />
                    </CloudButton>
                    <CloudButton
                      type="button"
                      variant="ghost"
                      size="iconRound"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScissorClick(word, "red");
                      }}
                      title="红剪：不熟，重新排队"
                    >
                      <Scissors size={20} className="text-[#FF6B6B]" />
                    </CloudButton>
                    <CloudButton
                      type="button"
                      variant="ghost"
                      size="iconRound"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScissorClick(word, "green");
                      }}
                      title="绿剪：掌握"
                    >
                      <Scissors size={20} className="text-[#66BB6A]" />
                    </CloudButton>
                  </div>
                </div>
                {detailMode && word.showTranslation && (
                  <div className="mt-3 pt-3 border-t border-[#E2E8F0]" onClick={(e) => e.stopPropagation()}>
                    <WordDetailPanel
                      wordId={word.id}
                      wordText={word.word}
                      variant="inline"
                      onClose={() => setDetailWord(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-2">
          <div className="flex gap-2 flex-wrap">
            <WordViewModeToggle mode={viewMode} onChange={setViewMode} />
            <CloudButton variant="outline" size="pill" onClick={handleShuffle}>
              <Shuffle size={16} />
              乱序
            </CloudButton>
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
          </div>
        </div>
      </div>

      <PracticePauseMenu
        open={showPauseMenu}
        onClose={() => setShowPauseMenu(false)}
      />

      {showCompleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-auto">
            <h3 className="text-3xl font-bold text-center text-[#4ECDC4] mb-2">PERFECT</h3>
            <p className="text-center text-[#718096] mb-6">
              {isRetryMode ? "错词重练完成！" : "恭喜完成本组快闪！"}
            </p>
            <div className="flex gap-3">
              {!isRetryMode && (
                <CloudButton
                  type="button"
                  variant="outline"
                  size="pill"
                  className="flex-1"
                  onClick={() => navigate("/word-practice")}
                >
                  返回练习
                </CloudButton>
              )}
              <CloudButton
                type="button"
                variant="brand"
                size="pill"
                className="flex-1"
                onClick={proceedAfterFlash}
              >
                {proceedLabel}
              </CloudButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
