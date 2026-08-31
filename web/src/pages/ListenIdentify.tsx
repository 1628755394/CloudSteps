import { CloudButton } from "../components/cloudsteps";
import { AnnotationLayer } from "../components/AnnotationLayer";
import { PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS, PRACTICE_CARD_WORD_CLASS } from "../components/PracticeFontSettings";
import { PracticeFlowToolbar } from "../components/PracticeFlowToolbar";
import { TopBar } from "../components/TopBar";
import { WordDetailPanel } from "../components/WordDetailPanel";
import {
  WordViewModeToggle,
  markWordCardClass,
  markWordCardStyle,
  type WordViewMode,
} from "../components/WordMarkView";
import { ArrowRight, Volume2, Shuffle, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { playFirstWordAudio } from "../utils/audioPlayer";
import { displayTranslationFull, displayTranslationShort, pickPhoneticDisplay } from "../utils/wordFormat";
import { getReviewReturnPath } from "../utils/reviewPractice";
import { applyUserWordView } from "../components/WordEditControls";
import { NoteSplitLayout } from "../components/NoteSplitLayout";
import { StudyNoteLauncher } from "../components/StudyNotePanel";

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
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [viewMode, setViewMode] = useState<WordViewMode>("list");
  const [cardIndex, setCardIndex] = useState(0);
  const [detailMode, setDetailMode] = useState(false);

  const mode = useMemo(() => sessionStorage.getItem("lb_mode") || "study", []);
  const wordBookId = useMemo(() => Number(sessionStorage.getItem("lb_wordbook_id") || 0), []);
  const wordNoteKey = (wordId: number) => `study-note:word:${wordBookId}:${wordId}`;

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
    else navigate(mode === "review" ? getReviewReturnPath("/word-training") : "/word-practice");
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
        translation: displayTranslationFull(w.translation),
        translationShort: displayTranslationShort(w),
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
    const abort = playFirstWordAudio(w.audioUrl, () => setPlayingId(null));
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

  const renderRevealed = (w: ListenWord, opts?: { card?: boolean }) => (
    <>
      <div className={`${opts?.card ? PRACTICE_CARD_WORD_CLASS : PRACTICE_WORD_CLASS} hover:text-[#4ECDC4] transition-colors ${opts?.card ? "" : "mb-1"}`}>
        {w.word}
      </div>
      {w.phonetic ? (
        <div className={`text-sm text-[#718096] font-mono ${opts?.card ? "mt-4" : "mb-0.5"}`}>{w.phonetic}</div>
      ) : null}
      <div className={`${PRACTICE_TRANS_CLASS} ${opts?.card ? "mt-3" : ""}`}>{meaningText(w)}</div>
      {(w.translation || w.translationShort) && (
        <button
          type="button"
          className={`text-xs text-[#4ECDC4] hover:underline ${opts?.card ? "mt-3" : "mt-1"}`}
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

  const tapped = (w: ListenWord) => w.state !== "idle" || playingId === w.id;

  const renderWordCard = (w: ListenWord) => {
    const showAnswer = w.state === "revealed";
    return (
      <div
        onClick={() => handleCardClick(w)}
        className={`rounded-xl p-4 shadow-sm transition-all cursor-pointer select-none ${markWordCardClass(
          null,
          tapped(w)
        )}`}
        style={markWordCardStyle(null, tapped(w))}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              w.state === "idle" ? "bg-gray-100" : "bg-[#4ECDC4]/15"
            }`}
          >
            <Volume2
              size={20}
              className={
                playingId === w.id
                  ? "text-[#4ECDC4] animate-pulse"
                  : w.state === "idle"
                    ? "text-[#718096]"
                    : "text-[#4ECDC4]"
              }
            />
          </div>
          <div className="flex-1 min-w-0">
            {!showAnswer && (
              <div className="text-sm text-[#718096]">
                {w.state === "idle" ? "点击播放" : "再点显示答案"}
              </div>
            )}
            {showAnswer && renderRevealed(w)}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <StudyNoteLauncher
              storageKey={wordNoteKey(w.id)}
              title={`笔记 · ${w.word}`}
              label="笔记"
              className="h-9 px-2"
            />
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
          <PracticeFlowToolbar
            annotationOpen={annotationOpen}
            onToggleAnnotation={() => setAnnotationOpen((v) => !v)}
            pauseContinueLabel="继续练习"
            wordCount={words.length}
            onWordPatched={(view) =>
              setWords((prev) =>
                applyUserWordView(prev, view).map((w) =>
                  w.id === view.wordId
                    ? {
                        ...w,
                        translation: displayTranslationFull(view.effective.translation) || w.translation,
                        translationShort:
                          (view.effective.translationShort || "").trim() || w.translationShort,
                      }
                    : w
                )
              )
            }
          />
        }
      />

      <AnnotationLayer
        storageKey="listen-identify"
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <NoteSplitLayout
        defaultStorageKey={`study-note:global:${wordBookId}`}
        defaultTitle="随心记"
      >
        <div className="text-center text-sm text-[#718096] mb-6">{batchIdx + 1}/{totalBatches}组</div>

        {viewMode === "card" && cardWord ? (
          <div className="flex w-full flex-col gap-3">
            <div
              className={`relative flex w-full flex-col overflow-hidden rounded-2xl shadow-sm transition-colors ${markWordCardClass(
                null,
                tapped(cardWord)
              )}`}
              style={{
                ...markWordCardStyle(null, tapped(cardWord)),
                minHeight: "min(62vh, calc(100dvh - 13.5rem))",
              }}
            >
              <p className="pointer-events-none absolute left-0 right-0 top-4 z-10 text-center text-xs text-[#718096]">
                {cardIndex + 1} / {words.length}
              </p>
              <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
                <CloudButton
                  type="button"
                  variant="ghost"
                  size="iconRound"
                  disabled={cardIndex <= 0}
                  onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
                  className="absolute left-2 top-1/2 z-10 size-11 -translate-y-1/2 bg-muted/90 shadow-sm disabled:opacity-35"
                  aria-label="上一个"
                >
                  <ChevronLeft size={24} />
                </CloudButton>
                <button
                  type="button"
                  className="mx-auto flex w-full max-w-[calc(100%-6.5rem)] cursor-pointer flex-col items-center justify-center px-2 py-10 text-center"
                  onClick={() => handleCardClick(cardWord)}
                >
                  {cardWord.state === "revealed" ? (
                    renderRevealed(cardWord, { card: true })
                  ) : (
                    <>
                      <Volume2
                        size={48}
                        className={
                          playingId === cardWord.id
                            ? "text-[#4ECDC4] animate-pulse"
                            : cardWord.state === "played"
                              ? "text-[#4ECDC4]"
                              : "text-[#A0AEC0]"
                        }
                      />
                      <p className="mt-4 text-sm text-[#718096]">
                        {cardWord.state === "idle" ? "点击播放" : "再点显示答案"}
                      </p>
                    </>
                  )}
                </button>
                <CloudButton
                  type="button"
                  variant="ghost"
                  size="iconRound"
                  disabled={cardIndex >= words.length - 1}
                  onClick={() => setCardIndex((i) => Math.min(words.length - 1, i + 1))}
                  className="absolute right-2 top-1/2 z-10 size-11 -translate-y-1/2 bg-muted/90 shadow-sm disabled:opacity-35"
                  aria-label="下一个"
                >
                  <ChevronRight size={24} />
                </CloudButton>
              </div>
              <div className="flex items-center justify-center gap-3 border-t border-border/60 px-4 py-4">
                <div onClick={(e) => e.stopPropagation()}>
                  <StudyNoteLauncher
                    storageKey={wordNoteKey(cardWord.id)}
                    title={`笔记 · ${cardWord.word}`}
                    label="笔记"
                    className="h-9 px-2"
                  />
                </div>
                <CloudButton
                  type="button"
                  variant="ghost"
                  size="iconRound"
                  className="size-12"
                  onClick={() => handlePlayFirstAudio(cardWord)}
                  aria-label="播放发音"
                >
                  <Volume2
                    size={22}
                    className={
                      playingId === cardWord.id ? "text-[#4ECDC4] animate-pulse" : "text-[#4ECDC4]"
                    }
                  />
                </CloudButton>
              </div>
            </div>
            {detailMode && cardWord.state === "revealed" && (
              <div className="w-full">
                <WordDetailPanel
                  wordId={cardWord.id}
                  wordText={cardWord.word}
                  variant="inline"
                  onClose={() => {}}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {words.map((w) => (
              <div key={w.id}>{renderWordCard(w)}</div>
            ))}
          </div>
        )}
      </NoteSplitLayout>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between gap-2">
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
    </div>
  );
}
