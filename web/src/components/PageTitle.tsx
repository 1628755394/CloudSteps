import type { ReactNode } from "react";
import { cn } from "../utils/cn";

type PageTitleProps = {
  children: ReactNode;
  description?: ReactNode;
  className?: string;
  as?: "h1" | "h2";
};

/** 布局内页标题 — 比全局 h1 更小、更克制 */
export function PageTitle({
  children,
  description,
  className,
  as: Tag = "h1",
}: PageTitleProps) {
  return (
    <div className={className}>
      <Tag className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {children}
      </Tag>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

/** 全屏流程页顶栏标题 */
export function FlowPageTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "truncate text-center text-sm font-medium leading-none text-[#2D3748]",
        className,
      )}
    >
      {children}
    </h1>
  );
}
