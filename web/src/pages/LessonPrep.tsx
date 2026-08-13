import { BookOpen, ChevronRight, ClipboardList, FileText, Library, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard, CloudSelect } from "../components/cloudsteps/arco";
import { useAuthStore } from "../stores/authStore";
import { kickoffVocabTestPrefetch } from "../utils/vocabTestCache";
import { kickoffWordBooksPrefetch } from "../utils/wordBooksCache";
import { useEffect, useMemo, useState } from "react";
import { listAllTeacherCoachingQuotas, type TeacherCoachingQuotaRow } from "../api/coaching";
import {
  getTrainingStudent,
  setTrainingStudent,
  studentLabelFromQuota,
} from "../utils/trainingStudent";

/**
 * 首页快捷入口 + 训练资料（路由 /）。
 */
export default function LessonPrep() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role) || "user";
  const isCoach = role === "user" || role === "admin" || role === "teacher";

  const [students, setStudents] = useState<TeacherCoachingQuotaRow[]>([]);
  const [studentId, setStudentId] = useState<string>(() => {
    const s = getTrainingStudent();
    return s?.id ? String(s.id) : "";
  });
  const [loadingStudents, setLoadingStudents] = useState(false);

  const reloadStudents = () => {
    if (!isCoach) return;
    setLoadingStudents(true);
    listAllTeacherCoachingQuotas()
      .then((rows) => {
        setStudents(rows);
        const saved = getTrainingStudent();
        let pick = saved?.id ? rows.find((r) => r.studentId === saved.id) : undefined;
        if (!pick && rows[0]) pick = rows[0];
        if (pick) {
          setStudentId(String(pick.studentId));
          setTrainingStudent(pick.studentId, studentLabelFromQuota(pick));
        }
      })
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  };

  useEffect(() => {
    kickoffWordBooksPrefetch();
  }, []);

  useEffect(() => {
    if (!isCoach) return;
    let mounted = true;
    setLoadingStudents(true);
    (async () => {
      try {
        const rows = await listAllTeacherCoachingQuotas();
        if (!mounted) return;
        setStudents(rows);

        const saved = getTrainingStudent();
        let pick = saved?.id ? rows.find((r) => r.studentId === saved.id) : undefined;
        if (!pick && rows[0]) pick = rows[0];
        if (pick) {
          const name = studentLabelFromQuota(pick);
          setStudentId(String(pick.studentId));
          setTrainingStudent(pick.studentId, name);
        }
      } catch {
        if (mounted) setStudents([]);
      } finally {
        if (mounted) setLoadingStudents(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isCoach]);

  const studentOptions = useMemo(
    () =>
      students.map((r) => ({
        label: studentLabelFromQuota(r),
        value: String(r.studentId),
      })),
    [students]
  );

  const materials = [
    { name: "解析语法", path: "/grammar-analysis", desc: "语法专项练习" },
    { name: "阅读理解", path: "/reading-comprehension", desc: "阅读训练" },
    { name: "完形填空", path: "/cloze-practice", desc: "完形专项" },
    { name: "情景口语", path: "/scenario-dialogues", desc: "AI 情景对话" },
  ];

  const cardClass =
    "!min-h-0 !h-auto !flex-row !items-center gap-2.5 !p-3 sm:!p-3.5";

  return (
    <div className="space-y-4">
      <section className="space-y-2.5">
        <div className="flex items-center gap-3 w-full">
          <h2 className="text-xs font-medium text-muted-foreground shrink-0">常用</h2>
          {isCoach && (
            <div className="ml-auto flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">学员</span>
              <CloudSelect
                size="small"
                className="w-32 sm:w-40"
                placeholder={loadingStudents ? "加载中…" : "选择学员"}
                sheetTitle="选择学员"
                options={studentOptions}
                value={studentId || undefined}
                showSearch
                allowClear={false}
                disabled={loadingStudents || studentOptions.length === 0}
                filterOption={(input, option) =>
                  String(option?.props?.children ?? option?.props?.value ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                onChange={(v) => {
                  const id = String(v);
                  const row = students.find((r) => String(r.studentId) === id);
                  if (!row) return;
                  setStudentId(id);
                  setTrainingStudent(row.studentId, studentLabelFromQuota(row));
                }}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <CloudButton
            type="button"
            variant="card"
            onClick={() => {
              kickoffVocabTestPrefetch();
              navigate("/vocabulary-test");
            }}
            className={cardClass}
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
            onClick={() => {
              kickoffWordBooksPrefetch();
              navigate("/word-training");
            }}
            className={cardClass}
          >
            <div className="w-8 h-8 shrink-0 bg-tint-sky rounded-xl flex items-center justify-center">
              <BookOpen className="text-secondary-brand" size={16} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-sm font-semibold leading-snug">单词训练</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">选择词库</p>
            </div>
          </CloudButton>

          {isCoach && (
            <CloudButton
              type="button"
              variant="card"
              onClick={() => navigate("/my-students")}
              className={cardClass}
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
            className={cardClass}
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

      <section className="space-y-2.5">
        <h2 className="text-xs font-medium text-muted-foreground">训练资料</h2>
        <CloudCard className="divide-y divide-border overflow-hidden p-0">
          {materials.map((item) => (
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
    </div>
  );
}
