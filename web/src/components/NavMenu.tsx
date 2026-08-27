import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
};

type NavMenuProps = {
  items: NavItem[];
  activePath: string;
  onNavigate?: () => void;
};

export function NavMenu({ items, activePath, onNavigate }: NavMenuProps) {
  return (
    <nav className="relative flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.path === "/"
            ? activePath === "/"
            : activePath === item.path || activePath.startsWith(`${item.path}/`);

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            data-coach={item.path === "/lesson-prep" ? "schedule" : undefined}
            className="relative flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors"
          >
            {isActive ? (
              <motion.span
                layoutId="desktop-nav-pill"
                className="absolute inset-0 rounded-[10px] bg-white shadow-[0_1px_4px_rgb(0_0_0_/_0.08)] dark:bg-background dark:shadow-[0_1px_4px_rgb(0_0_0_/_0.18)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <Icon
              size={18}
              strokeWidth={2}
              className={`relative z-10 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
            />
            <span
              className={`relative z-10 ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
