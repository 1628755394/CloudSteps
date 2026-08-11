import { Bell, Menu, X } from "lucide-react";
import { useNavigate } from "react-router";
import { CloudButton } from "./cloudsteps";

type HeaderProps = {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
};

export function Header({ mobileMenuOpen, onToggleMobileMenu }: HeaderProps) {
  const navigate = useNavigate();
  const NOTIFICATION_PATH = "/notifications";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <CloudButton
            variant="ghost"
            size="icon"
            className="lg:hidden text-charcoal"
            onClick={onToggleMobileMenu}
            aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </CloudButton>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
          >
            <img
              src="/logo.png"
              alt="CloudSteps"
              className="w-8 h-8 rounded-lg object-contain"
              loading="eager"
            />
            <div className="leading-tight text-left">
              <div className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                云阶
              </div>
              <div className="hidden sm:block text-[11px] text-muted-foreground">CloudSteps</div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <CloudButton
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
            onClick={() => navigate(NOTIFICATION_PATH)}
            aria-label="通知"
          >
            <Bell size={20} />
          </CloudButton>
        </div>
      </div>
    </header>
  );
}
