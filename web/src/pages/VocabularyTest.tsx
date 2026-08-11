import { CloudButton } from "../components/cloudsteps";
import { useNavigate } from "react-router";
import { ChevronLeft, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import {
  clearVocabTestResultCache,
  loadCachedVocabQuestions,
  prefetchVocabTestQuestions,
} from "../utils/vocabTestCache";

export default function VocabularyTest() {
  const navigate = useNavigate();
  const [preparing, setPreparing] = useState(() => !loadCachedVocabQuestions()?.length);

  useEffect(() => {
    prefetchVocabTestQuestions()
      .catch(() => {})
      .finally(() => setPreparing(false));
  }, []);

  return (
    <div className="relative h-dvh overflow-hidden bg-[#F7F9FC]">
      <header className="absolute top-0 left-0 right-0 z-10 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center h-11 px-3">
          <CloudButton type="button" variant="ghost" size="iconRound" onClick={() => navigate("/material-selection", { replace: true })} className="mr-2">
            <ChevronLeft size={20} className="text-[#2D3748]" />
          </CloudButton>
          <h2 className="text-sm font-medium text-[#718096]">词汇量测试</h2>
        </div>
      </header>

      <div className="h-full flex items-center justify-center px-6 pt-11 pb-6">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#2D3748] mb-1.5">测一测你的词汇量</h2>
            <p className="text-[#718096] text-xs leading-relaxed">
              花几分钟测试一下，定位你的词汇量水平
            </p>
          </div>

          <div className="mb-5 flex justify-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-[#4ECDC4]/10 to-[#55A3FF]/10 rounded-full flex items-center justify-center">
              <BookOpen className="w-9 h-9 sm:w-10 sm:h-10 text-[#4ECDC4]" />
            </div>
          </div>

          <CloudButton
            variant="brand"
            size="pillLg"
            className="w-full shadow-lg"
            loading={preparing}
            loadingText="准备题目…"
            onClick={() => {
              clearVocabTestResultCache();
              navigate("/vocabulary-test/testing");
            }}
          >
            开始测试
          </CloudButton>

          <p className="text-[#A0AEC0] text-xs mt-4">
            诚实做题可以得到真实的测试结果
          </p>
        </div>
      </div>
    </div>
  );
}
