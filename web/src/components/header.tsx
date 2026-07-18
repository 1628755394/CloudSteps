import React from "react";
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <CloudButton
            variant="ghost"
            size="iconRound"
            className="lg:hidden text-foreground"
            onClick={onToggleMobileMenu}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </CloudButton>
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="CloudSteps"
              className="w-8 h-8 rounded-lg object-contain"
              loading="eager"
            />
            <h1 className="text-lg font-semibold text-primary sm:text-xl">
              云阶背词
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <CloudButton
            variant="ghost"
            size="iconRound"
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
