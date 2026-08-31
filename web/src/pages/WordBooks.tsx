import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  AlignJustify,
  BookOpen,
  ClipboardList,
  FileText,
  Library,
  MessageCircle,
  PenLine,
  Users,
} from "lucide-react";
import { HomeFeatureCard, HomeSectionHeader } from "../components/HomeFeatureCard";
import { CoachOnboarding } from "../components/CoachOnboarding";
import { MobileSelectSheet } from "../components/cloudsteps/MobileWheelPicker";
import { useAuthStore } from "../stores/authStore";
import { listAllTeacherCoachingQuotas, type TeacherCoachingQuotaRow } from "../api/coaching";
import {
  clearTrainingStudent,
  getTrainingStudent,
  setTrainingStudent,
  studentLabelFromQuota,
} from "../utils/trainingStudent";
import { shouldShowCoachOnboarding, setCoachOnboardingUiActive } from "../utils/coachOnboarding";
import { showToast } from "../utils/toast";

import { kickoffVocabTestPrefetch } from "../utils/vocabTestCache";
import { kickoffWordBooksPrefetch } from "../utils/wordBooksCache";

export default function WordBooks() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const role = user?.role || "user";
  const isCoach = role === "user" || role === "admin" || role === "teacher";
  const userId = user?.id ? Number(user.id) : 0;
  const [students, setStudents] = useState<TeacherCoachingQuotaRow[]>([]);
  const [studentId, setStudentId] = useState(() => String(getTrainingStudent()?.id || ""));
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!hasHydrated || !userId) return;
    const show = shouldShowCoachOnboarding(role, userId);
    setShowOnboarding(show);
    setCoachOnboardingUiActive(show);
  }, [hasHydrated, userId, role]);

  useEffect(() => {
    if (!isCoach) return;
    let mounted = true;
    setLoadingStudents(true);
    listAllTeacherCoachingQuotas({ includeSelf: true })
      .then((rows) => {
        if (!mounted) return;
        setStudents(rows);
        if (!rows.length) {
          clearTrainingStudent();
          setStudentId("");
          return;
        }
        const saved = getTrainingStudent();
        const selected = (saved?.id && rows.find((row) => row.studentId === saved.id)) || rows[0];
        if (selected) {
          setStudentId(String(selected.studentId));
          setTrainingStudent(String(selected.studentId), studentLabelFromQuota(selected));
        }
      })
      .catch(() => {
        if (mounted) setStudents([]);
      })
      .finally(() => {
        if (mounted) setLoadingStudents(false);
      });
    return () => {
      mounted = false;
    };
  }, [isCoach]);

  const studentOptions = useMemo(
    () => students.map((row) => ({ label: studentLabelFromQuota(row), value: String(row.studentId) })),
    [students],
  );

  const goVocabTest = () => {
    if (isCoach && !loadingStudents && students.length === 0) {
      showToast.info(t("home.add_student_first_vocab"));
      navigate("/my-students/new");
      return;
    }
    if (isCoach && !studentId) {
      showToast.info(t("home.select_student_first_vocab"));
      return;
    }
    kickoffVocabTestPrefetch();
    navigate("/vocabulary-test");
  };

  const goWordTraining = () => {
    if (isCoach && !loadingStudents && students.length === 0) {
      showToast.info(t("home.add_student_first_training"));
      navigate("/my-students/new");
      return;
    }
    kickoffWordBooksPrefetch();
    navigate("/word-training");
  };

  return (
    <div className="min-w-0 w-full space-y-5 pb-1">
      <section>
        <HomeSectionHeader title={t("home.common")}>
          {isCoach ? (
            <div
              className="flex shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-card/90 px-2.5 py-1.5 shadow-[var(--shadow-rest)]"
              data-coach="picker"
            >
              <span className="text-[11px] font-medium text-muted-foreground">{t("home.student")}</span>
              <MobileSelectSheet
                title={t("home.select_student")}
                className="w-36 shrink-0"
                style={{ minWidth: 144 }}
                size="small"
                placeholder={
                  loadingStudents
                    ? t("home.loading")
                    : studentOptions.length
                      ? t("home.select_student")
                      : t("home.no_students")
                }
                options={studentOptions}
                value={studentId || undefined}
                showSearch={studentOptions.length > 4}
                disabled={loadingStudents || studentOptions.length === 0}
                onChange={(value) => {
                  const row = students.find((item) => String(item.studentId) === value);
                  if (!row) return;
                  setStudentId(String(row.studentId));
                  setTrainingStudent(String(row.studentId), studentLabelFromQuota(row));
                }}
              />
            </div>
          ) : null}
        </HomeSectionHeader>

        <div className="grid grid-cols-2 gap-2.5">
          <HomeFeatureCard
            icon={FileText}
            accent="mint"
            title={t("home.vocab_test")}
            description={t("home.enter_test")}
            onClick={goVocabTest}
          />
          <HomeFeatureCard
            icon={BookOpen}
            accent="sky"
            title={t("home.word_training")}
            description={t("home.select_wordbook")}
            onClick={goWordTraining}
            data-coach="training"
          />
        </div>
      </section>

      <section>
        <HomeSectionHeader title={t("home.training_materials")} />
        <div className="grid grid-cols-2 gap-2.5">
          <HomeFeatureCard
            icon={PenLine}
            accent="violet"
            title={t("home.grammar")}
            description={t("home.grammar_desc")}
            onClick={() => navigate("/grammar-analysis")}
          />
          <HomeFeatureCard
            icon={BookOpen}
            accent="amber"
            title={t("home.reading")}
            description={t("home.reading_desc")}
            onClick={() => navigate("/reading-comprehension")}
          />
          <HomeFeatureCard
            icon={AlignJustify}
            accent="rose"
            title={t("home.cloze")}
            description={t("home.cloze_desc")}
            onClick={() => navigate("/cloze-practice")}
          />
          <HomeFeatureCard
            icon={MessageCircle}
            accent="teal"
            title={t("home.scenario")}
            description={t("home.scenario_desc")}
            onClick={() => navigate("/scenario-dialogues")}
          />
        </div>
      </section>

      <section>
        <HomeSectionHeader title={t("home.data_management")} />
        <div className="grid grid-cols-2 gap-2.5">
          <HomeFeatureCard
            icon={Library}
            accent="green"
            title={t("home.my_shelf")}
            description={t("home.browse_wordbook")}
            onClick={() => navigate("/word-books")}
          />
          {isCoach ? (
            <HomeFeatureCard
              icon={Users}
              accent="sky"
              title={t("home.student_management")}
              description={t("home.student_and_duration")}
              onClick={() => navigate("/my-students")}
              data-coach="students"
            />
          ) : null}
          <HomeFeatureCard
            icon={ClipboardList}
            accent="slate"
            title={t("home.study_records")}
            description={t("home.lessons_and_review")}
            onClick={() => navigate("/training-records")}
          />
        </div>
      </section>

      {userId > 0 ? (
        <CoachOnboarding
          open={showOnboarding}
          userId={userId}
          onDone={() => {
            setShowOnboarding(false);
            setCoachOnboardingUiActive(false);
          }}
        />
      ) : null}
    </div>
  );
}
