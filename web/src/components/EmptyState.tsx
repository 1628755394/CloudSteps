import { Inbox } from "lucide-react";

type EmptyStateProps = {
  /** iconfont 图标类名，例如：icon-zanwugongdan */
  icon?: string;
  title?: string;
  description?: string;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className ?? ""}`}>
      {icon ? (
        <i className={`iconfont ${icon} text-5xl text-muted-foreground/60 mb-4`} />
      ) : (
        <Inbox className="size-12 text-muted-foreground/60 mb-4" />
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
