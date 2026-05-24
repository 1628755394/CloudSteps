import { ArrowLeft, Volume2, Check, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { completeStudySession } from "@/api/study";
import { completeReviewSession } from "@/api/review";
import { playFirstWordAudio, playWordAudio } from "@/utils/audioPlayer";
import {
  getCheckPhaseLabel,
  getMilestoneCheckBatchRange,
  getTotalBatches,
  needsFinalCheckAfterMilestone,
  sliceWordsByBatches,
  type StudyCheckPhase,
} from "@/utils/studyBatchFlow";

type CheckWord = {
  id: number;
  word: string;
  translation?: string;
  audioUrl?: string;
  status: null | "correct" | "wrong";
  showTranslation?: boolean;
};

const CHECK_PHASE_KEY = "lb_study_check_phase";

function getStudyBatchMeta(batchIdx: number) {
  const stored = Number(sessionStorage.getItem("lb_study_total_batches") || 0);
  let totalBatches = stored;
  if (!totalBatches) {
    try {
      const raw = sessionStorage.getItem("lb_study_words") || "[]";
      const arr = JSON.parse(raw);
      const total = Array.isArray(arr) ? arr.length : 0;
      totalBatches = getTotalBatches(total);
    } catch {
      totalBatches = 1;
    }
  }
  const currentBatch = batchIdx + 1;
  const hasMoreBatches = currentBatch < totalBatches;
  return { totalBatches, currentBatch, hasMoreBatches, isLastBatch: !hasMoreBatches };
}

export default function PostTrainingCheck() {
  const navigate = useNavigate();
  const [words, setWords] = useState<CheckWord[]>([]);

  const mode = useMemo(() => sessionStorage.getItem("lb_mode") || "study", []);

  const batchIdx = useMemo(() => {
    const key = mode === "review" ? "lb_review_batch_idx" : "lb_study_batch_idx";
    return Number(sessionStorage.getItem(key) || 0);
  }, [mode]);

  const checkPhase = useMemo((): StudyCheckPhase => {
    if (mode === "review") return "milestone";
    const p = sessionStorage.getItem(CHECK_PHASE_KEY);
    return p === "final" ? "final" : "milestone";
  }, [mode, batchIdx]);

  const sessionId = useMemo(() => {
    const key = mode === "review" ? "lb_review_session_id" : "lb_study_session_id";
    return Number(sessionStorage.getItem(key) || 0);
  }, [mode]);

  const [submitting, setSubmitting] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const batchInfo = useMemo(() => {
    if (mode === "review") {
      return { totalBatches: 1, hasMoreBatches: false, isLastBatch: true, currentBatch: 1 };
    }
    return getStudyBatchMeta(batchIdx);
  }, [batchIdx, mode]);

  const phaseLabels = useMemo(
    () => getCheckPhaseLabel(checkPhase, batchIdx, batchInfo.totalBatches),
    [checkPhase, batchIdx, batchInfo.totalBatches]
  );

  const handlePlayAudio = (word: CheckWord) => {
    if (!word.audioUrl) return;
    abortRef.current?.();
    setPlayingId(word.id);
    const abort = playWordAudio(word.audioUrl, 300, () => setPlayingId(null));
    abortRef.current = abort;
  };

  const handleBack = () => {
    if (mode === "review") {
      const wordBookId = sessionStorage.getItem("lb_review_wordbook_id");
      if (wordBookId) {
        navigate(`/review-word-list?wordBookId=${wordBookId}`);
        return;
      }
      navigate("/anti-forgetting");
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/flash-review");
  };

  useEffect(() => {
    try {
      const wordsKey = mode === "review" ? "lb_review_words" : "lb_study_words";
      const raw = sessionStorage.getItem(wordsKey) || "[]";
      const parsed = JSON.parse(raw);
      const all: any[] = Array.isArray(parsed) ? parsed : [];
      let slice: any[];
      if (mode === "review") {
        slice = all;
      } else if (checkPhase === "final") {
        slice = all;
      } else {
        const { startBatch, endBatch } = getMilestoneCheckBatchRange(batchIdx);
        slice = sliceWordsByBatches(all, startBatch, endBatch);
      }
      const mapped: CheckWord[] = slice.map((w: any) => ({
        id: Number(w.id),
        word: String(w.word || ""),
        translation: w.translation ? String(w.translation) : undefined,
        audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
        status: null,
        showTranslation: false,
      }));
      setWords(mapped);
    } catch {
      // ignore
    }
  }, [batchIdx, mode, checkPhase]);

  const handleStatusClick = (id: number, newStatus: "correct" | "wrong") => {
    setWords((prev) =>
      prev.map((word) => {
        if (word.id === id) {
          return { ...word, status: word.status === newStatus ? null : newStatus };
        }
        return word;
      })
    );
  };

  const handleWordClick = (word: CheckWord) => {
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

  const goNextBatch = () => {
    sessionStorage.setItem("lb_study_batch_idx", String(batchIdx + 1));
    navigate("/word-practice", { replace: true });
  };

  const finishTrainingAndCreateReview = () => {
    sessionStorage.removeItem("lb_study_batch_idx");
    sessionStorage.removeItem("lb_study_batch_results");
    sessionStorage.removeItem("lb_study_total_batches");
    sessionStorage.removeItem(CHECK_PHASE_KEY);
    navigate("/create-anti-forgetting", { replace: true });
  };

  const submitLabel = useMemo(() => {
    if (mode === "review") return "完成复习";
    if (checkPhase === "final") return "提交并完成训练";
    if (needsFinalCheckAfterMilestone(batchIdx, batchInfo.totalBatches)) {
      return "提交并进入总检测";
    }
    return "提交并继续下一组";
  }, [mode, checkPhase, batchIdx, batchInfo.totalBatches]);

  const handleSubmit = () => {
    const hasSelection = words.some((word) => word.status !== null);
    if (!hasSelection) return;

    const results = words
      .filter((w) => w.status !== null)
      .map((w) => ({ wordId: w.id, remembered: w.status === "correct" }));

    (async () => {
      setSubmitting(true);
      try {
        if (mode === "review") {
          const res = await completeReviewSession(sessionId, results);
          if (res.code !== 200) {
            throw new Error(res.msg || "提交失败");
          }
          sessionStorage.removeItem("lb_review_batch_idx");
          sessionStorage.removeItem("lb_review_results");
          navigate("/anti-forgetting", { replace: true });
          return;
        }

        if (checkPhase === "milestone") {
          appendMilestoneResults(results);
          if (needsFinalCheckAfterMilestone(batchIdx, batchInfo.totalBatches)) {
            sessionStorage.setItem(CHECK_PHASE_KEY, "final");
            navigate("/post-training-check", { replace: true });
            return;
          }
          goNextBatch();
          return;
        }

        // 总检测：以本次全部勾选为准提交
        if (sessionId) {
          await completeStudySession(sessionId, results);
        }
        finishTrainingAndCreateReview();
      } catch {
        if (checkPhase === "final") {
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
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center px-4 py-4">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-[#2D3748]" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-[#2D3748] -ml-10">
            {mode === "review" ? "开始复习" : phaseLabels.title}
          </h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        {mode === "study" && (
          <p className="text-center text-sm text-[#718096] mb-4">{phaseLabels.hint}</p>
        )}
        <div className="space-y-3 mb-6">
          {words.map((word) => (
            <div
              key={word.id}
              className={`bg-white rounded-xl p-4 flex items-center justify-between shadow-sm transition-all ${
                word.status === "correct"
                  ? "border-2 border-[#66BB6A] bg-[#66BB6A]/5"
                  : word.status === "wrong"
                  ? "border-2 border-[#FF6B6B] bg-[#FF6B6B]/5"
                  : ""
              }`}
            >
              <div
                className="flex items-center gap-3 flex-1 cursor-pointer"
                onClick={() => handleWordClick(word)}
              >
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
                <button
                  type="button"
                  onClick={() => handlePlayAudio(word)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Volume2
                    size={20}
                    className={playingId === word.id ? "text-[#4ECDC4] animate-pulse" : "text-[#4ECDC4]"}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusClick(word.id, "correct")}
                  className={`p-2 rounded-full transition-colors ${
                    word.status === "correct"
                      ? "bg-[#66BB6A] text-white"
                      : "hover:bg-gray-100 text-[#718096]"
                  }`}
                >
                  <Check size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusClick(word.id, "wrong")}
                  className={`p-2 rounded-full transition-colors ${
                    word.status === "wrong"
                      ? "bg-[#FF6B6B] text-white"
                      : "hover:bg-gray-100 text-[#718096]"
                  }`}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="text-center text-sm text-[#718096] mb-3">
          正确 <span className="text-[#66BB6A] font-semibold">{correctCount}</span> · 错误{" "}
          <span className="text-[#FF6B6B] font-semibold">{wrongCount}</span>
          {mode === "study" && checkPhase === "milestone" && (
            <span className="block text-xs text-[#A0AEC0] mt-1">
              当前为第 {batchInfo.currentBatch} 小批 · 每 3 小批为一大组
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={correctCount + wrongCount === 0 || submitting}
          className="w-full py-3 bg-[#4ECDC4] text-white rounded-full font-medium hover:bg-[#45b8b0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "提交中…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
