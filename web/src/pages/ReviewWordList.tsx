import { useNavigate } from "react-router";
import { ChevronLeft, Volume2, Check, X } from "lucide-react";
import { completeReviewSession } from "../api/review";
import { useEffect, useMemo, useRef, useState } from "react";
import { getReviewToday, startReviewSession } from "../api/review";
import { playFirstWordAudio, playWordAudio } from "../utils/audioPlayer";
import { CloudButton } from "../components/cloudsteps";
import { FlowPageShell } from "../components/PageTransition";
import { FlowPageTitle } from "../components/PageTitle";

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
    setHint(null);
    setWords((prev) =>
      prev.map((word) => {
        if (word.id !== id) return word;
        // 同一按钮再点保持选中，避免误取消导致无法结束
        if (word.status === newStatus) return word;
        return { ...word, status: newStatus };
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
      setHint("请至少为一个单词选择 ✓ 或 × 后再完成复习");
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

        const results = markedWords.map((w) => ({
          wordId: w.id,
          remembered: w.status === "correct",
        }));
        await completeReviewSession(sid, results);

        sessionStorage.removeItem("lb_review_batch_idx");
        sessionStorage.removeItem("lb_review_results");
        navigate("/anti-forgetting");
      } catch {
        setHint("提交失败，请稍后重试");
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const correctCount = words.filter((word) => word.status === "correct").length;
  const wrongCount = words.filter((word) => word.status === "wrong").length;

  return (
    <FlowPageShell className="min-h-screen bg-[#F7F9FC] pb-32">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#E2E8F0]">
        <div className="grid grid-cols-[2.5rem_1fr] items-center h-14 px-3">
          <CloudButton type="button" variant="ghost" size="iconRound" onClick={handleBack} className="justify-self-start">
            <ChevronLeft size={20} className="text-[#2D3748]" />
          </CloudButton>
          <FlowPageTitle className="text-left">开始复习</FlowPageTitle>
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
                  <CloudButton
                    type="button"
                    variant="ghost"
                    size="iconRound"
                    onClick={() => handlePlayAudio(item)}
                    className={playingId === item.id ? "text-[#4ECDC4]" : "text-[#55A3FF]"}
                  >
                    <Volume2 size={24} className={playingId === item.id ? "animate-pulse" : ""} />
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant={item.status === "correct" ? "brand" : "ghost"}
                    size="iconRound"
                    onClick={() => handleStatusClick(item.id, "correct")}
                    className={item.status === "correct" ? "bg-[#66BB6A] hover:bg-[#66BB6A]/90" : ""}
                  >
                    <Check size={20} />
                  </CloudButton>
                  <CloudButton
                    type="button"
                    variant={item.status === "wrong" ? "destructive" : "ghost"}
                    size="iconRound"
                    onClick={() => handleStatusClick(item.id, "wrong")}
                  >
                    <X size={20} />
                  </CloudButton>
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
            <CloudButton
              variant="brand"
              size="sm"
              onClick={() => setShowGroupMenu(!showGroupMenu)}
            >
              {selectedGroup}
            </CloudButton>
            {showGroupMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg overflow-hidden">
                {reviewGroups.map((group) => (
                  <CloudButton
                    key={group}
                    variant="ghost"
                    className={`w-full justify-start rounded-none px-4 py-3 h-auto ${
                      selectedGroup === group ? "bg-[#4ECDC4]/10 text-[#4ECDC4]" : "text-[#2D3748]"
                    }`}
                    onClick={() => {
                      setSelectedGroup(group);
                      setShowGroupMenu(false);
                    }}
                  >
                    {group}
                  </CloudButton>
                ))}
              </div>
            )}
          </div>

          {/* 统计信息 */}
          <div className="text-sm text-[#718096]">
            正确 <span className="text-[#66BB6A] font-semibold">{correctCount}</span> ·
            错误 <span className="text-[#FF6B6B] font-semibold">{wrongCount}</span>
          </div>

          <CloudButton
            type="button"
            variant="brand"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
            loadingText="提交中…"
            className={markedCount === 0 && words.length > 0 ? "opacity-80" : ""}
          >
            完成复习
            {markedCount > 0 ? ` (${markedCount})` : ""}
          </CloudButton>
        </div>
        {hint && (
          <p className="text-center text-xs text-amber-600 mt-2 px-1 animate-in fade-in">
            {hint}
          </p>
        )}
        {!hint && markedCount === 0 && words.length > 0 && (
          <p className="text-center text-xs text-[#A0AEC0] mt-2">
            选几个交几个，未选的词今天仍可继续复习
          </p>
        )}
      </div>
    </FlowPageShell>
  );
}
