import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { CloudButton } from "./cloudsteps";

type PageBackHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** history 为空时的回退路径 */
  fallbackTo?: string;
  /** 内容区最大宽度，默认与主站一致 */
  maxWidthClass?: string;
  extra?: ReactNode;
};

/**
 * 独立页顶栏：与主 Header 同系白底毛玻璃，返回 + 标题。
 * 含 safe-area，不铺主题色。
 */
export function PageBackHeader({
  title,
  subtitle,
  onBack,
  fallbackTo = "/",
  maxWidthClass = "max-w-3xl",
  extra,
}: PageBackHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate(fallbackTo);
  };

  return (
    <header
      className="shrink-0 sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border"
      aria-label={title}
    >
      <div
        className={`${maxWidthClass} mx-auto w-full px-3 sm:px-4 flex items-center gap-1 h-11 min-h-11 pt-[env(safe-area-inset-top,0px)]`}
      >
        <CloudButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="shrink-0 size-9 -ml-1 text-charcoal"
          aria-label="返回"
        >
          <ChevronLeft size={22} />
        </CloudButton>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="text-[15px] font-semibold text-foreground truncate leading-none">
            {title}
          </div>
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
              {subtitle}
            </p>
          ) : null}
        </div>
        {extra ? <div className="shrink-0">{extra}</div> : null}
      </div>
    </header>
  );
}
