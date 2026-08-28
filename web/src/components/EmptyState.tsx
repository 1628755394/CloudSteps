import { Inbox } from "lucide-react";

type EmptyStateProps = {
  /** iconfont 图标类名，例如：icon-zanwugongdan */
  icon?: string;
  /** 图标尺寸（像素），默认 64 */
  iconSize?: number;
  /** 图标颜色 class，默认 text-muted-foreground/60 */
  iconClassName?: string;
  title?: string;
  description?: string;
  className?: string;
};

/**
 * 通用空状态组件
 * - icon 传入 iconfont 类名（如 "icon-zanwugongdan"），使用本地 iconfont 字体渲染
 * - 未传 icon 时回退到 Lucide Inbox 图标
 */
export function EmptyState({
  icon,
  iconSize = 64,
  iconClassName = "text-muted-foreground/60",
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className ?? ""}`}
      role="status"
    >
      {icon ? (
        <i
          className={`iconfont ${icon} ${iconClassName}`}
          style={{ fontSize: iconSize, lineHeight: 1, marginBottom: 16 }}
          aria-hidden
        />
      ) : (
        <Inbox
          className="mb-4"
          size={iconSize}
          aria-hidden
        />
      )}
      {title ? (
        <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      ) : null}
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
