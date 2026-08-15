import { useNavigate } from "react-router";
import { Volume2, Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getReviewToday, startReviewSession } from "../api/review";
import { playFirstWordAudio, playWordAudio } from "../utils/audioPlayer";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
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
import { nextWordTapState } from "../utils/wordReveal";
import { beginReviewPractice, type ReviewPracticeWord } from "../utils/reviewPractice";

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
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [viewMode, setViewMode] = useState<WordViewMode>("list");
  const [cardIndex, setCardIndex] = useState(0);

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

  const [playingId, setPlayingId] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const handlePlayAudio = (item: ReviewWordItem) => {
    if (!item.audioUrl) return;
    abortRef.current?.();
    setPlayingId(item.id);
    const abort = playWordAudio(item.audioUrl, 300, () => setPlayingId(null));
    abortRef.current = abort;
  };

  useEffect(() => {
    sessionStorage.setItem("lb_mode", "review");
  }, []);

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
    else navigate("/anti-forgetting");
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

  const handleSubmit = () => {
    if (submitting) return;
    if (words.length === 0) {
      setHint("当前没有可复习的单词");
      return;
    }
    if (markedCount === 0) {
      setHint("请至少为一个单词选择 ✓ 或 × 后再开始学习");
      return;
    }
    setHint(null);

    (async () => {
      setSubmitting(true);
      try {
        const wordIds = markedWords.map((w) => w.id);
        const res = await startReviewSession({ wordBookId, wordIds });
        const sid = Number(res.data?.sessionId || 0);
        if (!sid) {
          handleBack();
          return;
        }

        const sessionWords = Array.isArray(res.data?.words) ? res.data!.words! : [];
        const byId = new Map(
          sessionWords.map((w: ReviewPracticeWord) => [Number(w.id), w] as const)
        );
        const practiceWords: ReviewPracticeWord[] = markedWords.map((w) => {
          const full = byId.get(w.id);
          return {
            id: w.id,
            word: w.word,
            phonetic: full?.phonetic ? String(full.phonetic) : undefined,
            phoneticUk: full?.phoneticUk ? String(full.phoneticUk) : undefined,
            phoneticUs: full?.phoneticUs ? String(full.phoneticUs) : undefined,
            translation: full?.translation
              ? String(full.translation)
              : w.translation,
            audioUrl: full?.audioUrl
              ? String(full.audioUrl)
              : w.audioUrl,
          };
        });

        beginReviewPractice({
          sessionId: sid,
          wordBookId,
          words: practiceWords,
          returnPath: "/anti-forgetting",
        });
        navigate("/word-practice", { replace: true });
      } catch {
        setHint("无法开始学习，请稍后重试");
        setSubmitting(false);
      }
    })();
  };

  const correctCount = words.filter((word) => word.status === "correct").length;
  const wrongCount = words.filter((word) => word.status === "wrong").length;

  return (
    <FlowPageShell className="min-h-dvh bg-[#F7F9FC] pb-[max(7.5rem,env(safe-area-inset-bottom))]">
      <TopBar
        title="开始复习"
        onBack={handleBack}
        rightSlot={
          <div className="flex items-center gap-0.5">
            <AnnotationToggleButton
              active={annotationOpen}
              onClick={() => setAnnotationOpen((v) => !v)}
            />
            <PracticeFontSettingsButton />
          </div>
        }
      />

      <AnnotationLayer
        storageKey={`review-list:${wordBookId}`}
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 pt-3 pb-4 max-w-2xl mx-auto w-full">
        <div className="mb-3">
          <p className="text-[#718096] text-sm">当前共有 {words.length} 个可选单词</p>
          {words.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              该日暂无待复习单词（可能已完成，或列表统计与取词日期不一致，请返回重进或换一天）
            </p>
          )}
        </div>

        <WordMarkStatsBar
          correctCount={correctCount}
          wrongCount={wrongCount}
          total={words.length}
        />

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
                      ? "border-2 border-[#66BB6A] bg-[#66BB6A]/5 hover:border-[#66BB6A]"
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
                      <CloudButton
                        type="button"
                        variant={item.status === "correct" ? "brand" : "ghost"}
                        size="iconRound"
                        onClick={() => handleStatusClick(item.id, "correct")}
                        className={item.status === "correct" ? "bg-[#66BB6A] hover:bg-[#66BB6A]/90" : ""}
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E2E8F0] px-4 py-3 shadow-lg">
        <div className="max-w-2xl mx-auto w-full space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
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
            <div className="flex-1" />
            <WordViewModeToggle mode={viewMode} onChange={setViewMode} />
          </div>
          <CloudButton
            type="button"
            variant="brand"
            size="pill"
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
            loadingText="准备中…"
            className={`w-full ${markedCount === 0 && words.length > 0 ? "opacity-80" : ""}`}
          >
            开始学习
            {markedCount > 0 ? ` (${markedCount})` : ""}
          </CloudButton>
          {hint && (
            <p className="text-center text-xs text-amber-600 px-1 animate-in fade-in">{hint}</p>
          )}
          {!hint && markedCount === 0 && words.length > 0 && (
            <p className="text-center text-xs text-[#A0AEC0]">
              先勾选要复习的词，再进入跟课前检测一样的练习流程
            </p>
          )}
        </div>
      </div>
    </FlowPageShell>
  );
}
