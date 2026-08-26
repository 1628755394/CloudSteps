import { ChevronRight, Library } from "lucide-react";
import { useNavigate } from "react-router";
import { CloudCard } from "../components/cloudsteps/arco";

/**
 * 首页快捷入口 + 训练资料（路由 /）。
 */
export default function LessonPrep() {
  const navigate = useNavigate();


  const materials = [
    { name: "解析语法", path: "/grammar-analysis", desc: "语法专项练习" },
    { name: "阅读理解", path: "/reading-comprehension", desc: "阅读训练" },
    { name: "完形填空", path: "/cloze-practice", desc: "完形专项" },
    { name: "情景口语", path: "/scenario-dialogues", desc: "AI 情景对话" },
  ];

  return (
    <div className="space-y-4">
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
