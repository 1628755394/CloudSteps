import { Bell, Menu, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { getUnreadNotificationCount } from "../api/notifications";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import { CloudButton } from "./cloudsteps";

type HeaderProps = {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  /** 侧栏布局才显示汉堡菜单 */
  showMenuButton?: boolean;
};

const POLL_MS = 60_000;

export function Header({
  mobileMenuOpen,
  onToggleMobileMenu,
  showMenuButton = true,
}: HeaderProps) {
  const navigate = useNavigate();
  const layout = useThemeStore((s) => s.layout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const NOTIFICATION_PATH = "/notifications";
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated) {
      setUnread(0);
      return;
    }
    try {
      const count = await getUnreadNotificationCount();
      setUnread(count);
    } catch {
      // keep last known count
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshUnread();
    if (!isAuthenticated) return;

    const onFocus = () => void refreshUnread();
    const onChanged = () => void refreshUnread();
    window.addEventListener("focus", onFocus);
    window.addEventListener("notifications:unread-changed", onChanged);
    const timer = window.setInterval(() => void refreshUnread(), POLL_MS);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("notifications:unread-changed", onChanged);
      window.clearInterval(timer);
    };
  }, [isAuthenticated, refreshUnread]);

  const badgeLabel =
    unread > 99 ? "99+" : unread > 0 ? String(unread) : "";

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
            aria-label="解忧背词首页"
          >
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
              className="w-7 h-7 rounded-md object-contain shrink-0"
              loading="eager"
            />
            <span className="text-sm font-semibold tracking-tight text-foreground truncate">
              解忧背词
            </span>
          </button>
        </div>

        <CloudButton
          variant="ghost"
          size="icon"
          className="relative size-9 shrink-0 text-muted-foreground hover:text-primary"
          onClick={() => navigate(NOTIFICATION_PATH)}
          aria-label={unread > 0 ? `通知，${unread} 条未读` : "通知"}
        >
          <Bell size={18} />
          {badgeLabel ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-[10px] leading-[1.1rem] text-white font-semibold text-center tabular-nums">
              {badgeLabel}
            </span>
          ) : null}
        </CloudButton>
      </div>
    </header>
  );
}
