import type { ReactNode } from "react";
import { cn } from "../utils/cn";

type PageTitleProps = {
  children: ReactNode;
  description?: ReactNode;
  className?: string;
  as?: "h1" | "h2";
};

/** 布局内页标题 — 紧凑，避免首屏标题区过高 */
export function PageTitle({
  children,
  description,
  className,
  as: Tag = "h1",
}: PageTitleProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <Tag className="text-base font-semibold tracking-tight text-foreground leading-snug sm:text-lg">
        {children}
      </Tag>
      {description ? (
        <p className="text-xs text-muted-foreground leading-snug sm:text-sm">{description}</p>
      ) : null}
    </div>
  );
}

/** 全屏流程页顶栏标题（不用 h1，避免全局标题字号撑高顶栏） */
export function FlowPageTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "truncate text-center text-sm font-medium leading-none text-[#2D3748]",
        className,
      )}
    >
      {children}
    </div>
  );
}
