import { ArrowLeft, Volume2, Check, X, Shuffle, BookOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { AnnotationLayer, AnnotationToggleButton } from "../components/AnnotationLayer";
import { PracticeFontSettingsButton, PRACTICE_WORD_CLASS } from "../components/PracticeFontSettings";
import { CloudButton } from "../components/cloudsteps";
import { FlowPageShell } from "../components/PageTransition";
import { FlowPageTitle } from "../components/PageTitle";
import {
  WordCardPanel,
  WordMarkStatsBar,
  WordViewModeToggle,
  type WordViewMode,
} from "../components/WordMarkView";
import { WordDetailPanel } from "../components/WordDetailPanel";

import { startReviewSession } from "../api/review";
import { nextWordTapState, syncDetailWordWithTap } from "../utils/wordReveal";
import { beginReviewPractice, type ReviewPracticeWord } from "../utils/reviewPractice";

type ReviewWord = {
  id: number;
  word: string;
  phonetic?: string;
  phoneticUk?: string;
  phoneticUs?: string;
  translation?: string;
  audioUrl?: string;
  showTranslation?: boolean;
  heard?: boolean;
  status: null | "correct" | "wrong";
};

type StartReviewData = {
  sessionId?: number;
  words?: ReviewPracticeWord[];
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
    else navigate("/word-training");
  };

  const wordBookId = useMemo(() => Number(sessionStorage.getItem("lb_wordbook_id") || 0), []);
  const [sessionId, setSessionId] = useState<number>(0);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [viewMode, setViewMode] = useState<WordViewMode>("list");
  const [cardIndex, setCardIndex] = useState(0);
  const [detailMode, setDetailMode] = useState(false);
  const [detailWord, setDetailWord] = useState<{ id: number; word: string } | null>(null);

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
        setWords(
          ws.map((w) => ({
            id: Number(w.id),
            word: String(w.word || ""),
            phonetic: w.phonetic ? String(w.phonetic) : undefined,
            phoneticUk: w.phoneticUk ? String(w.phoneticUk) : undefined,
            phoneticUs: w.phoneticUs ? String(w.phoneticUs) : undefined,
            translation: w.translation ? String(w.translation) : undefined,
            audioUrl: w.audioUrl ? String(w.audioUrl) : undefined,
            status: null,
          }))
        );
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
        if (word.id !== id) return word;
        if (word.status === newStatus) return word;
        return { ...word, status: newStatus };
      })
    );
  };

  const handleWordClick = (word: ReviewWord) => {
    const next = nextWordTapState({
      showTranslation: !!word.showTranslation,
      heard: !!word.heard,
    });
    if (next.shouldPlay && word.audioUrl) {
      // 有音频时按同一节奏发音
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

  const handlePlayAudio = (_word: ReviewWord) => {
    // ReviewCheck 当前无音频源
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

  const markedWords = words.filter((w) => w.status !== null);
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const handleSubmit = () => {
    if (submitting) return;
    if (markedWords.length === 0) {
      setHint("请至少为一个单词选择 ✓ 或 × 后再开始学习");
      return;
    }
    if (!sessionId) {
      setHint("复习会话未就绪，请返回重进");
      return;
    }
    setHint(null);
    setSubmitting(true);
    try {
      // 与课前检测一致：勾选后进入练习链路；最终对错在组内/训后检测提交
      const practiceWords: ReviewPracticeWord[] = markedWords.map((w) => ({
        id: w.id,
        word: w.word,
        phonetic: w.phonetic,
        phoneticUk: w.phoneticUk,
        phoneticUs: w.phoneticUs,
        translation: w.translation,
        audioUrl: w.audioUrl,
      }));
      beginReviewPractice({
        sessionId,
        wordBookId,
        words: practiceWords,
        returnPath: "/word-training",
      });
      navigate("/word-practice", { replace: true });
    } catch {
      setHint("无法开始学习，请稍后重试");
      setSubmitting(false);
    }
  };

  const correctCount = words.filter((word) => word.status === "correct").length;
  const wrongCount = words.filter((word) => word.status === "wrong").length;

  const showList = !loading && !loadError && !emptyMessage && words.length > 0;

  return (
    <FlowPageShell>
      <div className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="grid grid-cols-[2.5rem_1fr_auto] items-center px-3 py-3 gap-1">
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
          <div className="flex items-center justify-end gap-0.5">
            {showList && (
              <AnnotationToggleButton
                active={annotationOpen}
                onClick={() => setAnnotationOpen((v) => !v)}
              />
            )}
            <PracticeFontSettingsButton />
          </div>
        </div>
      </div>

      <AnnotationLayer
        storageKey={`review-check:${wordBookId}:${sessionId}`}
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
      />

      <div className="px-4 mt-4 pb-36 max-w-2xl mx-auto w-full">
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
              onClick={handleBack}
            >
              返回
            </CloudButton>
          </div>
        )}

        {showList && (
          <>
            <p className="text-center text-[#718096] mb-4">
              当前共有 {words.length} 个可选单词
            </p>
            <WordMarkStatsBar
              correctCount={correctCount}
              wrongCount={wrongCount}
              total={words.length}
            />
            {viewMode === "card" ? (
              <WordCardPanel
                words={words}
                index={cardIndex}
                onIndexChange={setCardIndex}
                playingId={null}
                onPlay={handlePlayAudio}
                onWordClick={handleWordClick}
                onStatus={handleStatusClick}
                amplifyDetail={detailMode}
                onDetailClose={() => setDetailWord(null)}
              />
            ) : (
              <div className="space-y-3 mb-6">
                {words.map((word) => (
                  <div
                    key={word.id}
                    className={`bg-white rounded-xl p-4 shadow-sm transition-all ${
                      word.status === "correct"
                        ? "border-2 border-[#66BB6A] bg-[#66BB6A]/5"
                        : word.status === "wrong"
                        ? "border-2 border-[#FF6B6B] bg-[#FF6B6B]/5"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => handleWordClick(word)}
                      >
                        <span className={PRACTICE_WORD_CLASS}>{word.word}</span>
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
          </>
        )}
      </div>

      {showList && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E2E8F0] px-4 py-4 shadow-lg">
          <div className="max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <WordViewModeToggle mode={viewMode} onChange={setViewMode} />
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
            className={`w-full ${markedWords.length === 0 ? "opacity-80" : ""}`}
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
            loadingText="准备中…"
          >
            开始学习
            {markedWords.length > 0 ? ` (${markedWords.length})` : ""}
          </CloudButton>
          {hint && (
            <p className="text-center text-xs text-amber-600 mt-2">{hint}</p>
          )}
          {!hint && markedWords.length === 0 && (
            <p className="text-center text-xs text-[#A0AEC0] mt-2">
              先勾选要复习的词，再进入跟课前检测一样的练习流程
            </p>
          )}
          </div>
        </div>
      )}
    </FlowPageShell>
  );
}
