import { CloudButton } from "../components/cloudsteps";
import { ArrowLeft, Pause, Volume2, Scissors } from "lucide-react";
import { useNavigate } from "react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import { playFirstWordAudio, playWordAudio } from "../utils/audioPlayer";
import {
  clearStudyRetryFlash,
  getStudyRetryWords,
  getTotalBatches,
  resolveCheckPhase,
  setStudyRecheckWords,
  shouldEnterPostTrainingCheck,
} from "../utils/studyBatchFlow";

const CHECK_PHASE_KEY = "lb_study_check_phase";

type FlashWord = {
  id: number;
  word: string;
  translation: string;
  audioUrl?: string;
  scissorCount: number;
  showTranslation: boolean;
};

function mapToFlashWord(w: Record<string, unknown>): FlashWord {
  return {
    id: Number(w.id),
    word: String(w.word || ""),
    translation: String(w.translation || ""),
    audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
    scissorCount: 0,
    showTranslation: false,
  };
}

export default function FlashReview() {
  const navigate = useNavigate();
  const [words, setWords] = useState<FlashWord[]>([]);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const mode = useMemo(() => sessionStorage.getItem("lb_mode") || "study", []);

  useEffect(() => {
    if (mode !== "review") return;
    const wordBookId = sessionStorage.getItem("lb_review_wordbook_id");
    if (wordBookId) {
      navigate(`/review-word-list?wordBookId=${wordBookId}`, { replace: true });
    } else {
      navigate("/anti-forgetting", { replace: true });
    }
  }, [mode, navigate]);

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
    else navigate(mode === "review" ? "/anti-forgetting" : "/word-practice");
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

  const handleScissorClick = (word: FlashWord) => {
    if (word.audioUrl) {
      abortRef.current?.();
      setPlayingId(word.id);
      const abort = playFirstWordAudio(word.audioUrl, () => setPlayingId(null));
      abortRef.current = abort;
    }
    setWords((prev) =>
      prev.map((w) => {
        if (w.id !== word.id || w.scissorCount >= 2) return w;
        return { ...w, scissorCount: w.scissorCount + 1 };
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

  const toggleTranslation = (word: FlashWord) => {
    const id = word.id;
    const isShowing = !word.showTranslation;
    if (isShowing && word.audioUrl) {
      abortRef.current?.();
      setPlayingId(word.id);
      const abort = playFirstWordAudio(word.audioUrl, () => setPlayingId(null));
      abortRef.current = abort;
    }
    setWords((prev) =>
      prev.map((w) => {
        if (isShowing) {
          return w.id === id ? { ...w, showTranslation: true } : { ...w, showTranslation: false };
        }
        return w.id === id ? { ...w, showTranslation: false } : w;
      })
    );
  };

  const allCut = words.length > 0 && words.every((word) => word.scissorCount >= 2);

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

  const scissorColor = (count: number) => {
    if (count >= 2) return "text-[#66BB6A]";
    if (count === 1) return "text-[#FF6B6B]";
    return "text-[#718096]";
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between px-4 py-4">
          <CloudButton
            type="button"
            variant="ghost"
            size="iconRound"
            onClick={handleBack}
            className="-ml-2"
          >
            <ArrowLeft size={24} className="text-[#2D3748]" />
          </CloudButton>
          <h1 className="flex-1 text-center text-lg font-semibold text-[#2D3748]">{headerTitle}</h1>
          <CloudButton type="button" variant="ghost" size="iconRound" className="-mr-2">
            <Pause size={24} className="text-[#2D3748]" />
          </CloudButton>
        </div>
      </div>

      <div className="px-4 mt-6">
        <p className="text-center text-sm text-[#718096] mb-6">
          {isRetryMode
            ? "红剪一次表示不熟，再剪一次（绿）表示掌握"
            : `${words.filter((w) => w.scissorCount < 2).length} 个待剪`}
        </p>

        <div className="space-y-3 mb-6">
          {words
            .filter((w) => w.scissorCount < 2)
            .map((word) => (
              <div
                key={word.id}
                className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm transition-all"
              >
                <div
                  className="flex items-center gap-3 flex-1 cursor-pointer pr-3"
                  onClick={() => toggleTranslation(word)}
                >
                  <div>
                    <div className="text-base font-medium text-[#2D3748] mb-1 hover:text-[#4ECDC4] transition-colors">
                      {word.word}
                    </div>
                    {word.showTranslation && word.translation && (
                      <div className="text-sm text-[#718096] animate-in fade-in slide-in-from-top-1">
                        {word.translation}
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
                      handleScissorClick(word);
                    }}
                    title={word.scissorCount === 0 ? "红剪：不熟，可再来" : "绿剪：掌握"}
                  >
                    <Scissors size={20} className={scissorColor(word.scissorCount)} />
                  </CloudButton>
                </div>
              </div>
            ))}
        </div>
      </div>

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
