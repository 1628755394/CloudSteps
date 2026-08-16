import { CloudButton } from "../components/cloudsteps";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
import { PracticeFontSettingsButton, PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "../components/PracticeFontSettings";
import { PracticePauseMenu } from "../components/PracticePauseMenu";
import { TopBar } from "../components/TopBar";
import { WordDetailPanel } from "../components/WordDetailPanel";
import { WordViewModeToggle, type WordViewMode } from "../components/WordMarkView";
import { Pause, ArrowRight, Volume2, Shuffle, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { playSecondWordAudio } from "../utils/audioPlayer";
import { formatTranslation, formatTranslationShort, pickPhoneticDisplay } from "../utils/wordFormat";
import { getReviewReturnPath } from "../utils/reviewPractice";

type ListenWord = {
  id: number;
  word: string;
  phonetic?: string;
  translation?: string;
  translationShort?: string;
  audioUrl?: string;
  /** idle=未听 / played=已发音 / revealed=已显示释义 */
  state: "idle" | "played" | "revealed";
};

export default function ListenIdentify() {
  const navigate = useNavigate();
  const [words, setWords] = useState<ListenWord[]>([]);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [viewMode, setViewMode] = useState<WordViewMode>("list");
  const [cardIndex, setCardIndex] = useState(0);
  const [detailMode, setDetailMode] = useState(false);

  const mode = useMemo(() => sessionStorage.getItem("lb_mode") || "study", []);

  const batchIdx = useMemo(() => {
    const key = mode === "review" ? "lb_review_batch_idx" : "lb_study_batch_idx";
    return Number(sessionStorage.getItem(key) || 0);
  }, [mode]);

  const totalBatches = useMemo(() => {
    if (mode === "review") {
      try {
        const raw = sessionStorage.getItem("lb_review_words") || "[]";
        const arr = JSON.parse(raw);
        const total = Array.isArray(arr) ? arr.length : 0;
        return Math.max(1, Math.ceil(total / 5));
      } catch {
        return 1;
      }
    }
    const stored = Number(sessionStorage.getItem("lb_study_total_batches") || 0);
    if (stored > 0) return stored;
    try {
      const raw = sessionStorage.getItem("lb_study_words") || "[]";
      const arr = JSON.parse(raw);
      const total = Array.isArray(arr) ? arr.length : 0;
      return Math.max(1, Math.ceil(total / 5));
    } catch {
      return 1;
    }
  }, [mode]);

  const [playingId, setPlayingId] = useState<number | null>(null);
  const [fullMeaning, setFullMeaning] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(mode === "review" ? getReviewReturnPath("/anti-forgetting") : "/word-practice");
  };

  useEffect(() => {
    try {
      const wordsKey = mode === "review" ? "lb_review_words" : "lb_study_words";
      const raw = sessionStorage.getItem(wordsKey) || "[]";
      const arr = JSON.parse(raw);
      const all: any[] = Array.isArray(arr) ? arr : [];
      const start = batchIdx * 5;
      const slice = all.slice(start, start + 5);
      const mapped: ListenWord[] = slice.map((w: any) => ({
        id: Number(w.id),
        word: String(w.word || ""),
        phonetic: pickPhoneticDisplay(w),
        translation: formatTranslation(w.translation),
        translationShort: formatTranslationShort(w.translation),
        audioUrl: w.audioUrl ? String(w.audioUrl) : "",
        state: "idle",
      }));
      setWords(mapped);
      setCardIndex(0);
    } catch {
      // ignore
    }
  }, [batchIdx, mode]);

  const handlePlayFirstAudio = (w: ListenWord) => {
    if (!w.audioUrl) return;
    abortRef.current?.();
    setPlayingId(w.id);
    const abort = playSecondWordAudio(w.audioUrl, () => setPlayingId(null));
    abortRef.current = abort;
  };

  const handleCardClick = (word: ListenWord) => {
    const current = words.find((w) => w.id === word.id);
    if (current?.state === "idle") {
      handlePlayFirstAudio(current);
    }
    setWords((prev) =>
      prev.map((w) => {
        if (w.id !== word.id) return w;
        if (w.state === "idle") {
          return { ...w, state: "played" };
        }
        if (w.state === "played") {
          return { ...w, state: "revealed" };
        }
        return { ...w, state: "idle" };
      })
    );
  };

  const handleShuffle = () => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWords(shuffled);
    setCardIndex(0);
  };

  const meaningText = (w: ListenWord) =>
    fullMeaning ? w.translation || w.translationShort : w.translationShort || w.translation;

  const renderRevealed = (w: ListenWord) => (
    <>
      <div className={`${PRACTICE_WORD_CLASS} mb-1`}>{w.word}</div>
      {w.phonetic ? (
        <div className="text-sm text-[#718096] font-mono mb-0.5">{w.phonetic}</div>
      ) : null}
      <div className={PRACTICE_TRANS_CLASS}>{meaningText(w)}</div>
      {(w.translation || w.translationShort) && (
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
    </>
  );

  const renderWordCard = (w: ListenWord, opts?: { centered?: boolean }) => {
    const showAnswer = w.state === "revealed";
    return (
      <div
        onClick={() => handleCardClick(w)}
        className={`bg-white rounded-xl p-4 shadow-sm transition-all cursor-pointer select-none ${
          opts?.centered ? "w-full" : ""
        } ${
          w.state === "revealed"
            ? "border-2 border-[#66BB6A] bg-[#66BB6A]/5"
            : w.state === "played"
            ? "border-2 border-[#4ECDC4] bg-[#4ECDC4]/10"
            : ""
        }`}
      >
        <div className={`flex items-center gap-3 ${opts?.centered ? "flex-col text-center" : ""}`}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              w.state === "revealed"
                ? "bg-[#66BB6A]/15"
                : w.state === "played"
                ? "bg-[#4ECDC4]/15"
                : "bg-gray-100"
            }`}
          >
            <Volume2
              size={20}
              className={
                w.state === "revealed"
                  ? "text-[#66BB6A]"
                  : w.state === "played"
                  ? "text-[#4ECDC4]"
                  : "text-[#718096]"
              }
            />
          </div>
          <div className={opts?.centered ? "w-full" : ""}>
            {!showAnswer && (
              <div className="text-sm text-[#718096]">
                {w.state === "idle" ? "点击播放" : "再点显示答案"}
              </div>
            )}
            {showAnswer && renderRevealed(w)}
          </div>
        </div>
        {detailMode && showAnswer && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <WordDetailPanel
              wordId={w.id}
              wordText={w.word}
              variant="inline"
              onClose={() => {}}
            />
          </div>
        )}
      </div>
    );
  };

  const cardWord = words[Math.min(Math.max(0, cardIndex), Math.max(0, words.length - 1))];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <TopBar
        title="听音识词"
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
              onClick={() => setShowPauseMenu(!showPauseMenu)}
            >
              <Pause size={18} className="text-[#2D3748]" />
            </CloudButton>
          </div>
        }
      />

      <AnnotationLayer
        storageKey="listen-identify"
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-6 max-w-2xl mx-auto w-full pb-28">
        <div className="text-center text-sm text-[#718096] mb-6">{batchIdx + 1}/{totalBatches}组</div>

        {viewMode === "card" && cardWord ? (
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
                className="flex-1"
                style={{ minHeight: "max(8rem, calc(var(--practice-word-size) * 6))" }}
              >
                {renderWordCard(cardWord, { centered: true })}
              </div>
              <CloudButton
                type="button"
                variant="ghost"
                size="iconRound"
                disabled={cardIndex >= words.length - 1}
                onClick={() => setCardIndex((i) => Math.min(words.length - 1, i + 1))}
                className="shrink-0 bg-muted disabled:opacity-40"
              >
                <ChevronRight size={22} />
              </CloudButton>
            </div>
            <p className="text-xs text-[#718096]">
              {cardIndex + 1} / {words.length}
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {words.map((w) => (
              <div key={w.id}>{renderWordCard(w)}</div>
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
              onClick={() => setDetailMode((v) => !v)}
            >
              <BookOpen size={16} />
              拓展
            </CloudButton>
          </div>
          <CloudButton
            variant="brand"
            size="iconRound"
            className="size-12 shrink-0"
            onClick={() => navigate("/flash-review")}
          >
            <ArrowRight size={24} />
          </CloudButton>
        </div>
      </div>

      <PracticePauseMenu
        open={showPauseMenu}
        onClose={() => setShowPauseMenu(false)}
        continueLabel="继续练习"
      />
    </div>
  );
}
