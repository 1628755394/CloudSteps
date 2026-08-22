import { Shuffle, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotationLayer } from "../components/AnnotationLayer";
import { PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "../components/PracticeFontSettings";
import { PracticeFlowToolbar } from "../components/PracticeFlowToolbar";
import { CloudButton } from "../components/cloudsteps";
import { FlowPageShell } from "../components/PageTransition";
import { TopBar } from "../components/TopBar";
import { WordDetailPanel } from "../components/WordDetailPanel";
import { StudyNoteLauncher } from "../components/StudyNotePanel";
import { WordViewModeToggle, type WordViewMode } from "../components/WordMarkView";
import { playFirstWordAudio, playWordAudio, playAudioAtIndex, parseAudioUrls } from "../utils/audioPlayer";
import { formatTranslation, formatTranslationShort, pickPhoneticDisplay } from "../utils/wordFormat";
import { nextWordTapState, syncDetailWordWithTap } from "../utils/wordReveal";
import { getReviewReturnPath } from "../utils/reviewPractice";

type PracticeWord = {
  id: number;
  word: string;
  phonetic: string;
  translation: string;
  translationShort: string;
  audioUrl?: string;
  count: number;
  completed: boolean;
  showTranslation: boolean;
  heard: boolean;
};

export default function WordPractice() {
  const navigate = useNavigate();
  const [words, setWords] = useState<PracticeWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [manualReadMode, setManualReadMode] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [detailMode, setDetailMode] = useState(false);
  const [detailWord, setDetailWord] = useState<{ id: number; word: string } | null>(null);
  const [viewMode, setViewMode] = useState<WordViewMode>("list");
  const [cardIndex, setCardIndex] = useState(0);
  const [fullMeaning, setFullMeaning] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const [audioIndexMap, setAudioIndexMap] = useState<Map<number, number>>(new Map());

  const handlePlayNextAudio = (word: PracticeWord) => {
    if (!word.audioUrl) return;
    const urls = parseAudioUrls(word.audioUrl);
    if (urls.length === 0) return;
    abortRef.current?.();
    setPlayingId(word.id);
    const prev = audioIndexMap.get(word.id) ?? 0;
    const index = prev % urls.length;
    const abort = playAudioAtIndex(word.audioUrl, index, () => setPlayingId(null));
    abortRef.current = abort;
    const next = prev === 0 ? 1 : (prev % 3) + 1;
    setAudioIndexMap(new Map(audioIndexMap).set(word.id, next));
  };

  const mode = useMemo(() => sessionStorage.getItem("lb_mode") || "study", []);
  const wordBookId = useMemo(() => Number(sessionStorage.getItem("lb_wordbook_id") || 0), []);
  const wordNoteKey = (wordId: number) => `study-note:word:${wordBookId}:${wordId}`;

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(mode === "review" ? getReviewReturnPath("/word-training") : "/pre-training-check");
  };

  const batchIdx = useMemo(() => {
    const key = mode === "review" ? "lb_review_batch_idx" : "lb_study_batch_idx";
    return Number(sessionStorage.getItem(key) || 0);
  }, [mode]);

  const totalBatches = useMemo(() => {
    const wordsKey = mode === "review" ? "lb_review_words" : "lb_study_words";
    if (mode === "review") {
      try {
        const raw = sessionStorage.getItem(wordsKey) || "[]";
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

  useEffect(() => {
    try {
      const wordsKey = mode === "review" ? "lb_review_words" : "lb_study_words";
      const raw = sessionStorage.getItem(wordsKey) || "[]";
      const arr = JSON.parse(raw);
      const all: any[] = Array.isArray(arr) ? arr : [];
      const start = batchIdx * 5;
      const slice = all.slice(start, start + 5);

      const shuffledSlice = [...slice];
      for (let i = shuffledSlice.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledSlice[i], shuffledSlice[j]] = [shuffledSlice[j], shuffledSlice[i]];
      }

      const mapped: PracticeWord[] = shuffledSlice.map((w: any) => ({
        id: Number(w.id),
        word: String(w.word || ""),
        phonetic: pickPhoneticDisplay(w),
        translation: formatTranslation(w.translation),
        translationShort: formatTranslationShort(w.translation),
        audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
        count: 0,
        completed: false,
        showTranslation: false,
        heard: false,
      }));
      setWords(mapped);
      setCurrentIndex(0);
      setCardIndex(0);
      setFrameIdx(0);
    } catch {
      // ignore
    }
  }, [batchIdx, mode]);

  const sequence = useMemo(() => {
    const n = words.length;
    if (n <= 0) return [] as number[];
    const seq: number[] = [0];
    for (let i = 1; i < n; i++) {
      seq.push(i);
      for (let j = 0; j <= i; j++) seq.push(j);
    }
    return seq;
  }, [words]);

  const activeIndex = sequence.length > 0 ? sequence[Math.min(frameIdx, sequence.length - 1)] : 0;

  useEffect(() => {
    if (words.length === 0) return;
    setCurrentIndex(activeIndex);
  }, [activeIndex, words.length]);

  /** 点单词：第一次发音，第二次显示音标+释义；拓展仅在释义时增幅 */
  const handleWordTap = (word: PracticeWord) => {
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

  const handleCountClick = (id: number) => {
    const idx = words.findIndex((w) => w.id === id);
    if (idx !== activeIndex) return;

    if (sequence.length === 0) return;
    setWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, count: (w.count + 1) % 4 } : w))
    );
    if (frameIdx >= sequence.length - 1) {
      return;
    }
    setFrameIdx((f) => f + 1);
  };

  const handleShuffle = () => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWords(shuffled);
    setCurrentIndex(0);
    setCardIndex(0);
    setFrameIdx(0);
  };

  const handleNext = () => {
    navigate("/listen-identify");
  };

  const meaningText = (word: PracticeWord) =>
    fullMeaning ? word.translation || word.translationShort : word.translationShort || word.translation;

  const renderReveal = (word: PracticeWord) => {
    if (!word.showTranslation) return null;
    return (
      <div className="mt-1 space-y-1 animate-in fade-in">
        {word.phonetic ? (
          <div className="text-sm text-[#718096] font-mono">{word.phonetic}</div>
        ) : null}
        {meaningText(word) ? (
          <div className={PRACTICE_TRANS_CLASS}>{meaningText(word)}</div>
        ) : null}
        {(word.translation || word.translationShort) && (
          <button
            type="button"
            className="text-xs text-[#4ECDC4] hover:underline"
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

  if (words.length === 0 && mode === "review") {
    return (
      <FlowPageShell>
        <TopBar title="开始复习" onBack={handleBack} />
        <p className="text-center text-[#718096] py-16 px-4">暂无复习单词，请返回重新勾选</p>
      </FlowPageShell>
    );
  }

  const cardWord = words[Math.min(Math.max(0, cardIndex), Math.max(0, words.length - 1))];

  return (
    <FlowPageShell>
      <TopBar
        title={mode === "review" ? "开始复习" : "单词练习"}
        onBack={handleBack}
        rightSlot={
          <PracticeFlowToolbar
            annotationOpen={annotationOpen}
            onToggleAnnotation={() => setAnnotationOpen((v) => !v)}
            pauseContinueLabel="继续练习"
            wordCount={words.length}
          />
        }
      />

      <AnnotationLayer
        storageKey="word-practice"
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-6 max-w-2xl lg:max-w-5xl mx-auto w-full pb-28">
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
                className={`flex-1 bg-white border rounded-2xl shadow-sm px-5 py-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  !manualReadMode && words.findIndex((w) => w.id === cardWord.id) === currentIndex
                    ? "border-2 border-[#4ECDC4] bg-[#4ECDC4]/10"
                    : "border-[#E2E8F0]"
                }`}
                style={{ minHeight: "max(8rem, calc(var(--practice-word-size) * 6))" }}
                onClick={() => handleWordTap(cardWord)}
              >
                <p className="text-xs text-[#718096] mb-4">
                  {cardIndex + 1} / {words.length}
                </p>
                <div className={`${PRACTICE_WORD_CLASS} text-center break-all`}>{cardWord.word}</div>
                {renderReveal(cardWord)}
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
            {!manualReadMode && (
              <div className="flex items-center gap-2">
                <StudyNoteLauncher
                  storageKey={wordNoteKey(cardWord.id)}
                  title={`笔记 · ${cardWord.word}`}
                  label="笔记"
                  className="h-9 px-2"
                />
                {parseAudioUrls(cardWord.audioUrl).length > 0 && (
                  <CloudButton
                    variant={playingId === cardWord.id ? "mint" : "mintOutline"}
                    size="iconRound"
                    className="size-10 text-sm font-bold"
                    onClick={() => handlePlayNextAudio(cardWord)}
                  >
                    {audioIndexMap.get(cardWord.id) ?? 0}
                  </CloudButton>
                )}
                <CloudButton
                  variant={words.findIndex((w) => w.id === cardWord.id) === activeIndex ? "mint" : "ghost"}
                  size="iconRound"
                  className={`size-12 ${
                    words.findIndex((w) => w.id === cardWord.id) !== activeIndex ? "text-[#A0AEC0]" : ""
                  }`}
                  onClick={() => handleCountClick(cardWord.id)}
                >
                  <Check size={20} />
                </CloudButton>
              </div>
            )}
            {detailMode && cardWord.showTranslation && (
              <div className="w-full">
                <WordDetailPanel
                  wordId={cardWord.id}
                  wordText={cardWord.word}
                  variant="inline"
                  onClose={() => setDetailWord(null)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {words.map((word, index) => (
              <div
                key={word.id}
                className={`bg-white rounded-xl p-4 shadow-sm transition-all ${
                  !manualReadMode && index === currentIndex ? "bg-[#4ECDC4]/10 border-2 border-[#4ECDC4]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    onClick={() => handleWordTap(word)}
                    className="flex-1 cursor-pointer pr-3"
                  >
                    <div className={`${PRACTICE_WORD_CLASS} mb-1`}>{word.word}</div>
                    {renderReveal(word)}
                  </div>
                  {!manualReadMode && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div onClick={(e) => e.stopPropagation()}>
                        <StudyNoteLauncher
                          storageKey={wordNoteKey(word.id)}
                          title={`笔记 · ${word.word}`}
                          label="笔记"
                          className="h-9 px-2"
                        />
                      </div>
                      {parseAudioUrls(word.audioUrl).length > 0 && (
                        <CloudButton
                          variant={playingId === word.id ? "mint" : "mintOutline"}
                          size="iconRound"
                          className="size-10 text-sm font-bold"
                          onClick={() => handlePlayNextAudio(word)}
                        >
                          {audioIndexMap.get(word.id) ?? 0}
                        </CloudButton>
                      )}
                      <CloudButton
                        variant={index === activeIndex ? "mint" : "ghost"}
                        size="iconRound"
                        className={`size-12 ${index !== activeIndex ? "text-[#A0AEC0]" : ""}`}
                        onClick={() => handleCountClick(word.id)}
                      >
                        <Check size={20} />
                      </CloudButton>
                    </div>
                  )}
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

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="max-w-2xl lg:max-w-5xl mx-auto w-full flex items-center justify-between gap-2">
          <div className="flex gap-2 flex-wrap">
            <WordViewModeToggle mode={viewMode} onChange={setViewMode} />
            <CloudButton variant="outline" size="pill" onClick={handleShuffle}>
              <Shuffle size={16} />
              乱序
            </CloudButton>
            <CloudButton
              variant={manualReadMode ? "brand" : "outline"}
              size="pill"
              onClick={() => {
                setManualReadMode(!manualReadMode);
                setWords((prev) =>
                  prev.map((w) => ({ ...w, showTranslation: false, heard: false }))
                );
              }}
            >
              人工带读
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
          <div className="flex items-center gap-2 shrink-0">
            <StudyNoteLauncher
              storageKey={`study-note:global:${wordBookId}`}
              label="随心记"
              className="shrink-0"
            />
            <div className="w-16 shrink-0" aria-hidden="true" />
            <CloudButton variant="brand" size="iconRound" className="size-12 shrink-0" onClick={handleNext}>
            <ArrowRight size={24} />
          </CloudButton>
          </div>
        </div>
      </div>
    </FlowPageShell>
  );
}
