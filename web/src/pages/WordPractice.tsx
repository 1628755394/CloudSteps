import { ArrowLeft, Pause, Shuffle, ArrowRight, BookOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
import { CloudButton } from "../components/cloudsteps";
import { FlowPageShell } from "../components/PageTransition";
import { FlowPageTitle } from "../components/PageTitle";
import { WordDetailDialog } from "../components/WordDetailDialog";
import { playFirstWordAudio, playWordAudio, parseAudioUrls } from "../utils/audioPlayer";
import { formatTranslation } from "../utils/wordFormat";
import { nextWordTapState } from "../utils/wordReveal";

type PracticeWord = {
  id: number;
  word: string;
  translation: string;
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
  const [finished, setFinished] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [detailMode, setDetailMode] = useState(false);
  const [detailWord, setDetailWord] = useState<{ id: number; word: string } | null>(null);
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
    // 默认显示 0；每次点击后在 1..n 间循环
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
      
      // 初始乱序（Fisher-Yates 洗牌算法）
      const shuffledSlice = [...slice];
      for (let i = shuffledSlice.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledSlice[i], shuffledSlice[j]] = [shuffledSlice[j], shuffledSlice[i]];
      }
      
      const mapped: PracticeWord[] = shuffledSlice.map((w: any) => ({
        id: Number(w.id),
        word: String(w.word || ""),
        translation: formatTranslation(w.translation),
        audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
        count: 0,
        completed: false,
        showTranslation: false,
        heard: false,
      }));
      setWords(mapped);
      setCurrentIndex(0);
      setFrameIdx(0);
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

  useEffect(() => {
    if (words.length === 0) return;
    setCurrentIndex(activeIndex);
  }, [activeIndex, words.length]);

  /** 点单词（非 123）：第一次发音，第二次显示释义 */
  const handleWordTap = (word: PracticeWord) => {
    if (detailMode) {
      setDetailWord({ id: word.id, word: word.word });
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

    // advance one frame in the fixed sequence
    if (sequence.length === 0) return;
    if (frameIdx >= sequence.length - 1) {
      setFinished(true);
      return;
    }
    setFrameIdx((f) => f + 1);
  };

  const handleShuffle = () => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWords(shuffled);
    setCurrentIndex(0);
    setFrameIdx(0);
    setFinished(false);
  };

  const handleNext = () => {
    // 普通训练：练习后进入听音辨义，不再经过「单词复习」页
    navigate("/listen-identify");
  };

  const allCompleted = finished;

  if (mode === "review") {
    return null;
  }

  return (
    <FlowPageShell>
      <div className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="grid grid-cols-[2.5rem_1fr_auto] items-center px-3 py-3 gap-1">
          <CloudButton
            type="button"
            variant="ghost"
            size="iconRound"
            onClick={handleBack}
            className="-ml-1 justify-self-start"
          >
            <ArrowLeft size={20} className="text-[#2D3748]" />
          </CloudButton>
          <FlowPageTitle>
            {mode === "review" ? "开始复习" : "单词练习"}
          </FlowPageTitle>
          <div className="flex items-center justify-end gap-0.5 -mr-1">
            <AnnotationToggleButton
              active={annotationOpen}
              onClick={() => setAnnotationOpen((v) => !v)}
            />
            <CloudButton
              type="button"
              variant="ghost"
              size="iconRound"
              onClick={() => setShowPauseMenu(!showPauseMenu)}
            >
              <Pause size={20} className="text-[#2D3748]" />
            </CloudButton>
          </div>
        </div>
      </div>

      <AnnotationLayer
        storageKey="word-practice"
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-6">
        {/* 组信息 */}
        <div className="text-center text-sm text-[#718096] mb-6">{batchIdx + 1}/{totalBatches}组</div>

        {/* 单词列表 */}
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
                  <div className="text-base font-medium text-[#2D3748] mb-1">{word.word}</div>
                  {word.showTranslation && (
                    <div className="text-sm text-[#718096]">{word.translation}</div>
                  )}
                </div>
                {/* 人工带读模式：不显示任何按钮，只靠点单词来发音/看意思 */}
                {!manualReadMode && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {parseAudioUrls(word.audioUrl).length > 0 && (
                      <CloudButton
                        variant={playingId === word.id ? "brand" : "brandOutline"}
                        size="iconRound"
                        className="size-10 text-sm font-bold"
                        onClick={() => handlePlayNextAudio(word)}
                      >
                        {(audioIndexMap.get(word.id) ?? 0)}
                      </CloudButton>
                    )}
                    <CloudButton
                      variant={index === activeIndex ? "brand" : "ghost"}
                      size="iconRound"
                      className={`size-12 text-lg font-bold ${index !== activeIndex ? "text-[#A0AEC0]" : ""}`}
                      onClick={() => handleCountClick(word.id)}
                    >
                      ✓
                    </CloudButton>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
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
            <CloudButton
              variant={detailMode ? "brand" : "outline"}
              size="pill"
              onClick={() => setDetailMode((v) => !v)}
            >
              <BookOpen size={16} />
              拓展
            </CloudButton>
          </div>
          <CloudButton variant="brand" size="iconRound" className="size-12" onClick={handleNext}>
            <ArrowRight size={24} />
          </CloudButton>
        </div>
      </div>

      <WordDetailDialog
        wordId={detailWord?.id ?? null}
        wordText={detailWord?.word}
        open={!!detailWord}
        onOpenChange={(open) => { if (!open) setDetailWord(null); }}
      />

      {/* 暂停菜单 */}
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

      {/* 右下角箭头按钮（仅在完成后显示） */}
    </FlowPageShell>
  );
}
