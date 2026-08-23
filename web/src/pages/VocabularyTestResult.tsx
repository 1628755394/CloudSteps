import { useEffect, useMemo, useState } from "react";
import { CloudButton } from "../components/cloudsteps";
import { useNavigate } from "react-router";
import { ChevronLeft, RefreshCw } from "lucide-react";

import { getVocabResult } from "../api/vocab";
import {
  clearVocabTestResultCache,
  refreshVocabTestQuestions,
} from "../utils/vocabTestCache";
import {
  VocabTestResultView,
  type VocabTestResultPayload,
} from "../components/VocabTestResultView";

export default function VocabularyTestResult() {
  const navigate = useNavigate();
  const [result, setResult] = useState<VocabTestResultPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const cached = sessionStorage.getItem("vocabulary_test_result");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (mounted) setResult(parsed);
          return;
        }

        const res = await getVocabResult();
        if (res.code === 200) {
          const r = res.data?.record;
          if (r) {
            const mapped: VocabTestResultPayload = {
              level: r.estimatedLevel,
              estimatedVocab: r.estimatedVocab,
              correctCount: r.correctCount,
              totalCount: r.questionCount,
            };
            if (mounted) setResult(mapped);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!result) return;
    refreshVocabTestQuestions().catch(() => {});
  }, [result]);

  const hasResult = useMemo(() => Boolean(result), [result]);

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#F7F9FC] pb-20">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center h-11 w-full max-w-6xl mx-auto px-3">
          <CloudButton
            type="button"
            variant="ghost"
            size="iconRound"
            onClick={() => navigate("/material-selection", { replace: true })}
            className="mr-2"
          >
            <ChevronLeft size={18} className="text-[#2D3748]" />
          </CloudButton>
          <span className="text-sm font-semibold text-[#2D3748]">测试结果</span>
        </div>
      </div>

      <div className="pt-14 px-4 sm:px-6">
        {loading ? (
          <div className="max-w-3xl mx-auto text-center text-[#718096] py-16">
            结果加载中...
          </div>
        ) : !hasResult || !result ? (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6 sm:p-8 text-center shadow-sm border border-[#E2E8F0]">
            <div className="text-[#2D3748] font-semibold text-base">暂无测试结果</div>
            <div className="text-[#718096] text-sm mt-2">去开始一次词汇量测试吧</div>
            <CloudButton
              variant="brand"
              size="pill"
              className="mt-6 w-full"
              onClick={() => navigate("/material-selection", { replace: true })}
            >
              返回资料选择
            </CloudButton>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto min-w-0 space-y-4">
            <VocabTestResultView result={result} />

            <div className="flex flex-col sm:flex-row gap-3">
              <CloudButton
                variant="brand"
                size="pill"
                className="flex-1"
                onClick={() => {
                  clearVocabTestResultCache();
                  navigate("/vocabulary-test/testing", { replace: true });
                }}
              >
                重新测试
              </CloudButton>
              <CloudButton
                variant="outline"
                size="pill"
                className="flex-1"
                onClick={() => navigate("/material-selection", { replace: true })}
              >
                返回资料选择
              </CloudButton>
            </div>

            <CloudButton
              variant="outline"
              size="pill"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4" /> 刷新结果
            </CloudButton>
          </div>
        )}
      </div>
    </div>
  );
}
