import {
  Settings2,
  ChevronRight,
  CalendarCheck,
  Pencil,
  MessageCircle,
  Flame,
  Mars,
  Venus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CloudButton, CloudImageWithFallback } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { getTeacherTeachingPool } from "../api/coaching";
import { useAuthStore } from "../stores/authStore";
import { teacherAvatarSrc } from "../utils/avatar";
import { formatTeachingMinutes } from "../utils/formatMinutes";

const tintClass = {
  sky: "bg-tint-sky text-secondary-brand",
  cream: "bg-tint-cream text-warning",
  mint: "bg-primary-soft text-primary",
  primary: "bg-primary-soft text-primary",
};

function GenderMark({ gender }: { gender?: string }) {
  const g = (gender || "female").trim().toLowerCase();
  if (g === "male" || g === "m" || g === "男") {
    return (
      <span
        className="inline-flex items-center justify-center size-4 rounded-full bg-sky-100 text-sky-600 shrink-0"
        title="男"
        aria-label="男"
      >
        <Mars size={11} strokeWidth={2.25} />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center size-4 rounded-full bg-pink-100 text-pink-600 shrink-0"
      title="女"
      aria-label="女"
    >
      <Venus size={11} strokeWidth={2.25} />
    </span>
  );
}

export default function CoachCenter() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshUserInfo = useAuthStore((s) => s.refreshUserInfo);
  const role = (user as { role?: string } | null)?.role || "user";
  const isCoach = role === "teacher" || role === "user";

  const [poolMinutes, setPoolMinutes] = useState<number | null>(null);
  const [poolTotal, setPoolTotal] = useState<number | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);

  useEffect(() => {
    void refreshUserInfo();
  }, [refreshUserInfo]);

  useEffect(() => {
    if (!isCoach) return;
    let mounted = true;
    setPoolLoading(true);
    void getTeacherTeachingPool()
      .then((res) => {
        if (!mounted) return;
        if (res.code === 200 && res.data) {
          setPoolMinutes(res.data.remainingMinutes ?? 0);
          setPoolTotal(res.data.totalAllocatedMinutes ?? 0);
        }
      })
      .finally(() => {
        if (mounted) setPoolLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isCoach]);

  const name = user?.displayName || user?.email || "";
  const remaining = poolMinutes ?? 0;
  const total = poolTotal ?? 0;
  const remainPct =
    total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0;

  const featureList = useMemo(() => {
    const base = [
      {
        id: 4,
        icon: MessageCircle,
        label: "反馈给我们",
        description: "问题与建议",
        tint: "mint" as const,
        path: "/feedback",
      },
      {
        id: 3,
        icon: Settings2,
        label: "设置",
        tint: "cream" as const,
        path: "/settings",
      },
    ];
    if (!isCoach) return base;
    return [
      {
        id: 1,
        icon: CalendarCheck,
        label: "已上课程",
        description: "近 90 天陪练记录",
        tint: "primary" as const,
        path: "/coach-center/completed",
      },
      ...base,
    ];
  }, [isCoach]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2 overflow-hidden">
      <CloudCard className="px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-full bg-primary-soft border border-border overflow-hidden flex items-center justify-center shrink-0">
            <CloudImageWithFallback
              src={teacherAvatarSrc(user?.avatar)}
              alt={name}
              className="size-full object-cover rounded-full"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate leading-snug">
                {name || "-"}
              </h1>
              <GenderMark gender={user?.gender} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">陪练中心</p>
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

      {isCoach ? (
        <button
          type="button"
          onClick={() => navigate("/coach-center/checkin")}
          className="w-full text-left rounded-xl border border-primary/25 bg-gradient-to-br from-primary/12 via-card to-secondary-brand/8 px-3.5 py-3 hover:border-primary/50 transition-colors group relative overflow-hidden shrink-0"
        >
          <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
              <Flame size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-primary">授课额度</span>
                <ChevronRight
                  size={14}
                  className="text-muted-soft group-hover:text-primary shrink-0 transition-colors"
                />
              </div>
              <div className="mt-0.5 text-xl font-bold tabular-nums text-foreground tracking-tight leading-none">
                {poolLoading ? "…" : formatTeachingMinutes(remaining)}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground truncate">
                {total > 0
                  ? `累计 ${formatTeachingMinutes(total)} · 点此签到`
                  : "每日签到领额度，连续有额外奖励"}
              </p>
              {total > 0 ? (
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${remainPct}%` }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </button>
      ) : null}

      <CloudCard className="p-2 flex-1 flex flex-col min-h-0 overflow-hidden">
        <h2 className="text-xs font-semibold text-foreground px-2 pt-0.5 pb-1.5 shrink-0">
          功能中心
        </h2>
        <div className="flex-1 min-h-0 flex flex-col justify-evenly divide-y divide-border overflow-hidden">
          {featureList.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => navigate(feature.path)}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/60 transition-colors group text-left min-h-0"
              >
                <div
                  className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${tintClass[feature.tint]}`}
                >
                  <Icon size={16} />
                </div>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-foreground leading-snug">
                    {feature.label}
                  </span>
                  {"description" in feature && feature.description ? (
                    <span className="block text-[10px] text-muted-foreground mt-0.5 leading-snug truncate">
                      {feature.description}
                    </span>
                  ) : null}
                </span>
                <ChevronRight
                  size={14}
                  className="text-muted-soft group-hover:text-primary transition-colors shrink-0"
                />
              </button>
            );
          })}
        </div>
      </CloudCard>
    </div>
  );
}
