import { CloudButton } from "../components/cloudsteps";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
import { PracticeFontSettingsButton, PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "../components/PracticeFontSettings";
import { PracticePauseMenu } from "../components/PracticePauseMenu";
import { TopBar } from "../components/TopBar";
import { Pause, Volume2, Scissors } from "lucide-react";
import { useNavigate } from "react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import { playFirstWordAudio, playWordAudio } from "../utils/audioPlayer";
import { formatTranslation, pickPhoneticDisplay } from "../utils/wordFormat";
import { nextWordTapState } from "../utils/wordReveal";
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
  return {
    uid: newUid(id),
    id,
    word: String(w.word || ""),
    phonetic: pickPhoneticDisplay(w as { phonetic?: string; phoneticUk?: string; phoneticUs?: string }),
    translation: formatTranslation(w.translation as string),
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
    else navigate(mode === "review" ? getReviewReturnPath("/anti-forgetting") : "/word-practice");
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
    const abort = playWordAudio(word.audioUrl, 300, () => setPlayingId(null));
    abortRef.current = abort;
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
  };

  const allCut = words.length > 0 && words.every((word) => word.scissorCount > 0);

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

  useEffect(() => {
    if (allCut && !showCompleteDialog) {
      handleComplete();
    }
  }, [allCut, showCompleteDialog]);

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
            : `${uncutCount} 个待剪`}
        </p>

        <div className="space-y-3 mb-6">
          {words
            .filter((w) => w.scissorCount === 0)
            .map((word) => (
              <div
                key={word.uid}
                className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm transition-all"
              >
                <div
                  className="flex items-center gap-3 flex-1 cursor-pointer pr-3"
                  onClick={() => handleWordTap(word)}
                >
                  <div>
                    <div className={`${PRACTICE_WORD_CLASS} mb-1 hover:text-[#4ECDC4] transition-colors`}>
                      {word.word}
                    </div>
                    {word.showTranslation && (
                      <div className="animate-in fade-in slide-in-from-top-1">
                        {word.phonetic ? (
                          <div className="text-sm text-[#718096] font-mono mb-0.5">{word.phonetic}</div>
                        ) : null}
                        {word.translation ? (
                          <div className={PRACTICE_TRANS_CLASS}>{word.translation}</div>
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
            ))}
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
