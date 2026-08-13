import { Pause, Shuffle, ArrowRight, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
import { PracticeFontSettingsButton, PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "../components/PracticeFontSettings";
import { CloudButton } from "../components/cloudsteps";
import { FlowPageShell } from "../components/PageTransition";
import { TopBar } from "../components/TopBar";
import { WordDetailPanel } from "../components/WordDetailPanel";
import { WordViewModeToggle, type WordViewMode } from "../components/WordMarkView";
import { playFirstWordAudio, playWordAudio, parseAudioUrls } from "../utils/audioPlayer";
import { formatTranslation, formatTranslationShort, pickPhoneticDisplay } from "../utils/wordFormat";
import { nextWordTapState } from "../utils/wordReveal";

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
  const [showPauseMenu, setShowPauseMenu] = useState(false);
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
    abortRef.current?.();
    setPlayingId(word.id);
    const abort = playWordAudio(word.audioUrl, 300, () => setPlayingId(null));
    abortRef.current = abort;
    const urls = parseAudioUrls(word.audioUrl);
    if (urls.length === 0) return;
    const prev = audioIndexMap.get(word.id) ?? 0;
    const next = prev >= urls.length ? 1 : prev + 1;
    setAudioIndexMap(new Map(audioIndexMap).set(word.id, next));
  };

  const mode = useMemo(() => sessionStorage.getItem("lb_mode") || "study", []);

  useEffect(() => {
    if (mode === "review") {
      const wordBookId = sessionStorage.getItem("lb_review_wordbook_id");
      if (wordBookId) {
        navigate(`/review-word-list?wordBookId=${wordBookId}`, { replace: true });
      } else {
        navigate("/anti-forgetting", { replace: true });
      }
    }
  }, [mode, navigate]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(mode === "review" ? "/anti-forgetting" : "/pre-training-check");
  };

  const batchIdx = useMemo(() => {
    const key = mode === "review" ? "lb_review_batch_idx" : "lb_study_batch_idx";
    return Number(sessionStorage.getItem(key) || 0);
  }, [mode]);

  const totalBatches = useMemo(() => {
    if (mode === "review") return 1;
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

  /** 点单词：第一次发音，第二次显示音标+释义 */
  const handleWordTap = (word: PracticeWord) => {
    if (detailMode) {
      setDetailWord((prev) =>
        prev?.id === word.id ? null : { id: word.id, word: word.word }
      );
      return;
    }
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
  };

  const handleCountClick = (id: number) => {
    const idx = words.findIndex((w) => w.id === id);
    if (idx !== activeIndex) return;

    if (sequence.length === 0) return;
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

  if (mode === "review") {
    return null;
  }

  const cardWord = words[Math.min(Math.max(0, cardIndex), Math.max(0, words.length - 1))];

  return (
    <FlowPageShell>
      <TopBar
        title={mode === "review" ? "开始复习" : "单词练习"}
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
        storageKey="word-practice"
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
                className={`flex-1 min-h-[220px] bg-white border rounded-2xl shadow-sm px-5 py-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  !manualReadMode && words.findIndex((w) => w.id === cardWord.id) === currentIndex
                    ? "border-2 border-[#4ECDC4] bg-[#4ECDC4]/10"
                    : "border-[#E2E8F0]"
                }`}
                onClick={() => handleWordTap(cardWord)}
              >
                <p className="text-xs text-[#718096] mb-4">
                  {cardIndex + 1} / {words.length}
                </p>
                <div className={`${PRACTICE_WORD_CLASS} !font-bold text-center break-all`}>{cardWord.word}</div>
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
                  className={`size-12 text-lg font-bold ${
                    words.findIndex((w) => w.id === cardWord.id) !== activeIndex ? "text-[#A0AEC0]" : ""
                  }`}
                  onClick={() => handleCountClick(cardWord.id)}
                >
                  ✓
                </CloudButton>
              </div>
            )}
            {detailMode && detailWord?.id === cardWord.id && (
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
                        className={`size-12 text-lg font-bold ${index !== activeIndex ? "text-[#A0AEC0]" : ""}`}
                        onClick={() => handleCountClick(word.id)}
                      >
                        ✓
                      </CloudButton>
                    </div>
                  )}
                </div>
                {detailMode && detailWord?.id === word.id && (
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
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-2">
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
          <CloudButton variant="brand" size="iconRound" className="size-12 shrink-0" onClick={handleNext}>
            <ArrowRight size={24} />
          </CloudButton>
        </div>
      </div>

      {showPauseMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-50"
          onClick={() => setShowPauseMenu(false)}
        >
          <div className="absolute top-20 right-4 bg-white rounded-xl shadow-lg overflow-hidden">
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto"
              onClick={() => {
                setShowPauseMenu(false);
                navigate("/word-training");
              }}
            >
              返回主页
            </CloudButton>
            <CloudButton
              variant="ghost"
              className="w-full justify-start rounded-none px-6 py-3 h-auto"
              onClick={() => setShowPauseMenu(false)}
            >
              继续练习
            </CloudButton>
          </div>
        </div>
      )}
    </FlowPageShell>
  );
}
