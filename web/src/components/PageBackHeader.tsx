import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { CloudButton } from "./cloudsteps";

type PageBackHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

/** 独立页顶栏：返回 + 标题 */
export function PageBackHeader({ title, subtitle, onBack }: PageBackHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="shrink-0 sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
        <CloudButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => (onBack ? onBack() : navigate(-1))}
          aria-label="返回"
        >
          <ChevronLeft size={22} className="text-charcoal" />
        </CloudButton>
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{title}</h1>
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
