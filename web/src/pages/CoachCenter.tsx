import {
  DollarSign,
  ClipboardList,
  Settings2,
  ChevronRight,
  CalendarCheck,
  Pencil,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { CloudButton, CloudImageWithFallback } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { useAuthStore } from "../stores/authStore";
import { resolveMediaUrl } from "../utils/mediaUrl";

const features = (role: string) => [
  ...(role === "student"
    ? []
    : [{ id: 1, icon: DollarSign, label: "佣金核对", tint: "mint" as const, path: "/commission-check" }]),
  { id: 2, icon: ClipboardList, label: "词汇测试记录", tint: "sky" as const, path: "/test-records" },
  { id: 3, icon: Settings2, label: "设置", tint: "cream" as const, path: "/settings" },
];

const tintClass = {
  mint: "bg-primary-soft text-primary",
  sky: "bg-tint-sky text-secondary-brand",
  cream: "bg-tint-cream text-warning",
};

export default function CoachCenter() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshUserInfo = useAuthStore((s) => s.refreshUserInfo);
  const role = (user as { role?: string } | null)?.role || "user";
  const isCoach = role === "teacher" || role === "user";

  useEffect(() => {
    void refreshUserInfo();
  }, [refreshUserInfo]);

  const name = user?.displayName || user?.email || "";
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);
  const featureList = useMemo(() => features(role), [role]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-3 overflow-hidden">
      <CloudCard className="px-3.5 py-3 sm:px-4 sm:py-3.5 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="size-14 sm:size-16 rounded-full bg-primary-soft border border-border overflow-hidden flex items-center justify-center shrink-0">
            {user?.avatar ? (
              <CloudImageWithFallback
                src={resolveMediaUrl(user.avatar) || user.avatar}
                alt={name}
                className="size-full object-cover rounded-full"
              />
            ) : (
              <span className="text-base font-semibold text-primary">
                {(name || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[13px] sm:text-sm font-medium text-foreground truncate leading-snug">
                {name || "-"}
              </h1>
              <span className="text-[11px] text-muted-foreground shrink-0 leading-none">
                {greetingText}
              </span>
            </div>
            <p className="text-[11px] text-muted-soft truncate leading-snug mt-0.5">
              正式陪练 · ID {user?.id ?? "-"}
            </p>
          </div>

          <CloudButton
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile/edit")}
            className="shrink-0 size-8 text-muted-foreground hover:text-primary"
            aria-label="编辑资料"
          >
            <Pencil size={15} />
          </CloudButton>
        </div>
      </CloudCard>

      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden sm:grid sm:grid-cols-2 sm:items-stretch">
        {isCoach && (
          <button
            type="button"
            onClick={() => navigate("/coach-center/completed")}
            className="w-full text-left rounded-xl border border-border bg-card p-5 hover:border-primary transition-colors group flex flex-col justify-center min-h-[7.5rem] sm:min-h-0 sm:h-full"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <CalendarCheck size={22} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-semibold text-foreground">已上课程</div>
                  <ChevronRight
                    size={18}
                    className="text-muted-soft group-hover:text-primary shrink-0 transition-colors"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  查看近 90 天已完成的陪练记录与课时结算
                </p>
              </div>
            </div>
          </button>
        )}

        <CloudCard
          className={`p-3 flex-1 flex flex-col min-h-0 overflow-hidden ${
            isCoach ? "" : "sm:col-span-2"
          }`}
        >
          <h2 className="text-sm font-semibold text-foreground px-2 pt-1 pb-2 shrink-0">功能中心</h2>
          <div className="flex-1 min-h-0 flex flex-col justify-evenly divide-y divide-border">
            {featureList.map((feature) => {
              const Icon = feature.icon;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => navigate(feature.path)}
                  className="w-full flex items-center gap-3.5 px-2 py-3.5 rounded-xl hover:bg-muted/60 transition-colors group text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tintClass[feature.tint]}`}
                  >
                    <Icon size={18} />
                  </div>
                  <span className="flex-1 text-sm sm:text-base font-medium text-foreground">
                    {feature.label}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-muted-soft group-hover:text-primary transition-colors"
                  />
                </button>
              );
            })}
          </div>
        </CloudCard>
      </div>
    </div>
  );
}
