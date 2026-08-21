import { useEffect, type ReactNode } from "react";
import { ConfigProvider } from "@arco-design/web-react";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import {
  bindSystemThemeListener,
  getAccentHex,
  useThemeStore,
} from "../stores/themeStore";
import { ARCO_POPUP_Z_INDEX, arcoGlobalComponentConfig, arcoPopupContainer } from "../utils/arcoPopup";

export function ArcoAppProvider({ children }: { children: ReactNode }) {
  const isDark = useThemeStore((s) => s.isDark);
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const customHex = useThemeStore((s) => s.customHex);
  const primaryColor = accent === "custom" ? (customHex || "#6B7280") : (getAccentHex());

  useEffect(() => {
    return bindSystemThemeListener();
  }, []);

  useEffect(() => {
    // 确保刷新后立刻把已持久化的外观应用到 DOM
    const s = useThemeStore.getState();
    s.setMode(s.mode);
    s.setAccent(s.accent ?? "mint");
    s.setLayout(s.layout ?? "sidebar");
  }, []);

  useEffect(() => {
    const isDarkResolved =
      mode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : isDark;
    if (isDarkResolved) {
      document.body.setAttribute("arco-theme", "dark");
    } else {
      document.body.removeAttribute("arco-theme");
    }
  }, [isDark, mode]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ primaryColor }}
      zIndex={ARCO_POPUP_Z_INDEX}
      getPopupContainer={arcoPopupContainer}
      componentConfig={arcoGlobalComponentConfig}
    >
      {children}
    </ConfigProvider>
  );
}

