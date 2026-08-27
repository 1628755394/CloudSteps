import { Bell, Menu, X } from "lucide-react";
import { useNavigate } from "react-router";
import { CloudButton } from "./cloudsteps";
import { useThemeStore } from "../stores/themeStore";

type HeaderProps = {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  /** 侧栏布局才显示汉堡菜单 */
  showMenuButton?: boolean;
};

export function Header({
  mobileMenuOpen,
  onToggleMobileMenu,
  showMenuButton = true,
}: HeaderProps) {
  const navigate = useNavigate();
  const layout = useThemeStore((s) => s.layout);
  const NOTIFICATION_PATH = "/notifications";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border transition-colors duration-300">
      <div className="relative flex items-center justify-between h-11 px-3 lg:px-4 pt-[env(safe-area-inset-top,0px)]">
        {/* 布局区分：底边细线用主题色，不整块铺色 */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${
            layout === "sidebar" ? "bg-primary" : layout === "top" ? "bg-primary/70" : "bg-primary/40"
          }`}
          aria-hidden
        />
        <div className="flex items-center gap-2 min-w-0">
          {showMenuButton ? (
            <CloudButton
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0 size-9 text-charcoal"
              onClick={onToggleMobileMenu}
              aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </CloudButton>
          ) : null}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 min-w-0"
            aria-label="解忧首页"
          >
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
              className="w-7 h-7 rounded-md object-contain shrink-0"
              loading="eager"
            />
            <span className="text-sm font-semibold tracking-tight text-foreground truncate">
              解忧
            </span>
          </button>
        </div>

        <CloudButton
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-primary"
          onClick={() => navigate(NOTIFICATION_PATH)}
          aria-label="通知"
        >
          <Bell size={18} />
        </CloudButton>
      </div>
    </header>
  );
}
