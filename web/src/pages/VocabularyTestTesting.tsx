import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { CloudButton } from "../components/cloudsteps";
import { useNavigate } from "react-router";
import { X, Volume2 } from "lucide-react";
import { TopBar } from "../components/TopBar";

import { submitVocabTest } from "../api/vocab";
import { playFirstWordAudio } from "../utils/audioPlayer";
import { getTrainingStudent } from "../utils/trainingStudent";
import {
  clearVocabTestQuestionsCache,
  ensureVocabTestQuestions,
  type VocabTestQuestion,
} from "../utils/vocabTestCache";

type ApiQuestion = VocabTestQuestion;

type OptionItem = { label: string; value: string };

const TOTAL_QUESTIONS = 40;
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1"] as const;
const REVEAL_DELAY_MS = 900;

const parseOptions = (options: string): string[] => {
  try {
    const arr = JSON.parse(options);
    return Array.isArray(arr) ? arr.map((s) => String(s)) : [];
  } catch {
    return [];
  }
};

export default function VocabularyTestTesting() {
  const navigate = useNavigate();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [timer, setTimer] = useState(8);
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 题池按等级分组
  const [poolByLevel, setPoolByLevel] = useState<Record<string, ApiQuestion[]>>({});
  // 已使用的题目 ID 集合
  const usedIdsRef = useRef<Set<number | string>>(new Set());
  // 当前题
  const [currentQuestion, setCurrentQuestion] = useState<ApiQuestion | null>(null);
  // 当前等级索引
  const levelIndexRef = useRef(0);
  // 答案列表（用于触发重渲染）
  const [, setAnswersTick] = useState(0);
  // 已答数
  const answeredCountRef = useRef(0);
  // 答案列表
  const answersRef = useRef<{ questionId: number | string; answer: string }[]>([]);

  const wordDisplayClass = useMemo(() => {
    if (!currentQuestion?.word) return "text-2xl sm:text-3xl";
    const len = currentQuestion.word.length;
    if (len <= 8) return "text-3xl sm:text-4xl";
    if (len <= 14) return "text-2xl sm:text-3xl";
    if (len <= 22) return "text-xl sm:text-2xl";
    return "text-lg sm:text-xl";
  }, [currentQuestion?.word]);

  const abortAudioRef = useRef<(() => void) | null>(null);

  const handlePlayAudio = () => {
    if (!currentQuestion?.audioUrl || loading || submitting) return;
    abortAudioRef.current?.();
    abortAudioRef.current = playFirstWordAudio(currentQuestion.audioUrl);
  };

  // 切题时停掉上一题音频（不自动播放，避免累积 WebMediaPlayer 超限）
  useEffect(() => {
    abortAudioRef.current?.();
    abortAudioRef.current = null;
    return () => {
      abortAudioRef.current?.();
      abortAudioRef.current = null;
    };
  }, [currentQuestion?.id]);

  const options: OptionItem[] = useMemo(() => {
    if (!currentQuestion) return [];
    const opts = parseOptions(currentQuestion.options);
    const shuffledOptions = [...opts];
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }
    return shuffledOptions
      .map((label) => ({ label, value: label }))
      .concat([{ label: "不认识", value: "不认识" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id]);

  const progress = answeredCountRef.current > 0
    ? Math.round((answeredCountRef.current / TOTAL_QUESTIONS) * 100)
    : 0;

  useEffect(() => {
    if (timer > 0 && !submitting && !revealed) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
    if (timer === 0) {
      setShowWarning(true);
    }
  }, [timer, submitting, revealed]);

  const submitAndGoResult = async (payloadAnswers: { questionId: number | string; answer: string }[]) => {
    if (!payloadAnswers.length) {
      throw new Error("答案不能为空");
    }
    const studentId = getTrainingStudent()?.id;
    const res = await submitVocabTest({
      answers: payloadAnswers,
      ...(studentId ? { studentId } : {}),
    });
    if (res.code !== 200) throw new Error(res.msg || "提交失败");
    clearVocabTestQuestionsCache();
    sessionStorage.setItem("vocabulary_test_result", JSON.stringify(res.data));
    navigate("/vocabulary-test/result", { replace: true });
  };

  // 从指定等级取一道未用过的题
  const pickQuestionFromLevel = useCallback((level: string): ApiQuestion | null => {
    const pool = poolByLevel[level];
    if (!pool || pool.length === 0) return null;
    for (const q of pool) {
      if (!usedIdsRef.current.has(q.id)) {
        usedIdsRef.current.add(q.id);
        return q;
      }
    }
    return null;
  }, [poolByLevel]);

  // 取下一题（自适应）
  const pickNextQuestion = useCallback((wasCorrect: boolean | null): ApiQuestion | null => {
    // wasCorrect=null 表示第一题
    if (wasCorrect !== null) {
      if (wasCorrect) {
        // 答对 → 升一级
        levelIndexRef.current = Math.min(levelIndexRef.current + 1, LEVEL_ORDER.length - 1);
      } else {
        // 答错 → 降一级
        levelIndexRef.current = Math.max(levelIndexRef.current - 1, 0);
      }
    }
    // 从当前等级取题，取不到则尝试相邻等级
    const tried = new Set<string>();
    let idx = levelIndexRef.current;
    // 先尝试当前及更高等级
    for (let i = idx; i < LEVEL_ORDER.length; i++) {
      const lv = LEVEL_ORDER[i];
      if (tried.has(lv)) continue;
      tried.add(lv);
      const q = pickQuestionFromLevel(lv);
      if (q) {
        levelIndexRef.current = i;
        return q;
      }
    }
    // 再尝试更低等级
    for (let i = idx - 1; i >= 0; i--) {
      const lv = LEVEL_ORDER[i];
      if (tried.has(lv)) continue;
      tried.add(lv);
      const q = pickQuestionFromLevel(lv);
      if (q) {
        levelIndexRef.current = i;
        return q;
      }
    }
    return null;
  }, [pickQuestionFromLevel]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await ensureVocabTestQuestions();
        if (!mounted) return;
        // 按等级分组
        const byLevel: Record<string, ApiQuestion[]> = {};
        for (const q of list) {
          const lv = q.level || "A1";
          if (!byLevel[lv]) byLevel[lv] = [];
          byLevel[lv].push(q);
        }
        setPoolByLevel(byLevel);
        // 取第一题（从 A1 开始）—— 直接用局部变量 byLevel，不依赖 state（state 更新是异步的）
        levelIndexRef.current = 0;
        const pickFirst = (lv: string): ApiQuestion | null => {
          const pool = byLevel[lv];
          if (!pool || pool.length === 0) return null;
          const q = pool[0];
          usedIdsRef.current.add(q.id);
          return q;
        };
        const first = pickFirst("A1") || pickFirst("A2") || pickFirst("B1") || pickFirst("B2") || pickFirst("C1");
        if (first) {
          setCurrentQuestion(first);
        } else {
          throw new Error("题库暂无题目");
        }
      } catch (e) {
        console.error("加载题目失败:", e);
        const msg = e instanceof Error ? e.message : (e as any)?.msg || "加载题目失败";
        alert(msg);
        navigate("/vocabulary-test", { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate, pickQuestionFromLevel]);

  const handleAnswerSelect = async (value: string) => {
    if (!currentQuestion || loading || submitting || revealed) return;
    setSelectedAnswer(value);
    setRevealed(true);

    const isUnknown = value === "不认识";
    const isCorrect = !isUnknown && value === currentQuestion.correctAnswer;
    if (isCorrect) setCorrectCount((prev) => prev + 1);
    if (!isCorrect) setWrongCount((prev) => prev + 1);

    const qid = currentQuestion.id;
    const nextAnswers = [...answersRef.current, { questionId: qid, answer: value }];
    answersRef.current = nextAnswers;
    answeredCountRef.current += 1;
    // 触发 progress 重渲染
    setAnswersTick((n) => n + 1);

    const isFinished = answeredCountRef.current >= TOTAL_QUESTIONS;

    if (isFinished) {
      // 停顿展示对错颜色后再提交
      await new Promise((r) => setTimeout(r, REVEAL_DELAY_MS));
      try {
        setSubmitting(true);
        await submitAndGoResult(nextAnswers);
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "提交失败");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 停顿展示对错颜色后切下一题（自适应难度）
    setTimeout(() => {
      const next = pickNextQuestion(isCorrect);
      if (!next) {
        // 题池耗尽，直接提交
        setSubmitting(true);
        submitAndGoResult(nextAnswers).catch((e) => {
          console.error(e);
          alert(e instanceof Error ? e.message : "提交失败");
        }).finally(() => setSubmitting(false));
        return;
      }
      setCurrentQuestion(next);
      setSelectedAnswer(null);
      setRevealed(false);
      setTimer(8);
      setShowWarning(false);
    }, REVEAL_DELAY_MS);
  };

  const busy = loading || submitting;

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/vocabulary-test");
  };

  const answeredCount = answeredCountRef.current;

  return (
    <div className="h-dvh w-full min-w-0 flex flex-col bg-gray-50 overflow-hidden">
      <TopBar title="词汇量测试" onBack={handleBack} />

      <main className="flex-1 min-h-0 w-full min-w-0 overflow-y-auto overflow-x-hidden flex flex-col px-4 py-3 max-w-6xl mx-auto">
        <div className="shrink-0 flex items-center gap-2 mb-3 max-w-5xl mx-auto w-full min-w-0">
          <div className="text-[#4ECDC4] text-sm font-semibold tabular-nums">
            {answeredCount > 0
              ? `${String(answeredCount).padStart(2, "0")}/${TOTAL_QUESTIONS}`
              : "--"}
          </div>
          <div className="flex-1 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4ECDC4] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <CloudButton type="button" variant="ghost" size="iconRound" onClick={handleBack} aria-label="退出测试">
            <X size={20} className="text-[#718096]" />
          </CloudButton>
        </div>

        {showWarning && !busy && (
          <p className="shrink-0 text-center text-[11px] text-amber-600 mb-2 max-w-5xl mx-auto w-full min-w-0">
            超过 8 秒，建议选「不认识」
          </p>
        )}

        <div className="shrink-0 w-full max-w-5xl min-w-0 mx-auto bg-white rounded-2xl px-4 sm:px-6 py-6 mb-3 text-center shadow-sm border border-[#E2E8F0]/80">
          <div className="flex flex-col items-center justify-center gap-2 min-h-[88px]">
            {busy || !currentQuestion ? (
              <p className="text-[#A0AEC0] text-sm animate-pulse">加载中…</p>
            ) : (
              <>
                <p
                  className={`${wordDisplayClass} font-semibold text-[#2D3748] leading-tight break-words [overflow-wrap:anywhere] max-w-full`}
                >
                  {currentQuestion.word}
                </p>
                {currentQuestion.audioUrl && (
                  <CloudButton type="button" variant="ghost" size="iconRound" onClick={handlePlayAudio}>
                    <Volume2 size={20} className="text-[#55A3FF]" />
                  </CloudButton>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col justify-center gap-2 py-1 max-w-5xl mx-auto w-full min-w-0">
          {options.map((option, index) => {
            const isCorrectOpt = option.value === currentQuestion?.correctAnswer;
            const isSelected = selectedAnswer === option.value;
            let revealClass = "";
            if (revealed && isCorrectOpt) {
              revealClass = "bg-green-100 border-green-400 text-green-700";
            } else if (revealed && isSelected && !isCorrectOpt) {
              revealClass = "bg-red-100 border-red-400 text-red-700";
            } else if (revealed) {
              revealClass = "opacity-50";
            }
            return (
              <CloudButton
                key={index}
                variant={option.label === "不认识" ? "secondary" : "outline"}
                className={`w-full justify-start px-4 py-3 h-auto min-h-[3rem] max-h-[4.5rem] rounded-xl text-left whitespace-normal border ${revealClass} ${
                  !revealed && isSelected ? "ring-2 ring-[#4ECDC4] bg-[#4ECDC4]/10" : ""
                } ${busy || revealed ? "pointer-events-none" : ""}`}
                onClick={() => handleAnswerSelect(option.value)}
                disabled={busy || !currentQuestion || revealed}
              >
                <span className="text-sm leading-snug break-words [overflow-wrap:anywhere] w-full line-clamp-2">
                  {option.label}
                </span>
              </CloudButton>
            );
          })}
        </div>
      </main>

      <footer className="shrink-0 bg-white border-t border-[#E2E8F0] py-2.5 px-4">
        <div className="flex items-center justify-around max-w-5xl mx-auto w-full min-w-0">
          <div className="text-center">
            <div className="text-base font-bold text-[#2D3748]">{correctCount}</div>
            <div className="text-[11px] text-[#718096]">正确</div>
          </div>
          <div className="w-px h-7 bg-[#E2E8F0]" />
          <div className="text-center">
            <div className="text-base font-bold text-[#2D3748]">{wrongCount}</div>
            <div className="text-[11px] text-[#718096]">错误</div>
          </div>
          <div className="w-px h-7 bg-[#E2E8F0]" />
          <div className="text-center">
            <div className="text-base font-bold text-[#4ECDC4]">{timer}s</div>
            <div className="text-[11px] text-[#718096]">倒计时</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
