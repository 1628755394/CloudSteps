import * as React from "react";

/**
 * CloudCard - Warm Mint 卡片容器
 * 白底 + hairline，交互态用 mint 边框
 */
export type CloudCardProps = {
  className?: string;
  children: React.ReactNode;
  /** 是否可点击（添加 hover 效果） */
  interactive?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** tint 表面：mint / sky / cream，用于统计等轻量区块 */
  tint?: "none" | "mint" | "sky" | "cream";
};

const tintClass: Record<NonNullable<CloudCardProps["tint"]>, string> = {
  none: "bg-card",
  mint: "bg-tint-mint",
  sky: "bg-tint-sky",
  cream: "bg-tint-cream",
};

export function CloudCard({
  className = "",
  children,
  interactive,
  onClick,
  tint = "none",
}: CloudCardProps) {
  return (
    <div
      onClick={onClick}
      className={`${tintClass[tint]} rounded-xl border border-border ${
        interactive
          ? "cursor-pointer hover:border-primary transition-colors shadow-[var(--shadow-rest)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
