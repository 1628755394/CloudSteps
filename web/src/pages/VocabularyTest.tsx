import { CloudButton } from "../components/cloudsteps";
import { useNavigate } from "react-router";
import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  clearVocabTestResultCache,
  loadCachedVocabQuestions,
  prefetchVocabTestQuestions,
} from "../utils/vocabTestCache";
import { useAuthStore } from "../stores/authStore";
import { getTrainingStudent } from "../utils/trainingStudent";
import { showToast } from "../utils/toast";
import { FlowPageShell } from "../components/PageTransition";
import { TopBar } from "../components/TopBar";

export default function VocabularyTest() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user)?.role || "user";
  const isCoach = role === "user" || role === "admin" || role === "teacher";
  const boundStudent = isCoach ? getTrainingStudent() : null;
  const [preparing, setPreparing] = useState(() => !loadCachedVocabQuestions()?.length);

  useEffect(() => {
    prefetchVocabTestQuestions()
      .catch(() => {})
      .finally(() => setPreparing(false));
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const handleStart = () => {
    if (isCoach && !boundStudent?.id) {
      showToast.info(t("vocab_test.select_student_first"));
      navigate("/", { replace: true });
      return;
    }
    clearVocabTestResultCache();
    navigate("/vocabulary-test/testing");
  };

  return (
    <FlowPageShell className="min-h-dvh bg-gray-50">
      <TopBar title={t("vocab_test.title")} onBack={handleBack} />

      <div className="flex min-h-[calc(100dvh-2.75rem)] w-full min-w-0 items-center justify-center px-4 sm:px-6 py-6">
        <div className="w-full max-w-md min-w-0 flex flex-col items-center text-center">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#2D3748] mb-1.5">{t("vocab_test.measure_your_vocab")}</h2>
            <p className="text-[#718096] text-xs leading-relaxed">
              {boundStudent?.name
                ? t("vocab_test.desc_with_student", { name: boundStudent.name })
                : t("vocab_test.desc")}
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
            loadingText={t("vocab_test.preparing")}
            onClick={handleStart}
          >
            {t("vocab_test.start")}
          </CloudButton>

          <p className="text-[#A0AEC0] text-xs mt-4">
            {t("vocab_test.honest_tip")}
          </p>
        </div>
      </div>
    </FlowPageShell>
  );
}
