import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { motion } from "motion/react";
import {
  Home,
  RefreshCw,
  Users,
  Library,
  BookOpen,
  Menu,
  X,
} from "lucide-react";
import { Header } from "./header";
import { NavMenu } from "./NavMenu";
import { AnimatedOutlet } from "./PageTransition";
import { useAuthStore } from "../stores/authStore";
import { kickoffWordBooksPrefetch } from "../utils/wordBooksCache";
import { useThemeStore, type LayoutMode } from "../stores/themeStore";

const navItems = [
  { path: "/", label: "首页", icon: Home },
  { path: "/lesson-prep", label: "备课", icon: BookOpen },
  { path: "/word-books", label: "词库", icon: Library },
  { path: "/anti-forgetting", label: "抗遗忘", icon: RefreshCw },
  { path: "/coach-center", label: "陪练中心", icon: Users },
];

function BottomNav({
  items,
  pathname,
}: {
  items: typeof navItems;
  pathname: string;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border">
      <div className="relative flex items-center justify-around px-2 py-1.5 max-w-[1200px] mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? pathname === "/"
              : pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative flex flex-1 flex-col items-center gap-0.5 px-2 py-2"
            >
              {isActive ? (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="absolute inset-x-1 inset-y-0.5 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <Icon
                size={20}
                strokeWidth={2}
                className={`relative z-10 ${isActive ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`relative z-10 text-[10px] leading-tight ${
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TopNavBar({
  items,
  pathname,
}: {
  items: typeof navItems;
  pathname: string;
}) {
  return (
    <div className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="max-w-[1200px] mx-auto px-2 sm:px-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max py-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/"
                ? pathname === "/"
                : pathname === item.path || pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-primary font-medium bg-primary-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon size={16} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SidebarPanel({
  items,
  pathname,
  greetingText,
  userName,
  onNavigate,
  className = "",
}: {
  items: typeof navItems;
  pathname: string;
  greetingText: string;
  userName: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-primary-soft rounded-lg mb-2">
          <span className="text-xs text-primary font-semibold">正式陪练</span>
        </div>
        <div className="text-xs text-muted-foreground mb-0.5">{greetingText}</div>
        <p className="text-foreground font-medium text-sm">Hi, {userName || "-"}</p>
      </div>
      <NavMenu items={items} activePath={pathname} onNavigate={onNavigate} />
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const layout = useThemeStore((s) => s.layout) as LayoutMode;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userRole = useAuthStore((s) => s.user?.role);
  const userName = useAuthStore((s) => s.user?.displayName || s.user?.email || "");

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const mobileMenuCloseTimerRef = useRef<number | null>(null);
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false);
  const [mobileMenuRenderOpen, setMobileMenuRenderOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    if (mobileMenuCloseTimerRef.current != null) {
      window.clearTimeout(mobileMenuCloseTimerRef.current);
      mobileMenuCloseTimerRef.current = null;
    }

    if (mobileMenuOpen) {
      setMobileMenuMounted(true);
      setMobileMenuRenderOpen(false);
      const raf = window.requestAnimationFrame(() => setMobileMenuRenderOpen(true));
      return () => window.cancelAnimationFrame(raf);
    }

    if (!mobileMenuMounted) return;
    setMobileMenuRenderOpen(false);
    mobileMenuCloseTimerRef.current = window.setTimeout(() => {
      setMobileMenuMounted(false);
      mobileMenuCloseTimerRef.current = null;
    }, 320);
  }, [mobileMenuOpen, mobileMenuMounted]);

  useEffect(() => {
    return () => {
      if (mobileMenuCloseTimerRef.current != null) {
        window.clearTimeout(mobileMenuCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    kickoffWordBooksPrefetch();
  }, []);

  // 切换布局时关掉抽屉，避免错位
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [layout]);

  const filteredNavItems = useMemo(() => {
    return navItems.filter((item) => {
      const roles = (item as { roles?: Array<"user" | "admin"> }).roles;
      if (!roles || roles.length === 0) return true;
      const role = userRole ?? "user";
      return roles.includes(role);
    });
  }, [userRole]);

  const showSidebar = layout === "sidebar";
  const showTopNav = layout === "top";
  const showBottomNav = layout === "sidebar" || layout === "bottom";
  // 侧栏布局：移动端用抽屉；底栏布局不需要汉堡；顶栏布局不需要汉堡
  const showMobileDrawer = layout === "sidebar";
  const showHeaderMenu = layout === "sidebar";

  const mainPadBottom =
    showBottomNav
      ? layout === "bottom"
        ? "pb-20"
        : "pb-20 lg:pb-0"
      : "pb-4";

  const mainMarginLeft = showSidebar ? "lg:ml-60" : "";

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        showMenuButton={showHeaderMenu}
      />

      <div
        className={`flex min-h-dvh flex-col ${
          layout === "top"
            ? "pt-[calc(3rem+env(safe-area-inset-top,0px))] lg:pt-12"
            : "pt-[calc(2.75rem+env(safe-area-inset-top,0px))] lg:pt-11"
        }`}
      >
        {showTopNav && (
          <TopNavBar items={filteredNavItems} pathname={location.pathname} />
        )}

        <div className="flex flex-1 min-h-0">
          {/* 左侧边栏：仅侧栏布局 + 桌面 */}
          {showSidebar && (
            <aside className="hidden lg:block fixed left-0 top-11 bottom-0 w-60 bg-sidebar border-r border-sidebar-border overflow-y-auto">
              <SidebarPanel
                className="p-5"
                items={filteredNavItems}
                pathname={location.pathname}
                greetingText={greetingText}
                userName={userName}
              />
            </aside>
          )}

          {/* 移动端抽屉：仅侧栏布局 */}
          {showMobileDrawer && mobileMenuMounted && (
            <div className="lg:hidden fixed inset-0 z-[60]">
              <div
                className={
                  "absolute inset-0 bg-black/20 transition-opacity duration-300 ease-out " +
                  (mobileMenuRenderOpen ? "opacity-100" : "opacity-0")
                }
                onClick={closeMobileMenu}
              />
              <aside
                className={
                  "absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border overflow-y-auto transform-gpu transition-transform duration-300 ease-out " +
                  (mobileMenuRenderOpen ? "translate-x-0" : "-translate-x-full")
                }
              >
                <SidebarPanel
                  className="p-6"
                  items={filteredNavItems}
                  pathname={location.pathname}
                  greetingText={greetingText}
                  userName={userName}
                  onNavigate={closeMobileMenu}
                />
              </aside>
            </div>
          )}

          <main
            className={`flex-1 ${mainMarginLeft} ${mainPadBottom} overflow-x-hidden flex flex-col min-h-[calc(100dvh-2.75rem-env(safe-area-inset-top,0px))]`}
          >
            <div className="flex-1 flex flex-col max-w-[1200px] w-full mx-auto px-4 py-3 lg:py-4 min-h-0">
              <AnimatedOutlet />
            </div>
          </main>
        </div>
      </div>

      {/* 底栏：侧栏布局仅移动端；底栏布局全端显示 */}
      {showBottomNav && (
        <div className={layout === "sidebar" ? "lg:hidden" : undefined}>
          <BottomNav items={filteredNavItems} pathname={location.pathname} />
        </div>
      )}
    </div>
  );
}
