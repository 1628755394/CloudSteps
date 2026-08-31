import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "../utils/cn";

export type HomeCardAccent =
  | "mint"
  | "sky"
  | "violet"
  | "amber"
  | "rose"
  | "teal"
  | "green"
  | "slate";

const accentStyles: Record<
  HomeCardAccent,
  { icon: string; glow: string; border: string }
> = {
  mint: {
    icon: "bg-gradient-to-br from-primary/35 via-primary/15 to-primary/5 text-primary",
    glow: "from-primary/12 via-primary/5",
    border: "hover:border-primary/40 group-hover:shadow-[0_10px_28px_-10px_rgba(78,205,196,0.45)]",
  },
  sky: {
    icon: "bg-gradient-to-br from-secondary-brand/35 via-secondary-brand/15 to-secondary-brand/5 text-secondary-brand",
    glow: "from-secondary-brand/12 via-secondary-brand/5",
    border:
      "hover:border-secondary-brand/40 group-hover:shadow-[0_10px_28px_-10px_rgba(85,163,255,0.4)]",
  },
  violet: {
    icon: "bg-gradient-to-br from-violet-500/30 via-violet-500/12 to-violet-500/5 text-violet-600 dark:text-violet-400",
    glow: "from-violet-500/10 via-violet-500/5",
    border: "hover:border-violet-400/40 group-hover:shadow-[0_10px_28px_-10px_rgba(139,92,246,0.35)]",
  },
  amber: {
    icon: "bg-gradient-to-br from-amber-500/30 via-amber-500/12 to-amber-500/5 text-amber-600 dark:text-amber-400",
    glow: "from-amber-500/10 via-amber-500/5",
    border: "hover:border-amber-400/40 group-hover:shadow-[0_10px_28px_-10px_rgba(245,158,11,0.35)]",
  },
  rose: {
    icon: "bg-gradient-to-br from-rose-500/30 via-rose-500/12 to-rose-500/5 text-rose-600 dark:text-rose-400",
    glow: "from-rose-500/10 via-rose-500/5",
    border: "hover:border-rose-400/40 group-hover:shadow-[0_10px_28px_-10px_rgba(244,63,94,0.35)]",
  },
  teal: {
    icon: "bg-gradient-to-br from-teal-500/30 via-teal-500/12 to-teal-500/5 text-teal-600 dark:text-teal-400",
    glow: "from-teal-500/10 via-teal-500/5",
    border: "hover:border-teal-400/40 group-hover:shadow-[0_10px_28px_-10px_rgba(20,184,166,0.35)]",
  },
  green: {
    icon: "bg-gradient-to-br from-success/35 via-success/15 to-success/5 text-success",
    glow: "from-success/10 via-success/5",
    border: "hover:border-success/40 group-hover:shadow-[0_10px_28px_-10px_rgba(26,174,57,0.35)]",
  },
  slate: {
    icon: "bg-gradient-to-br from-muted-foreground/20 via-muted/80 to-muted/40 text-muted-foreground",
    glow: "from-muted-foreground/8 via-transparent",
    border: "hover:border-border group-hover:shadow-[var(--shadow-rest)]",
  },
};

type HomeFeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: HomeCardAccent;
  onClick: () => void;
  className?: string;
  "data-coach"?: string;
};

export function HomeFeatureCard({
  icon: Icon,
  title,
  description,
  accent = "mint",
  onClick,
  className,
  "data-coach": dataCoach,
}: HomeFeatureCardProps) {
  const style = accentStyles[accent];

  return (
    <button
      type="button"
      data-coach={dataCoach}
      onClick={onClick}
      className={cn(
        "group relative flex w-full min-h-[4.25rem] items-center gap-3 overflow-hidden rounded-xl border border-border/80 bg-card p-3 text-left shadow-[var(--shadow-rest)] transition-all duration-200",
        "hover:-translate-y-px active:scale-[0.99]",
        style.border,
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100",
          style.glow,
        )}
      />
      <div
        className={cn(
          "relative flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
          style.icon,
        )}
      >
        <Icon size={17} strokeWidth={2.1} />
      </div>
      <div className="relative min-w-0 flex-1 py-0.5">
        <div className="text-sm font-semibold leading-snug text-foreground">{title}</div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
      <ChevronRight
        size={14}
        className="relative shrink-0 text-muted-soft/80 transition-colors group-hover:text-primary"
      />
    </button>
  );
}

export function HomeSectionHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary" aria-hidden />
        <h2 className="truncate text-xs font-semibold tracking-tight text-foreground sm:text-[13px]">{title}</h2>
      </div>
      {children}
    </div>
  );
}
