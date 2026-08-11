import { BookOpen, ChevronRight, ClipboardList, FileText, Library, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { PageTitle } from "../components/PageTitle";
import { useAuthStore } from "../stores/authStore";
import { kickoffVocabTestPrefetch } from "../utils/vocabTestCache";

/**
 * 备课页：承接原首页的快捷入口，以及资料选择类训练入口。
 * 原 tab「备课」下的词库列表已独立为「词库」tab。
 */
export default function LessonPrep() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role) || "user";
  const isCoach = role === "teacher" || role === "user";

  return (
    <div className="space-y-6">
      <PageTitle description="测评、学员与学习资料入口">备课</PageTitle>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">常用</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CloudButton
            type="button"
            variant="card"
            onClick={() => {
              kickoffVocabTestPrefetch();
              navigate("/vocabulary-test");
            }}
            className="min-h-[96px] !flex-row !items-center gap-4 !p-5"
          >
            <div className="w-11 h-11 shrink-0 bg-primary-soft rounded-xl flex items-center justify-center">
              <FileText className="text-primary" size={20} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-base font-semibold">词汇测试</div>
              <p className="text-sm text-muted-foreground mt-1 truncate">进入测评流程</p>
            </div>
            <ChevronRight className="text-muted-soft shrink-0" size={18} />
          </CloudButton>

          {isCoach ? (
            <CloudButton
              type="button"
              variant="card"
              onClick={() => navigate("/my-students")}
              className="min-h-[96px] !flex-row !items-center gap-4 !p-5"
            >
              <div className="w-11 h-11 shrink-0 bg-tint-sky rounded-xl flex items-center justify-center">
                <Users className="text-secondary-brand" size={20} />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-foreground text-base font-semibold">学员管理</div>
                <p className="text-sm text-muted-foreground mt-1 truncate">查看名下学员与陪练剩余时长</p>
              </div>
              <ChevronRight className="text-muted-soft shrink-0" size={18} />
            </CloudButton>
          ) : (
            <CloudButton
              type="button"
              variant="card"
              onClick={() => navigate("/word-training")}
              className="min-h-[96px] !flex-row !items-center gap-4 !p-5"
            >
              <div className="w-11 h-11 shrink-0 bg-tint-sky rounded-xl flex items-center justify-center">
                <BookOpen className="text-secondary-brand" size={20} />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-foreground text-base font-semibold">单词训练</div>
                <p className="text-sm text-muted-foreground mt-1 truncate">选择词库开始练习</p>
              </div>
              <ChevronRight className="text-muted-soft shrink-0" size={18} />
            </CloudButton>
          )}

          <CloudButton
            type="button"
            variant="card"
            onClick={() => navigate("/training-records")}
            className="min-h-[96px] !flex-row !items-center gap-4 !p-5 sm:col-span-2"
          >
            <div className="w-11 h-11 shrink-0 bg-tint-mint rounded-xl flex items-center justify-center">
              <ClipboardList className="text-success" size={20} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-foreground text-base font-semibold">学习记录</div>
              <p className="text-sm text-muted-foreground mt-1 truncate">查看正课与抗遗忘复习记录</p>
            </div>
            <ChevronRight className="text-muted-soft shrink-0" size={18} />
          </CloudButton>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">训练资料</h2>
        <CloudCard className="divide-y divide-border overflow-hidden p-0">
          {[
            { name: "单词练习", path: "/word-training", desc: "灯塔记忆与带背流程" },
            { name: "解析语法", path: "/grammar-analysis", desc: "语法专项练习" },
            { name: "阅读理解", path: "/reading-comprehension", desc: "阅读训练" },
            { name: "完形填空", path: "/cloze-practice", desc: "完形专项" },
            { name: "情景口语", path: "/scenario-dialogues", desc: "AI 情景对话" },
          ].map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Library className="text-muted-foreground" size={18} />
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
