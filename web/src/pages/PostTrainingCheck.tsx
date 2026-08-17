import { Volume2, Check, X, BookOpen, Shuffle, Pause } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
import { PracticeFontSettingsButton, PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "../components/PracticeFontSettings";
import { PracticePauseMenu } from "../components/PracticePauseMenu";
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
import { completeStudySession } from "../api/study";
import { completeReviewSession } from "../api/review";
import { playFirstWordAudio, playWordAudio } from "../utils/audioPlayer";
import { formatTranslation, pickPhoneticDisplay } from "../utils/wordFormat";
import { nextWordTapState, syncDetailWordWithTap } from "../utils/wordReveal";
import {
  clearStudyRecheck,
  getCheckPhaseLabel,
  getMilestoneCheckBatchRange,
  getStudyPendingAction,
  getStudyRecheckFrom,
  getStudyRecheckWords,
  getTotalBatches,
  needsFinalCheckAfterMilestone,
  setStudyRetryWords,
  sliceWordsByBatches,
  STUDY_RECHECK_WORDS_KEY,
  type StudyCheckPhase,
} from "../utils/studyBatchFlow";
import { clearReviewPracticeSession, getReviewReturnPath } from "../utils/reviewPractice";

type CheckWord = {
  id: number;
  word: string;
  phonetic?: string;
  translation?: string;
  audioUrl?: string;
  status: null | "correct" | "wrong";
  showTranslation?: boolean;
  heard?: boolean;
};

const CHECK_PHASE_KEY = "lb_study_check_phase";

function getStudyBatchMeta(batchIdx: number) {
  let totalBatches = 1;
  try {
    const raw = sessionStorage.getItem("lb_study_words") || "[]";
    const arr = JSON.parse(raw);
    const total = Array.isArray(arr) ? arr.length : 0;
    totalBatches = getTotalBatches(total);
    sessionStorage.setItem("lb_study_total_batches", String(totalBatches));
  } catch {
    totalBatches = Math.max(1, Number(sessionStorage.getItem("lb_study_total_batches") || 1));
  }
  const safeBatchIdx = Math.min(Math.max(0, batchIdx), totalBatches - 1);
  if (safeBatchIdx !== batchIdx) {
    sessionStorage.setItem("lb_study_batch_idx", String(safeBatchIdx));
  }
  const currentBatch = safeBatchIdx + 1;
  const hasMoreBatches = currentBatch < totalBatches;
  return {
    totalBatches,
    batchIdx: safeBatchIdx,
    currentBatch,
    hasMoreBatches,
    isLastBatch: !hasMoreBatches,
  };
}

export default function PostTrainingCheck() {
  const navigate = useNavigate();
  const [words, setWords] = useState<CheckWord[]>([]);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [viewMode, setViewMode] = useState<WordViewMode>("list");
  const [cardIndex, setCardIndex] = useState(0);
  const [detailMode, setDetailMode] = useState(false);
  const [detailWord, setDetailWord] = useState<{ id: number; word: string } | null>(null);

  const mode = useMemo(() => sessionStorage.getItem("lb_mode") || "study", []);

  const batchIdx = useMemo(() => {
    const key = mode === "review" ? "lb_review_batch_idx" : "lb_study_batch_idx";
    return Number(sessionStorage.getItem(key) || 0);
  }, [mode]);

  const readCheckPhase = (): StudyCheckPhase => {
    if (mode === "review") return "milestone";
    const p = sessionStorage.getItem(CHECK_PHASE_KEY);
    return p === "final" ? "final" : "milestone";
  };

  const [checkPhase, setCheckPhase] = useState<StudyCheckPhase>(readCheckPhase);

  const sessionId = useMemo(() => {
    const key = mode === "review" ? "lb_review_session_id" : "lb_study_session_id";
    return Number(sessionStorage.getItem(key) || 0);
  }, [mode]);

  const [submitting, setSubmitting] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const batchInfo = useMemo(() => {
    if (mode === "review") {
      return {
        totalBatches: 1,
        batchIdx: 0,
        hasMoreBatches: false,
        isLastBatch: true,
        currentBatch: 1,
      };
    }
    return getStudyBatchMeta(batchIdx);
  }, [batchIdx, mode]);

  const effectiveBatchIdx = mode === "review" ? batchIdx : batchInfo.batchIdx;
  const isRecheckMode = getStudyRecheckWords() !== null;

  const phaseLabels = useMemo(() => {
    if (isRecheckMode) {
      const n = getStudyRecheckWords()?.length ?? 0;
      return {
        title: "错词复检",
        hint: `共 ${n} 个词 · 请再次确认掌握情况`,
      };
    }
    return getCheckPhaseLabel(checkPhase, effectiveBatchIdx, batchInfo.totalBatches);
  }, [checkPhase, effectiveBatchIdx, batchInfo.totalBatches, isRecheckMode]);

  const handlePlayAudio = (word: CheckWord) => {
    if (!word.audioUrl) return;
    abortRef.current?.();
    setPlayingId(word.id);
    const abort = playWordAudio(word.audioUrl, 300, () => setPlayingId(null));
    abortRef.current = abort;
  };

  const handleBack = () => {
    if (mode === "review") {
      navigate(getReviewReturnPath("/word-training"));
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/flash-review");
  };

  useEffect(() => {
    try {
      const recheckList = mode === "study" ? getStudyRecheckWords() : null;
      let slice: any[];
      if (recheckList) {
        slice = recheckList;
      } else {
        const wordsKey = mode === "review" ? "lb_review_words" : "lb_study_words";
        const raw = sessionStorage.getItem(wordsKey) || "[]";
        const parsed = JSON.parse(raw);
        const all: any[] = Array.isArray(parsed) ? parsed : [];
        if (mode === "review") {
          slice = all;
        } else if (checkPhase === "final") {
          slice = all;
        } else {
          const { startBatch, endBatch } = getMilestoneCheckBatchRange(
            effectiveBatchIdx,
            batchInfo.totalBatches
          );
          slice = sliceWordsByBatches(all, startBatch, endBatch);
        }
      }
      const mapped: CheckWord[] = slice.map((w: any) => ({
        id: Number(w.id),
        word: String(w.word || ""),
        phonetic: pickPhoneticDisplay(w),
        translation: w.translation ? formatTranslation(String(w.translation)) : undefined,
        audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
        status: null,
        showTranslation: false,
        heard: false,
      }));
      setWords(mapped);
    } catch {
      // ignore
    }
  }, [effectiveBatchIdx, batchInfo.totalBatches, mode, checkPhase, isRecheckMode]);

  const handleStatusClick = (id: number, newStatus: "correct" | "wrong") => {
    setWords((prev) =>
      prev.map((word) => {
        if (word.id !== id) return word;
        // 已选状态再次点击同一按钮：保持选中，避免误触取消导致无法提交
        if (word.status === newStatus) return word;
        return { ...word, status: newStatus };
      })
    );
  };

  const handleWordClick = (word: CheckWord) => {
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
    setDetailWord(syncDetailWordWithTap(detailMode, next, word));
  };

  const handleShuffle = () => {
    setWords((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCardIndex(0);
  };

  const appendMilestoneResults = (results: { wordId: number; remembered: boolean }[]) => {
    try {
      const raw = sessionStorage.getItem("lb_study_batch_results") || "[]";
      const prev = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
      const byId = new Map<number, { wordId: number; remembered: boolean }>();
      for (const r of prev) byId.set(r.wordId, r);
      for (const r of results) byId.set(r.wordId, r);
      sessionStorage.setItem("lb_study_batch_results", JSON.stringify([...byId.values()]));
    } catch {
      sessionStorage.setItem("lb_study_batch_results", JSON.stringify(results));
    }
  };

  const goToFinalCheck = () => {
    sessionStorage.setItem(CHECK_PHASE_KEY, "final");
    setCheckPhase("final");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNextBatch = () => {
    const nextIdx = effectiveBatchIdx + 1;
    if (nextIdx >= batchInfo.totalBatches) {
      goToFinalCheck();
      return;
    }
    sessionStorage.setItem("lb_study_batch_idx", String(nextIdx));
    navigate("/word-practice", { replace: true });
  };

  const finishTrainingAndCreateReview = () => {
    sessionStorage.removeItem("lb_study_batch_idx");
    sessionStorage.removeItem("lb_study_batch_results");
    sessionStorage.removeItem("lb_study_total_batches");
    sessionStorage.removeItem(CHECK_PHASE_KEY);
    clearStudyRecheck();
    // 学完所有组后返回选单词界面，而非直接跳创建抗遗忘
    // 用户可能还有上课时间，可以继续选词学习
    navigate("/pre-training-check", { replace: true });
  };

  const wrongWords = useMemo(() => words.filter((w) => w.status === "wrong"), [words]);
  const allMarked = useMemo(() => words.length > 0 && words.every((w) => w.status !== null), [words]);
  const unmarkedCount = useMemo(() => words.filter((w) => w.status === null).length, [words]);

  const submitLabel = useMemo(() => {
    if (mode === "review") return "完成复习";
    if (wrongWords.length > 0) return `重练 ${wrongWords.length} 个错词`;
    if (isRecheckMode) {
      const pending = getStudyPendingAction();
      if (pending === "final_check" && getStudyRecheckFrom() === "milestone") {
        return "提交并进入训后检测";
      }
      if (pending === "next_batch") return "提交并继续下一组";
      if (checkPhase === "final") return "提交并完成训练";
      return "提交并继续";
    }
    if (checkPhase === "final") return "提交并完成训练";
    if (needsFinalCheckAfterMilestone(effectiveBatchIdx, batchInfo.totalBatches)) {
      return "提交并进入训后检测";
    }
    return "提交并继续下一组";
  }, [mode, checkPhase, effectiveBatchIdx, batchInfo.totalBatches, wrongWords.length, isRecheckMode]);

  const sendWrongWordsToFlashRetry = (pending: "next_batch" | "final_check") => {
    try {
      const raw = sessionStorage.getItem("lb_study_words") || "[]";
      const all: unknown[] = JSON.parse(raw);
      const list = Array.isArray(all) ? all : [];
      const wrongIds = new Set(wrongWords.map((w) => Number(w.id)));
      const retryPayload = list.filter((w) => {
        const id = typeof w === "object" && w && "id" in w ? Number((w as { id?: number | string }).id) : NaN;
        return wrongIds.has(id);
      });
      if (retryPayload.length === 0) {
        console.error("错词重练列表为空，请检查单词 ID", wrongWords);
        alert("错词数据异常，无法进入重练");
        return;
      }
      const from = checkPhase === "final" || isRecheckMode && getStudyRecheckFrom() === "final"
        ? "final"
        : "milestone";
      sessionStorage.removeItem(STUDY_RECHECK_WORDS_KEY);
      setStudyRetryWords(retryPayload, pending, from);
      navigate("/flash-review", { replace: true });
    } catch {
      navigate("/flash-review", { replace: true });
    }
  };

  const finishRecheckAndContinue = () => {
    const pending = getStudyPendingAction();
    const from = getStudyRecheckFrom();
    clearStudyRecheck();
    const shouldFinal =
      pending === "final_check" ||
      needsFinalCheckAfterMilestone(effectiveBatchIdx, batchInfo.totalBatches);
    if (shouldFinal && from !== "final") {
      goToFinalCheck();
      return;
    }
    if (pending === "next_batch" && !shouldFinal) {
      goNextBatch();
      return;
    }
    if (shouldFinal && from === "final") {
      finishTrainingAndCreateReview();
      return;
    }
    goToFinalCheck();
  };

  const handleSubmit = () => {
    if (!allMarked) return;

    const results = words.map((w) => ({
      wordId: w.id,
      remembered: w.status === "correct",
    }));

    (async () => {
      setSubmitting(true);
      try {
        if (mode === "review") {
          const res = await completeReviewSession(sessionId, results);
          if (res.code !== 200) {
            throw new Error(res.msg || "提交失败");
          }
          const returnPath = getReviewReturnPath("/word-training");
          clearReviewPracticeSession();
          navigate(returnPath, { replace: true });
          return;
        }

        if (wrongWords.length > 0) {
          appendMilestoneResults(results);
          if (isRecheckMode) {
            const pending = getStudyPendingAction() ?? "next_batch";
            sendWrongWordsToFlashRetry(pending);
            return;
          }
          if (checkPhase === "final") {
            sendWrongWordsToFlashRetry("final_check");
            return;
          }
          const pending = needsFinalCheckAfterMilestone(effectiveBatchIdx, batchInfo.totalBatches)
            ? "final_check"
            : "next_batch";
          sendWrongWordsToFlashRetry(pending);
          return;
        }

        if (isRecheckMode) {
          appendMilestoneResults(results);
          if (sessionId && getStudyRecheckFrom() === "final") {
            try {
              const raw = sessionStorage.getItem("lb_study_batch_results") || "[]";
              const allResults = JSON.parse(raw);
              await completeStudySession(
                sessionId,
                Array.isArray(allResults) ? allResults : results
              );
            } catch {
              await completeStudySession(sessionId, results);
            }
          }
          finishRecheckAndContinue();
          return;
        }

        if (checkPhase === "milestone") {
          appendMilestoneResults(results);
          if (needsFinalCheckAfterMilestone(effectiveBatchIdx, batchInfo.totalBatches)) {
            goToFinalCheck();
            return;
          }
          goNextBatch();
          return;
        }

        if (sessionId) {
          await completeStudySession(sessionId, results);
        }
        finishTrainingAndCreateReview();
      } catch {
        if (checkPhase === "final" && wrongWords.length === 0) {
          finishTrainingAndCreateReview();
        }
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const correctCount = words.filter((word) => word.status === "correct").length;
  const wrongCount = words.filter((word) => word.status === "wrong").length;

  return (
    <FlowPageShell>
      <TopBar
        title={mode === "review" ? "开始复习" : phaseLabels.title}
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
        storageKey={`post-check:${mode}:${checkPhase}:${batchIdx}`}
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-4 pb-36 max-w-2xl mx-auto w-full">
        {mode === "study" && phaseLabels.hint && (
          <p className="text-center text-sm text-[#718096] mb-4">{phaseLabels.hint}</p>
        )}
        <WordMarkStatsBar
          correctCount={correctCount}
          wrongCount={wrongCount}
          total={words.length}
        />
        {viewMode === "card" ? (
          <WordCardPanel
            words={words}
            index={cardIndex}
            onIndexChange={setCardIndex}
            playingId={playingId}
            onPlay={handlePlayAudio}
            onWordClick={handleWordClick}
            onStatus={handleStatusClick}
            amplifyDetail={detailMode}
            onDetailClose={() => setDetailWord(null)}
          />
        ) : (
          <div className="space-y-3 mb-6">
            {words.map((word) => (
              <div
                key={word.id}
                className={`bg-white rounded-xl p-4 shadow-sm transition-all ${
                  word.status === "correct"
                    ? "border-2 border-[#66BB6A] bg-[#66BB6A]/5"
                    : word.status === "wrong"
                    ? "border-2 border-[#FF6B6B] bg-[#FF6B6B]/5"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => handleWordClick(word)}
                >
                  <div>
                    <span className={`${PRACTICE_WORD_CLASS} hover:text-[#4ECDC4] transition-colors`}>
                      {word.word}
                    </span>
                    {word.showTranslation && (
                      <div className="mt-1 animate-in fade-in slide-in-from-top-1">
                        {word.phonetic ? (
                          <p className="text-sm text-[#718096] font-mono">{word.phonetic}</p>
                        ) : null}
                        {word.translation ? (
                          <p className={PRACTICE_TRANS_CLASS}>{word.translation}</p>
                        ) : null}
                      </div>
                    )}
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
                      className={playingId === word.id ? "text-[#4ECDC4] animate-pulse" : "text-[#4ECDC4]"}
                    />
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant={word.status === "correct" ? "brand" : "ghost"}
                    size="iconRound"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusClick(word.id, "correct");
                    }}
                    className={word.status === "correct" ? "bg-[#66BB6A] hover:bg-[#66BB6A]/90" : ""}
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
                    onClose={() => setDetailWord(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
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
          <div className="text-sm text-[#718096] text-right">
            正确 <span className="text-[#66BB6A] font-semibold">{correctCount}</span> · 错误{" "}
            <span className="text-[#FF6B6B] font-semibold">{wrongCount}</span>
            {mode === "study" && isRecheckMode && (
              <span className="block text-xs text-[#A0AEC0] mt-1">错词复检 · 仅显示刚重练的单词</span>
            )}
            {mode === "study" && !isRecheckMode && checkPhase === "milestone" && (
              <span className="block text-xs text-[#A0AEC0] mt-1">
                组内复习 · 打 × 将回到快闪剪刀重练
              </span>
            )}
            {mode === "study" && checkPhase === "final" && wrongWords.length > 0 && (
              <span className="block text-xs text-[#A0AEC0] mt-1">
                训后检测 · 错词需快闪重练后再提交
              </span>
            )}
          </div>
        </div>
        <CloudButton
          type="button"
          variant="brand"
          size="pill"
          className="w-full"
          onClick={handleSubmit}
          disabled={!allMarked || submitting}
          loading={submitting}
          loadingText="提交中…"
        >
          {submitLabel}
        </CloudButton>
        {!allMarked && words.length > 0 && (
          <p className="text-center text-sm text-[#FF6B6B] mt-2 font-medium">
            还有 {unmarkedCount} 个单词未勾选，请全部选择 ✓ 或 × 后再提交
          </p>
        )}
        </div>
      </div>

      <PracticePauseMenu
        open={showPauseMenu}
        onClose={() => setShowPauseMenu(false)}
      />
    </FlowPageShell>
  );
}
