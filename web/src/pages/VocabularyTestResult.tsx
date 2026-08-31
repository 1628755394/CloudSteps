import { useEffect, useMemo, useState } from "react";
import { CloudButton } from "../components/cloudsteps";
import { useNavigate, useSearchParams } from "react-router";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getVocabResult } from "../api/vocab";
import { getStudentVocabRecordAsTeacher } from "../api/coaching";
import {
  clearVocabTestResultCache,
  refreshVocabTestQuestions,
} from "../utils/vocabTestCache";
import {
  VocabTestResultView,
  type VocabTestResultPayload,
} from "../components/VocabTestResultView";
import { TopBar } from "../components/TopBar";
import { isValidSnowflakeId, normalizeSnowflakeId } from "../utils/json-snowflake";

function normalizeVocabResult(raw: any): VocabTestResultPayload | null {
  const data = raw?.record || raw;
  if (!data) return null;

  const estimatedVocab = Number(data.estimatedVocab);
  const correctCount = Number(data.correctCount);
  const totalCount = Number(data.totalCount ?? data.questionCount);
  if (!data.level && !data.estimatedLevel && !Number.isFinite(estimatedVocab)) return null;

  return {
    level: String(data.level ?? data.estimatedLevel ?? ""),
    estimatedVocab: Number.isFinite(estimatedVocab) ? estimatedVocab : 0,
    correctCount: Number.isFinite(correctCount) ? correctCount : 0,
    totalCount: Number.isFinite(totalCount) ? totalCount : 0,
  };
}

export default function VocabularyTestResult() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentId = normalizeSnowflakeId(searchParams.get("studentId"));
  const recordId = normalizeSnowflakeId(searchParams.get("recordId"));
  const isHistory = isValidSnowflakeId(studentId) && isValidSnowflakeId(recordId);
  const [result, setResult] = useState<VocabTestResultPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setResult(null);
        if (isHistory) {
          const res = await getStudentVocabRecordAsTeacher(studentId, recordId);
          if (!mounted) return;
          if (res.code === 200) {
            setResult(normalizeVocabResult(res.data));
          }
          return;
        }

        const cached = sessionStorage.getItem("vocabulary_test_result");
        if (cached) {
          const parsed = normalizeVocabResult(JSON.parse(cached));
          if (parsed) {
            if (mounted) setResult(parsed);
            return;
          }
          sessionStorage.removeItem("vocabulary_test_result");
        }

        const res = await getVocabResult();
        if (res.code === 200) {
          const mapped = normalizeVocabResult(res.data);
          if (mounted && mapped) setResult(mapped);
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
  }, [isHistory, studentId, recordId]);

  useEffect(() => {
    if (!result || isHistory) return;
    refreshVocabTestQuestions().catch(() => {});
  }, [result, isHistory]);

  const hasResult = useMemo(() => Boolean(result), [result]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else if (isHistory) navigate(`/my-students/${studentId}?tab=vocab`);
    else navigate("/");
  };

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-gray-50 pb-20">
      <TopBar title={t("vocab_test.result_title")} onBack={handleBack} />

      <div className="px-4 sm:px-6 mt-6">
        {loading ? (
          <div className="max-w-3xl mx-auto text-center text-[#718096] py-16">
            {t("vocab_test.result_loading")}
          </div>
        ) : !hasResult || !result ? (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6 sm:p-8 text-center shadow-sm border border-[#E2E8F0]">
            <div className="text-[#2D3748] font-semibold text-base">{t("vocab_test.no_result")}</div>
            <div className="text-[#718096] text-sm mt-2">
              {isHistory ? t("vocab_test.history_not_found") : t("vocab_test.go_test_hint")}
            </div>
            <CloudButton
              variant="brand"
              size="pill"
              className="mt-6 w-full"
              onClick={() => (isHistory ? handleBack() : navigate("/vocabulary-test"))}
            >
              {isHistory ? t("vocab_test.back") : t("vocab_test.go_test")}
            </CloudButton>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto min-w-0 space-y-4">
            <VocabTestResultView result={result} />

            {isHistory ? (
              <CloudButton variant="outline" size="pill" className="w-full" onClick={handleBack}>
                {t("vocab_test.back")}
              </CloudButton>
            ) : (
              <>
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
                    {t("vocab_test.retake")}
                  </CloudButton>
                  <CloudButton variant="outline" size="pill" className="flex-1" onClick={handleBack}>
                    {t("vocab_test.back")}
                  </CloudButton>
                </div>

                <CloudButton
                  variant="outline"
                  size="pill"
                  className="w-full"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="w-4 h-4" /> {t("vocab_test.refresh_result")}
                </CloudButton>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
