import { useNavigate } from "react-router";
import { ChevronLeft, Volume2, Check, X } from "lucide-react";
import { completeReviewSession } from "@/api/review";
import { useEffect, useMemo, useRef, useState } from "react";
import { getReviewToday, startReviewSession } from "@/api/review";
import { playFirstWordAudio, playWordAudio } from "@/utils/audioPlayer";

type ReviewWordItem = { 
  id: number; 
  word: string; 
  translation?: string;
  audioUrl?: string;
  status: null | "correct" | "wrong";
  showTranslation?: boolean;
};

const reviewGroups = ["今日复习"];

export default function ReviewWordList() {
  const navigate = useNavigate();
  const [words, setWords] = useState<ReviewWordItem[]>([]);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(reviewGroups[0]);

  const wordBookId = useMemo(() => {
    const url = new URL(window.location.href);
    const qp = Number(url.searchParams.get("wordBookId") || 0);
    if (qp) return qp;
    return Number(sessionStorage.getItem("lb_review_wordbook_id") || 0);
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
        const res = await getReviewToday(wordBookId);
        const ws = Array.isArray(res.data?.words) ? (res.data.words as Array<{ id: number; word: string; translation?: string }>) : [];
        const mapped: ReviewWordItem[] = ws.map((w: any) => ({ 
          id: Number(w.id), 
          word: String(w.word || ""), 
          translation: w.translation ? String(w.translation) : undefined,
          audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
          status: null,
          showTranslation: false
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
  }, [wordBookId]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/anti-forgetting");
  };

  const handleStatusClick = (id: number, newStatus: "correct" | "wrong") => {
    setWords((prev) =>
      prev.map((word) => {
        if (word.id !== id) return word;
        return { ...word, status: word.status === newStatus ? null : newStatus };
      })
    );
  };

  const handleWordClick = (item: ReviewWordItem) => {
    const id = item.id;
    if (item.audioUrl) {
      abortRef.current?.();
      setPlayingId(item.id);
      const abort = playFirstWordAudio(item.audioUrl, () => setPlayingId(null));
      abortRef.current = abort;
    }
    setWords((prev) =>
      prev.map((word) => (word.id === id ? { ...word, showTranslation: !word.showTranslation } : word))
    );
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    const marked = words.filter((w) => w.status !== null);
    if (marked.length === 0) return;

    (async () => {
      setSubmitting(true);
      try {
        const wordIds = marked.map((w) => w.id);
        const res = await startReviewSession({ wordBookId, wordIds });
        const sid = Number(res.data?.sessionId || 0);
        if (!sid) {
          handleBack();
          return;
        }

        const results = marked.map((w) => ({
          wordId: w.id,
          remembered: w.status === "correct",
        }));
        await completeReviewSession(sid, results);

        sessionStorage.removeItem("lb_review_batch_idx");
        sessionStorage.removeItem("lb_review_results");
        navigate("/anti-forgetting");
      } catch {
        // ignore
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const correctCount = words.filter((word) => word.status === "correct").length;
  const wrongCount = words.filter((word) => word.status === "wrong").length;

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-32">
      {/* 顶部导航 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center h-14 px-4">
          <button onClick={handleBack} className="mr-4">
            <ChevronLeft size={24} className="text-[#2D3748]" />
          </button>
          <h1 className="text-lg font-semibold text-[#2D3748]">开始复习</h1>
        </div>
      </div>

      {/* 主内容 */}
      <div className="pt-14 px-4 py-6">
        {/* 标题信息 */}
        <div className="mb-6">
          <p className="text-[#718096] text-sm mb-3">
            当前共有 {words.length} 个可选单词
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4ECDC4]" />
            <p className="text-[#2D3748] font-medium">
              {selectedGroup}
            </p>
          </div>
        </div>

        {/* 单词列表 */}
        <div className="space-y-3">
          {words.map((item, index) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl p-4 shadow-sm transition-all ${
                item.status === "correct"
                  ? "border-2 border-[#66BB6A] bg-[#66BB6A]/5"
                  : item.status === "wrong"
                  ? "border-2 border-[#FF6B6B] bg-[#FF6B6B]/5"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <span className="text-[#A0AEC0] text-sm mt-1">
                    {index + 1}
                  </span>
                  <div className="flex-1 cursor-pointer" onClick={() => handleWordClick(item)}>
                    <h3 className="text-2xl font-semibold text-[#2D3748] hover:text-[#4ECDC4] transition-colors">
                      {item.word}
                    </h3>
                    {item.showTranslation && item.translation && (
                      <p className="text-[#718096] text-sm mt-2 animate-in fade-in slide-in-from-top-1">
                        {item.translation}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlayAudio(item)}
                    className={`p-2 transition-colors ${playingId === item.id ? "text-[#4ECDC4]" : "text-[#55A3FF] hover:text-[#4ECDC4]"}`}
                  >
                    <Volume2 size={24} className={playingId === item.id ? "animate-pulse" : ""} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusClick(item.id, "correct")}
                    className={`p-2 rounded-full transition-colors ${
                      item.status === "correct"
                        ? "bg-[#66BB6A] text-white"
                        : "hover:bg-gray-100 text-[#718096]"
                    }`}
                  >
                    <Check size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusClick(item.id, "wrong")}
                    className={`p-2 rounded-full transition-colors ${
                      item.status === "wrong"
                        ? "bg-[#FF6B6B] text-white"
                        : "hover:bg-gray-100 text-[#718096]"
                    }`}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          {/* 左下角选择复习组按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowGroupMenu(!showGroupMenu)}
              className="px-4 py-2 bg-[#4ECDC4] text-white rounded-lg hover:bg-[#45b8b0] transition-colors text-sm"
            >
              {selectedGroup}
            </button>
            {showGroupMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg overflow-hidden">
                {reviewGroups.map((group) => (
                  <button
                    key={group}
                    onClick={() => {
                      setSelectedGroup(group);
                      setShowGroupMenu(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedGroup === group ? "bg-[#4ECDC4]/10 text-[#4ECDC4]" : "text-[#2D3748]"
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 统计信息 */}
          <div className="text-sm text-[#718096]">
            正确 <span className="text-[#66BB6A] font-semibold">{correctCount}</span> ·
            错误 <span className="text-[#FF6B6B] font-semibold">{wrongCount}</span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={correctCount + wrongCount === 0 || submitting}
            className="px-6 py-2 bg-[#4ECDC4] text-white rounded-lg hover:bg-[#45b8b0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "提交中…" : "完成复习"}
          </button>
        </div>
      </div>
    </div>
  );
}
