import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { BookOpen, ChevronRight, ClipboardList, FileText, Library, Users } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CoachOnboarding } from "../components/CoachOnboarding";
import { CloudCard } from "../components/cloudsteps/arco";
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
          setTrainingStudent(selected.studentId, studentLabelFromQuota(selected));
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
    [students]
  );

  return (
    <div className="space-y-4 min-w-0 w-full">
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium text-muted-foreground shrink-0">常用</h2>
          {isCoach ? (
            <div
              className="flex items-center gap-2 shrink-0"
              data-coach="picker"
            >
              <span className="text-xs text-muted-foreground">学员</span>
              <MobileSelectSheet
                title="选择学员"
                className="w-44 shrink-0"
                style={{ minWidth: 176 }}
                placeholder={
                  loadingStudents ? "加载中…" : studentOptions.length ? "选择学员" : "暂无学员"
                }
                options={studentOptions}
                value={studentId || undefined}
                showSearch={studentOptions.length > 4}
                disabled={loadingStudents || studentOptions.length === 0}
                onChange={(value) => {
                  const row = students.find((item) => String(item.studentId) === value);
                  if (!row) return;
                  setStudentId(String(row.studentId));
                  setTrainingStudent(row.studentId, studentLabelFromQuota(row));
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <CloudButton
            type="button"
            variant="card"
            onClick={() => {
              if (isCoach && !loadingStudents && students.length === 0) {
                showToast.info("请先添加学员后再开始词汇测试");
                navigate("/my-students/new");
                return;
              }
              if (isCoach && !studentId) {
                showToast.info("请先选择学员后再开始词汇测试");
                return;
              }
              kickoffVocabTestPrefetch();
              navigate("/vocabulary-test");
            }}
            className="!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5"
          >
            <div className="w-8 h-8 shrink-0 bg-primary-soft rounded-xl flex items-center justify-center">
              <FileText className="text-primary" size={16} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-sm font-semibold leading-snug">词汇测试</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">进入测评</p>
            </div>
          </CloudButton>

          <CloudButton
            type="button"
            variant="card"
            data-coach="training"
            onClick={() => {
              if (isCoach && !loadingStudents && students.length === 0) {
                showToast.info("请先添加学员后再开始单词训练");
                navigate("/my-students/new");
                return;
              }
              kickoffWordBooksPrefetch();
              navigate("/word-training");
            }}
            className="!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5"
          >
            <div className="w-8 h-8 shrink-0 bg-tint-sky rounded-xl flex items-center justify-center">
              <BookOpen className="text-secondary-brand" size={16} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-sm font-semibold leading-snug">单词训练</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">选择词库</p>
            </div>
          </CloudButton>

        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs font-medium text-muted-foreground">训练资料</h2>
        <CloudCard className="divide-y divide-border overflow-hidden p-0">
          {[
            { name: "解析语法", path: "/grammar-analysis", desc: "语法专项练习" },
            { name: "阅读理解", path: "/reading-comprehension", desc: "阅读训练" },
            { name: "完形填空", path: "/cloze-practice", desc: "完形专项" },
            { name: "情景口语", path: "/scenario-dialogues", desc: "AI 情景对话" },
          ].map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Library className="text-muted-foreground" size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">{item.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
              <ChevronRight className="text-muted-soft shrink-0" size={16} />
            </button>
          ))}
        </CloudCard>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs font-medium text-muted-foreground">数据管理</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <CloudButton
            type="button"
            variant="card"
            onClick={() => navigate("/word-books")}
            className="!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5"
          >
            <div className="w-8 h-8 shrink-0 bg-tint-mint rounded-xl flex items-center justify-center">
              <Library className="text-success" size={16} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-sm font-semibold leading-snug">我的书架</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">浏览词库</p>
            </div>
          </CloudButton>

          {isCoach && (
            <CloudButton
              type="button"
              variant="card"
              data-coach="students"
              onClick={() => navigate("/my-students")}
              className="!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5"
            >
              <div className="w-8 h-8 shrink-0 bg-tint-sky rounded-xl flex items-center justify-center">
                <Users className="text-secondary-brand" size={16} />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-foreground text-sm font-semibold leading-snug">学员管理</div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">学员与时长</p>
              </div>
            </CloudButton>
          )}

          <CloudButton
            type="button"
            variant="card"
            onClick={() => navigate("/training-records")}
            className="!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5"
          >
            <div className="w-8 h-8 shrink-0 bg-tint-mint rounded-xl flex items-center justify-center">
              <ClipboardList className="text-success" size={16} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-sm font-semibold leading-snug">学习记录</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">正课与复习</p>
            </div>
          </CloudButton>
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
