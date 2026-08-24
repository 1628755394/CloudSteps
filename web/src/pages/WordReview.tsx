import { CloudButton } from "../components/cloudsteps";
import { AnnotationLayer } from "../components/AnnotationLayer";
import { PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "../components/PracticeFontSettings";
import { PracticeFlowToolbar } from "../components/PracticeFlowToolbar";
import { SequenceNextMark } from "../components/SequenceNextMark";
import { TopBar } from "../components/TopBar";
import { Shuffle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { playFirstWordAudio, playWordAudio, parseAudioUrls, WORD_AUDIO_SLOT_COUNT } from "../utils/audioPlayer";
import { formatTranslation } from "../utils/wordFormat";
import { nextWordTapState } from "../utils/wordReveal";

type ReviewWord = {
  id: number;
  word: string;
  translation: string;
  audioUrl?: string;
  count: number;
  showTranslation: boolean;
  heard: boolean;
};

export default function WordReview() {
  const navigate = useNavigate();
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [manualReadMode, setManualReadMode] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [touchedIds, setTouchedIds] = useState<Set<number>>(new Set());
  const [playingId, setPlayingId] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [finished, setFinished] = useState(false);

  const [audioIndexMap, setAudioIndexMap] = useState<Map<number, number>>(new Map());

  const handlePlayNextAudio = (word: ReviewWord) => {
    if (!word.audioUrl) return;
    abortRef.current?.();
    setPlayingId(word.id);
    const abort = playWordAudio(word.audioUrl, 300, () => setPlayingId(null));
    abortRef.current = abort;
    const urls = parseAudioUrls(word.audioUrl);
    if (urls.length === 0) return;
    const prev = audioIndexMap.get(word.id) ?? 0;
    const next = prev >= Math.min(urls.length, WORD_AUDIO_SLOT_COUNT) ? 1 : prev + 1;
    setAudioIndexMap(new Map(audioIndexMap).set(word.id, next));
  };

  const mode = useMemo(() => sessionStorage.getItem("lb_mode") || "study", []);

  // 本页已废弃：训练与复习均走 word-practice 链路
  useEffect(() => {
    navigate("/word-practice", { replace: true });
  }, [navigate]);

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

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/word-practice");
  };

  useEffect(() => {
    try {
      const wordsKey = mode === "review" ? "lb_review_words" : "lb_study_words";
      const raw = sessionStorage.getItem(wordsKey) || "[]";
      const arr = JSON.parse(raw);
      const all: any[] = Array.isArray(arr) ? arr : [];
      const start = batchIdx * 5;
      const slice = all.slice(start, start + 5);
      const mapped: ReviewWord[] = slice.map((w: any) => ({
        id: Number(w.id),
        word: String(w.word || ""),
        translation: formatTranslation(w.translation),
        audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
        count: 0,
        showTranslation: false,
        heard: false,
      }));
      setWords(mapped);
      setTouchedIds(new Set());
      setFrameIdx(0);
      setSelectedIndex(0);
      setFinished(false);
    } catch {
      // ignore
    }
  }, [batchIdx, mode]);

  // LinguaStart memorize sequence: 1,2,1,2,3,1,2,3,4,1,2,3,4,5 (0-based)
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
  const nextGuideIndex =
    frameIdx + 1 < sequence.length ? sequence[frameIdx + 1] : -1;

  const handleCountClick = (id: number) => {
    const idx = words.findIndex((w) => w.id === id);
    if (idx !== activeIndex) return;
    if (sequence.length === 0) return;
    setWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, count: w.count + 1 } : w))
    );
    if (frameIdx >= sequence.length - 1) {
      setFinished(true);
      return;
    }
    setFrameIdx((f) => f + 1);
  };

  const handleWordTap = (word: ReviewWord) => {
    const idx = words.findIndex((w) => w.id === word.id);
    if (idx >= 0) setSelectedIndex(idx);
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
    setTouchedIds((prev) => new Set(prev).add(word.id));
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

  const handleShuffle = () => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWords(shuffled);
    setFrameIdx(0);
    setSelectedIndex(0);
    setFinished(false);
  };

  const handleNext = () => {
    navigate("/listen-identify");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <TopBar
        title="单词复习"
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
        storageKey="word-review"
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-6 max-w-2xl mx-auto w-full pb-28">
        <div className="text-center text-sm text-[#718096] mb-6">{batchIdx + 1}/{totalBatches}组</div>

        <div className="space-y-3 mb-6">
          {words.map((word, index) => (
            <div
              key={word.id}
              className={`relative bg-white rounded-xl p-4 pl-5 shadow-sm transition-all border-2 ${
                !manualReadMode && index === activeIndex
                  ? "bg-[#4ECDC4]/10 border-[#4ECDC4]"
                  : "border-transparent"
              }`}
            >
              <SequenceNextMark
                show={!manualReadMode && nextGuideIndex >= 0 && index === nextGuideIndex}
              />
              <div className="flex items-center justify-between">
                <div
                  onClick={() => handleWordTap(word)}
                  className="flex-1 cursor-pointer pr-3"
                >
                  <div className={`${PRACTICE_WORD_CLASS} mb-1`}>{word.word}</div>
                  {word.showTranslation && (
                    <div className={PRACTICE_TRANS_CLASS}>{word.translation}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!manualReadMode && (
                    <>
                      {parseAudioUrls(word.audioUrl).length > 0 && (
                        <CloudButton
                          variant={playingId === word.id ? "brand" : "brandOutline"}
                          size="iconRound"
                          className="size-10 text-sm font-bold"
                          onClick={() => handlePlayNextAudio(word)}
                        >
                          {(audioIndexMap.get(word.id) ?? 0) || ""}
                        </CloudButton>
                      )}
                      <CloudButton
                        variant={index === activeIndex ? "brand" : "ghost"}
                        size="iconRound"
                        className={`size-12 text-lg font-bold ${index !== activeIndex ? "text-[#A0AEC0]" : ""}`}
                        onClick={() => handleCountClick(word.id)}
                      >
                        {word.count || ""}
                      </CloudButton>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <div className="flex gap-2">
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
          </div>
          <CloudButton variant="brand" size="iconRound" className="size-12" onClick={handleNext}>
            <ArrowRight size={24} />
          </CloudButton>
        </div>
      </div>
    </div>
  );
}
