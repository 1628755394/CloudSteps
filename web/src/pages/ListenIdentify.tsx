import { CloudButton } from "../components/cloudsteps";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
import { ArrowLeft, Pause, ArrowRight, Volume2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { playFirstWordAudio } from "../utils/audioPlayer";
import { formatTranslation } from "../utils/wordFormat";

type ListenWord = {
  id: number;
  word: string;
  phonetic?: string;
  translation?: string;
  audioUrl?: string;
  /** idle=未听 / played=已发音 / revealed=已显示释义 */
  state: "idle" | "played" | "revealed";
};

export default function ListenIdentify() {
  const navigate = useNavigate();
  const [words, setWords] = useState<ListenWord[]>([]);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);

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

  const [playingId, setPlayingId] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(mode === "review" ? "/anti-forgetting" : "/word-practice");
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
        phonetic: w.phonetic ? String(w.phonetic) : "",
        translation: formatTranslation(w.translation),
        audioUrl: w.audioUrl ? String(w.audioUrl) : "",
        state: "idle",
      }));
      setWords(mapped);
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

  const handleCardClick = (id: number) => {
    setWords((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        if (w.state === "idle") {
          handlePlayFirstAudio(w);
          return { ...w, state: "played" };
        }
        if (w.state === "played") {
          return { ...w, state: "revealed" };
        }
        return { ...w, state: "idle" };
      })
    );
  };

  const allRevealed = words.length > 0 && words.every((w) => w.state === "revealed");

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部栏 */}
      <div className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="grid grid-cols-[2.5rem_1fr_auto] items-center px-4 py-4 gap-1">
          <CloudButton type="button" variant="ghost" size="iconRound" onClick={handleBack} className="-ml-2 justify-self-start">
            <ArrowLeft size={24} className="text-[#2D3748]" />
          </CloudButton>
          <h1 className="text-center text-lg font-semibold text-[#2D3748]">
            听音识词
          </h1>
          <div className="flex items-center justify-end gap-0.5 -mr-2">
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
              <Pause size={24} className="text-[#2D3748]" />
            </CloudButton>
          </div>
        </div>
      </div>

      <AnnotationLayer
        storageKey="listen-identify"
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-6">
        {/* 组信息 */}
        <div className="text-center text-sm text-[#718096] mb-6">{batchIdx + 1}/{totalBatches}组</div>

        {/* 单词列表 */}
        <div className="space-y-3 mb-6">
          {words.map((w) => {
            const showAnswer = w.state === "revealed";
            return (
              <div
                key={w.id}
                onClick={() => handleCardClick(w.id)}
                className={`bg-white rounded-xl p-4 shadow-sm transition-all cursor-pointer select-none ${
                  w.state === "revealed"
                    ? "border-2 border-[#66BB6A] bg-[#66BB6A]/5"
                    : w.state === "played"
                    ? "border-2 border-[#4ECDC4] bg-[#4ECDC4]/10"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      w.state === "revealed" ? "bg-[#66BB6A]/15" : w.state === "played" ? "bg-[#4ECDC4]/15" : "bg-gray-100"
                    }`}>
                      <Volume2 size={20} className={w.state === "revealed" ? "text-[#66BB6A]" : w.state === "played" ? "text-[#4ECDC4]" : "text-[#718096]"} />
                    </div>
                    <div>
                      {!showAnswer && (
                        <div className="text-sm text-[#718096]">
                          {w.state === "idle" ? "点击播放" : "再点显示答案"}
                        </div>
                      )}
                      {showAnswer && (
                        <>
                          <div className="text-base font-medium text-[#2D3748] mb-1">{w.word}</div>
                          <div className="text-sm text-[#718096]">{w.translation}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#718096]">全部完成后进入快闪</div>
          <CloudButton variant="brand" size="iconRound" className="size-12" onClick={() => navigate("/flash-review")}>
            <ArrowRight size={24} />
          </CloudButton>
        </div>
      </div>

      {/* 暂停菜单 */}
      {showPauseMenu && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowPauseMenu(false)}>
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
    </div>
  );
}
