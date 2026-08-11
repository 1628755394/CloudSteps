import { useMemo, useState, useEffect, useRef } from "react";
import { CloudButton } from "../components/cloudsteps";
import { useNavigate } from "react-router";
import { ChevronLeft, X, Volume2 } from "lucide-react";

import { submitVocabTest } from "../api/vocab";
import { playFirstWordAudio } from "../utils/audioPlayer";
import {
  clearVocabTestQuestionsCache,
  ensureVocabTestQuestions,
  type VocabTestQuestion,
} from "../utils/vocabTestCache";

type ApiQuestion = VocabTestQuestion;

type OptionItem = { label: string; value: string };

const WRONG_LIMIT = 5;

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
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [timer, setTimer] = useState(8);
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [questions, setQuestions] = useState<ApiQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: number; answer: string }[]>([]);
  const answersRef = useRef<{ questionId: number; answer: string }[]>([]);

  const currentQuestion = questions[currentIndex] ?? null;

  const wordDisplayClass = useMemo(() => {
    if (!currentQuestion?.word) return "text-lg";
    const len = currentQuestion.word.length;
    if (len <= 8) return "text-lg sm:text-xl";
    if (len <= 14) return "text-base sm:text-lg";
    if (len <= 22) return "text-sm sm:text-base";
    return "text-sm";
  }, [currentQuestion?.word]);

  const abortAudioRef = useRef<(() => void) | null>(null);

  const handlePlayAudio = () => {
    if (!currentQuestion?.audioUrl || loading || submitting) return;
    abortAudioRef.current?.();
    abortAudioRef.current = playFirstWordAudio(currentQuestion.audioUrl);
  };

  // 进入新题后自动播放发音（经 resolveMediaUrl，相对路径/代理域名可播）
  useEffect(() => {
    if (!currentQuestion?.audioUrl || loading || submitting) return;
    abortAudioRef.current?.();
    abortAudioRef.current = playFirstWordAudio(currentQuestion.audioUrl);
    return () => {
      abortAudioRef.current?.();
      abortAudioRef.current = null;
    };
  }, [currentQuestion?.id, currentQuestion?.audioUrl, loading, submitting]);

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
  }, [currentQuestion]);

  const progress = questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;

  useEffect(() => {
    if (timer > 0 && !submitting) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
    if (timer === 0) {
      setShowWarning(true);
    }
  }, [timer, submitting]);

  const submitAndGoResult = async (payloadAnswers: { questionId: number; answer: string }[]) => {
    if (!payloadAnswers.length) {
      throw new Error("答案不能为空");
    }
    const res = await submitVocabTest({ answers: payloadAnswers });
    if (res.code !== 200) throw new Error(res.msg || "提交失败");
    clearVocabTestQuestionsCache();
    sessionStorage.setItem("vocabulary_test_result", JSON.stringify(res.data));
    navigate("/vocabulary-test/result", { replace: true });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await ensureVocabTestQuestions();
        if (mounted) setQuestions(list);
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "加载题目失败");
        navigate("/vocabulary-test", { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleAnswerSelect = async (value: string) => {
    if (!currentQuestion || loading || submitting) return;
    setSelectedAnswer(value);

    const isUnknown = value === "不认识";
    const isCorrect = !isUnknown && value === currentQuestion.correctAnswer;
    if (isCorrect) setCorrectCount((prev) => prev + 1);
    if (!isCorrect) setWrongCount((prev) => prev + 1);

    const qid = currentQuestion.id;
    const nextAnswers = [...answers, { questionId: qid, answer: value }];
    setAnswers(nextAnswers);
    answersRef.current = nextAnswers;

    const nextWrongCount = wrongCount + (isCorrect ? 0 : 1);
    const nextIndex = currentIndex + 1;
    const shouldFinish = nextWrongCount > WRONG_LIMIT || nextIndex >= questions.length;

    if (shouldFinish) {
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

    setCurrentIndex(nextIndex);
    setSelectedAnswer(null);
    setTimer(8);
    setShowWarning(false);
  };

  const busy = loading || submitting;

  return (
    <div className="h-dvh flex flex-col bg-[#F7F9FC] overflow-hidden">
      <header className="shrink-0 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center h-11 px-3">
          <CloudButton type="button" variant="ghost" size="iconRound" onClick={() => navigate("/material-selection", { replace: true })} className="mr-2">
            <ChevronLeft size={20} className="text-[#2D3748]" />
          </CloudButton>
          <h1 className="text-sm font-medium text-[#718096]">词汇量测试</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-3 py-2 max-w-lg mx-auto w-full">
        <div className="shrink-0 flex items-center gap-2 mb-2">
          <div className="text-[#4ECDC4] text-sm font-semibold tabular-nums">
            {questions.length > 0
              ? `${String(currentIndex + 1).padStart(2, "0")}/${questions.length}`
              : "--"}
          </div>
          <div className="flex-1 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4ECDC4] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <CloudButton type="button" variant="ghost" size="iconRound" onClick={() => navigate("/material-selection", { replace: true })}>
            <X size={20} className="text-[#718096]" />
          </CloudButton>
        </div>

        {showWarning && !busy && (
          <p className="shrink-0 text-center text-[11px] text-amber-600 mb-1">
            超过 8 秒，建议选「不认识」
          </p>
        )}

        <div className="shrink-0 bg-white rounded-xl px-3 py-3 mb-2 text-center shadow-sm border border-[#E2E8F0]/80">
          <div className="flex flex-col items-center justify-center gap-1.5 min-h-[56px]">
            {busy || !currentQuestion ? (
              <p className="text-[#A0AEC0] text-xs animate-pulse">加载中…</p>
            ) : (
              <>
                <p
                  className={`${wordDisplayClass} font-semibold text-[#2D3748] leading-tight break-words [overflow-wrap:anywhere] max-w-full line-clamp-3`}
                >
                  {currentQuestion.word}
                </p>
                {currentQuestion.audioUrl && (
                  <CloudButton type="button" variant="ghost" size="iconRound" onClick={handlePlayAudio}>
                    <Volume2 size={18} className="text-[#55A3FF]" />
                  </CloudButton>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col justify-center gap-1.5 py-1">
          {options.map((option, index) => (
            <CloudButton
              key={index}
              variant={option.label === "不认识" ? "secondary" : "outline"}
              className={`w-full justify-start px-3 py-2.5 h-auto min-h-[2.5rem] max-h-[3.5rem] rounded-lg text-left whitespace-normal ${
                selectedAnswer === option.value ? "ring-2 ring-[#4ECDC4] bg-[#4ECDC4]/10" : ""
              } ${busy ? "opacity-60 pointer-events-none" : ""}`}
              onClick={() => handleAnswerSelect(option.value)}
              disabled={busy || !currentQuestion}
            >
              <span className="text-[13px] leading-snug break-words [overflow-wrap:anywhere] w-full line-clamp-2">
                {option.label}
              </span>
            </CloudButton>
          ))}
        </div>
      </main>

      <footer className="shrink-0 bg-white border-t border-[#E2E8F0] py-2 px-4">
        <div className="flex items-center justify-around max-w-lg mx-auto">
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
