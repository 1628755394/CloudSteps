import { ArrowLeft, Volume2, Check, X, Shuffle, BookOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { CloudButton } from "@/components/cloudsteps";
import { FlowPageShell } from "@/components/PageTransition";
import { FlowPageTitle } from "@/components/PageTitle";

import { completeReviewSession, startReviewSession } from "@/api/review";

type ReviewWord = { id: number; word: string; status: null | "correct" | "wrong" };

type StartReviewData = {
  sessionId?: number;
  words?: Array<{ id: number; word: string }>;
  finished?: boolean;
};

export default function ReviewCheck() {
  const navigate = useNavigate();
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [loading, setLoading] = useState(true);
  /** 无词可复习时后端返回 finished + msg */
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/anti-forgetting");
  };

  const wordBookId = useMemo(() => Number(sessionStorage.getItem("lb_wordbook_id") || 0), []);
  const [sessionId, setSessionId] = useState<number>(0);

  useEffect(() => {
    sessionStorage.setItem("lb_mode", "review");
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setEmptyMessage(null);
      setLoadError(null);
      try {
        const res = await startReviewSession({ wordBookId });
        if (!mounted) return;

        const data = res.data as StartReviewData | undefined;
        if (res.code === 200 && data?.finished) {
          setSessionId(0);
          setWords([]);
          setEmptyMessage(res.msg || "今日无待复习单词");
          return;
        }

        const sid = Number(data?.sessionId || 0);
        const ws = Array.isArray(data?.words) ? data!.words! : [];
        setSessionId(sid);
        setWords(ws.map((w) => ({ id: w.id, word: w.word, status: null })));
        if (ws.length === 0 && !data?.finished) {
          setEmptyMessage(res.msg || "暂无可复习内容");
        }
      } catch (e: unknown) {
        const msg = e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载失败";
        if (mounted) setLoadError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [wordBookId]);

  const handleStatusClick = (id: number, newStatus: "correct" | "wrong") => {
    setWords((prev) =>
      prev.map((word) => {
        if (word.id === id) {
          return { ...word, status: word.status === newStatus ? null : newStatus };
        }
        return word;
      })
    );
  };

  const handleShuffle = () => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWords(shuffled);
  };

  const handleSelectAll = () => {
    const allSelected = words.every((word) => word.status !== null);
    if (allSelected) {
      setWords(words.map((word) => ({ ...word, status: null })));
    } else {
      setWords(words.map((word) => ({ ...word, status: "correct" })));
    }
  };

  const handleSubmit = () => {
    const marked = words.filter((word) => word.status !== null);
    if (marked.length === 0) return;
    (async () => {
      try {
        if (sessionId) {
          await completeReviewSession(
            sessionId,
            marked.map((w) => ({ wordId: w.id, remembered: w.status === "correct" }))
          );
        }
        sessionStorage.removeItem("lb_review_batch_idx");
        sessionStorage.removeItem("lb_review_results");
        navigate("/anti-forgetting", { replace: true });
      } catch {
        // ignore
      }
    })();
  };

  const correctCount = words.filter((word) => word.status === "correct").length;
  const wrongCount = words.filter((word) => word.status === "wrong").length;

  const showList = !loading && !loadError && !emptyMessage && words.length > 0;

  return (
    <FlowPageShell>
      <div className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center px-3 py-3">
          <CloudButton
            type="button"
            variant="ghost"
            size="iconRound"
            onClick={handleBack}
            className="justify-self-start"
            aria-label="返回"
          >
            <ArrowLeft size={20} className="text-[#2D3748]" />
          </CloudButton>
          <FlowPageTitle>开始复习</FlowPageTitle>
          <span className="w-10" aria-hidden />
        </div>
      </div>

      <div className="px-4 mt-6">
        {loading && (
          <p className="text-center text-[#718096] py-12">加载中…</p>
        )}

        {loadError && (
          <div className="rounded-xl bg-white border border-[#E2E8F0] p-6 text-center space-y-4">
            <p className="text-[#FF6B6B]">{loadError}</p>
            <CloudButton type="button" variant="brand" size="pill" onClick={handleBack}>
              返回
            </CloudButton>
          </div>
        )}

        {!loading && !loadError && emptyMessage && (
          <div className="rounded-xl bg-white border border-[#E2E8F0] p-8 text-center space-y-4 shadow-sm">
            <BookOpen className="mx-auto text-[#4ECDC4]" size={40} />
            <p className="text-[#2D3748] font-medium">{emptyMessage}</p>
            <p className="text-sm text-[#718096]">当前词库没有到期的复习任务，可先进行单词训练或改日再来。</p>
            <CloudButton
              type="button"
              variant="brand"
              size="pill"
              className="w-full max-w-xs mx-auto"
              onClick={() => navigate("/anti-forgetting")}
            >
              返回抗遗忘
            </CloudButton>
          </div>
        )}

        {showList && (
          <>
        {/* 提示文字 */}
        <p className="text-center text-[#718096] mb-4">
          当前共有 {words.length} 个可选单词
        </p>

        {/* 单词列表 */}
        <div className="space-y-3 mb-6">
          {words.map((word) => (
            <div
              key={word.id}
              className={`bg-white rounded-xl p-4 flex items-center justify-between shadow-sm transition-all ${
                word.status === "correct"
                  ? "border-2 border-[#66BB6A] bg-[#66BB6A]/5"
                  : word.status === "wrong"
                  ? "border-2 border-[#FF6B6B] bg-[#FF6B6B]/5"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-base font-medium text-[#2D3748]">{word.word}</span>
              </div>
              <div className="flex items-center gap-3">
                <CloudButton type="button" variant="ghost" size="iconRound">
                  <Volume2 size={20} className="text-[#4ECDC4]" />
                </CloudButton>
                <CloudButton
                  type="button"
                  variant={word.status === "correct" ? "brand" : "ghost"}
                  size="iconRound"
                  onClick={() => handleStatusClick(word.id, "correct")}
                  className={word.status === "correct" ? "bg-[#66BB6A] hover:bg-[#66BB6A]/90" : ""}
                >
                  <Check size={20} />
                </CloudButton>
                <CloudButton
                  type="button"
                  variant={word.status === "wrong" ? "destructive" : "ghost"}
                  size="iconRound"
                  onClick={() => handleStatusClick(word.id, "wrong")}
                >
                  <X size={20} />
                </CloudButton>
              </div>
            </div>
          ))}
        </div>
          </>
        )}
      </div>

      {/* 底部栏：无列表时不挡操作，有列表时固定底部 */}
      {showList && (
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-[#718096]">
            已选择 <span className="text-[#4ECDC4] font-semibold">{correctCount + wrongCount}</span> ·
            错误 <span className="text-[#FF6B6B] font-semibold">{wrongCount}</span>
          </div>
          <div className="flex gap-2">
            <CloudButton variant="outline" size="pill" onClick={handleShuffle}>
              <Shuffle size={16} />
              乱序
            </CloudButton>
            <CloudButton variant="outline" size="pill" onClick={handleSelectAll}>
              全选
            </CloudButton>
          </div>
        </div>
        <CloudButton
          variant="brand"
          size="pill"
          className="w-full"
          onClick={handleSubmit}
          disabled={correctCount + wrongCount === 0}
        >
          完成复习
        </CloudButton>
      </div>
      )}
    </FlowPageShell>
  );
}
