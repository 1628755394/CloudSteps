import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

/** 主题色预设 */
export type AccentColor =
  | "mint"
  | "sky"
  | "violet"
  | "coral"
  | "amber"
  | "rose"
  | "indigo"
  | "forest";

/**
 * 应用壳布局（真正的导航结构切换，不是宽度微调）
 * - sidebar：桌面左侧栏 + 移动端底栏
 * - top：顶栏横向导航，无侧栏/底栏
 * - bottom：全端底部导航，无侧栏
 */
export type LayoutMode = "sidebar" | "top" | "bottom";

type SurfaceTone = {
  background: string;
  card: string;
  muted: string;
  accent: string;
  tint: string;
  sidebar: string;
  border: string;
  surfaceSoft: string;
};

export const ACCENT_PRESETS: Record<
  AccentColor,
  {
    label: string;
    hex: string;
    deep: string;
    light: SurfaceTone;
    dark: SurfaceTone;
  }
> = {
  mint: {
    label: "薄荷绿",
    hex: "#4ECDC4",
    deep: "#3DB8B0",
    light: {
      background: "#f3faf8",
      card: "#ffffff",
      muted: "#e8f4f1",
      accent: "#e4f7f4",
      tint: "#d8f3ee",
      sidebar: "#eef8f6",
      border: "#d5e8e4",
      surfaceSoft: "#f7fcfb",
    },
    dark: {
      background: "#141c1b",
      card: "#1c2624",
      muted: "#24302e",
      accent: "#1e3330",
      tint: "#1e3330",
      sidebar: "#161f1e",
      border: "#2e3c39",
      surfaceSoft: "#1a2221",
    },
  },
  sky: {
    label: "天空蓝",
    hex: "#55A3FF",
    deep: "#3D8FE6",
    light: {
      background: "#f2f7fc",
      card: "#ffffff",
      muted: "#e6eef8",
      accent: "#e4eefc",
      tint: "#d6e6fa",
      sidebar: "#eaf2fb",
      border: "#d0dff0",
      surfaceSoft: "#f7fafd",
    },
    dark: {
      background: "#131820",
      card: "#1b2230",
      muted: "#243044",
      accent: "#1e2a38",
      tint: "#1e2a38",
      sidebar: "#151b26",
      border: "#2c384c",
      surfaceSoft: "#181f2a",
    },
  },
  violet: {
    label: "罗兰紫",
    hex: "#8B7FD8",
    deep: "#7366C4",
    light: {
      background: "#f6f4fb",
      card: "#ffffff",
      muted: "#eeeaf7",
      accent: "#ece8f8",
      tint: "#e2dcf4",
      sidebar: "#f1eef9",
      border: "#ddd5ee",
      surfaceSoft: "#faf8fd",
    },
    dark: {
      background: "#17151f",
      card: "#221f2c",
      muted: "#2e2a3c",
      accent: "#2a2640",
      tint: "#2a2640",
      sidebar: "#1a1824",
      border: "#3a354c",
      surfaceSoft: "#1d1b28",
    },
  },
  coral: {
    label: "珊瑚红",
    hex: "#FF6B6B",
    deep: "#E85555",
    light: {
      background: "#fcf4f3",
      card: "#ffffff",
      muted: "#f7e9e8",
      accent: "#fceceb",
      tint: "#f9dddb",
      sidebar: "#faf0ef",
      border: "#efd4d2",
      surfaceSoft: "#fdf8f7",
    },
    dark: {
      background: "#1c1515",
      card: "#281c1c",
      muted: "#382828",
      accent: "#3a2424",
      tint: "#3a2424",
      sidebar: "#1f1717",
      border: "#4a3333",
      surfaceSoft: "#221919",
    },
  },
  amber: {
    label: "琥珀黄",
    hex: "#F6B042",
    deep: "#E09828",
    light: {
      background: "#fbf7f0",
      card: "#ffffff",
      muted: "#f5ecdc",
      accent: "#f8f0e0",
      tint: "#f3e4c8",
      sidebar: "#f8f3ea",
      border: "#eadcbf",
      surfaceSoft: "#fdfaf5",
    },
    dark: {
      background: "#1a1712",
      card: "#262218",
      muted: "#353022",
      accent: "#3a3220",
      tint: "#3a3220",
      sidebar: "#1d1a14",
      border: "#453d2c",
      surfaceSoft: "#201c16",
    },
  },
  rose: {
    label: "玫粉",
    hex: "#E8718E",
    deep: "#D45C78",
    light: {
      background: "#fcf4f6",
      card: "#ffffff",
      muted: "#f7e8ec",
      accent: "#fce8ee",
      tint: "#f8d9e2",
      sidebar: "#faf0f3",
      border: "#efd3db",
      surfaceSoft: "#fdf8f9",
    },
    dark: {
      background: "#1c1418",
      card: "#281c22",
      muted: "#382830",
      accent: "#3a2430",
      tint: "#3a2430",
      sidebar: "#1f171b",
      border: "#4a3340",
      surfaceSoft: "#22181c",
    },
  },
  indigo: {
    label: "靛蓝",
    hex: "#5B8DEF",
    deep: "#4578D9",
    light: {
      background: "#f3f6fc",
      card: "#ffffff",
      muted: "#e7edf8",
      accent: "#e6ecfa",
      tint: "#d8e2f6",
      sidebar: "#eef2fa",
      border: "#d2dcf0",
      surfaceSoft: "#f7f9fd",
    },
    dark: {
      background: "#131720",
      card: "#1b2130",
      muted: "#242e44",
      accent: "#1e2740",
      tint: "#1e2740",
      sidebar: "#151a26",
      border: "#2c3650",
      surfaceSoft: "#181d2a",
    },
  },
  forest: {
    label: "森绿",
    hex: "#3DAB7A",
    deep: "#2F9468",
    light: {
      background: "#f2f8f4",
      card: "#ffffff",
      muted: "#e4f0e8",
      accent: "#e2f2e9",
      tint: "#d2e8db",
      sidebar: "#eaf4ee",
      border: "#cfe0d5",
      surfaceSoft: "#f6fbf8",
    },
    dark: {
      background: "#131a16",
      card: "#1c2620",
      muted: "#25342b",
      accent: "#1e3328",
      tint: "#1e3328",
      sidebar: "#161e19",
      border: "#2e3f35",
      surfaceSoft: "#19221c",
    },
  },
};

export const LAYOUT_PRESETS: Record<LayoutMode, { label: string; desc: string }> = {
  sidebar: { label: "侧栏", desc: "桌面左侧导航，移动端底部导航" },
  top: { label: "顶栏", desc: "顶部横向导航，无侧栏与底栏" },
  bottom: { label: "底栏", desc: "全端底部导航，无左侧栏" },
};

export const THEME_MODE_PRESETS: Record<ThemeMode, { label: string }> = {
  light: { label: "浅色" },
  dark: { label: "深色" },
  system: { label: "跟随系统" },
};

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  accent: AccentColor;
  layout: LayoutMode;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setLayout: (layout: LayoutMode) => void;
  toggleMode: () => void;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeLayout(raw: unknown): LayoutMode {
  if (raw === "top" || raw === "bottom" || raw === "sidebar") return raw;
  // 兼容旧版 default/compact/wide
  return "sidebar";
}

function applyAppearance(opts: {
  mode: ThemeMode;
  isDark: boolean;
  accent: AccentColor;
  layout: LayoutMode;
}) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(opts.isDark ? "dark" : "light");
  root.dataset.accent = opts.accent;
  root.dataset.layout = opts.layout;

  const preset = ACCENT_PRESETS[opts.accent] ?? ACCENT_PRESETS.mint;
  const tone = opts.isDark ? preset.dark : preset.light;

  root.style.setProperty("--primary", preset.hex);
  root.style.setProperty("--primary-deep", preset.deep);
  root.style.setProperty("--primary-soft", hexToRgba(preset.hex, opts.isDark ? 0.2 : 0.14));
  root.style.setProperty("--ring", hexToRgba(preset.hex, opts.isDark ? 0.5 : 0.4));
  root.style.setProperty("--sidebar-primary", preset.hex);
  root.style.setProperty("--sidebar-ring", hexToRgba(preset.hex, opts.isDark ? 0.5 : 0.4));
  root.style.setProperty("--chart-1", preset.hex);
  root.style.setProperty("--primary-foreground", opts.isDark ? "#0a0a0a" : "#ffffff");
  root.style.setProperty("--sidebar-primary-foreground", opts.isDark ? "#0a0a0a" : "#ffffff");

  // 表面 / 背景随主题色一起变
  root.style.setProperty("--background", tone.background);
  root.style.setProperty("--card", tone.card);
  root.style.setProperty("--popover", tone.card);
  root.style.setProperty("--muted", tone.muted);
  root.style.setProperty("--accent", tone.accent);
  root.style.setProperty("--tint-mint", tone.tint);
  root.style.setProperty("--sidebar", tone.sidebar);
  root.style.setProperty("--border", tone.border);
  root.style.setProperty("--sidebar-border", tone.border);
  root.style.setProperty("--surface-soft", tone.surfaceSoft);
  root.style.setProperty("--input-background", tone.card);
  root.style.setProperty("--sidebar-accent", tone.accent);

  if (opts.isDark) {
    document.body.setAttribute("arco-theme", "dark");
  } else {
    document.body.removeAttribute("arco-theme");
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "light",
      isDark: false,
      accent: "mint",
      layout: "sidebar",

      setMode: (mode) => {
        const isDark = resolveIsDark(mode);
        const { accent, layout } = get();
        applyAppearance({ mode, isDark, accent, layout });
        set({ mode, isDark });
      },

      setAccent: (accent) => {
        const { mode, isDark, layout } = get();
        applyAppearance({ mode, isDark, accent, layout });
        set({ accent });
      },

      setLayout: (layout) => {
        const next = normalizeLayout(layout);
        const { mode, isDark, accent } = get();
        applyAppearance({ mode, isDark, accent, layout: next });
        set({ layout: next });
      },

      toggleMode: () => {
        const next = get().isDark ? "light" : "dark";
        get().setMode(next);
      },
    }),
    {
      name: "cloudsteps-theme",
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const isDark = resolveIsDark(state.mode);
        state.isDark = isDark;
        state.layout = normalizeLayout(state.layout);
        applyAppearance({
          mode: state.mode,
          isDark,
          accent: state.accent ?? "mint",
          layout: state.layout,
        });
      },
    }
  )
);

export function bindSystemThemeListener() {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    const { mode, setMode } = useThemeStore.getState();
    if (mode === "system") setMode("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function getAccentHex(): string {
  const accent = useThemeStore.getState().accent ?? "mint";
  return ACCENT_PRESETS[accent]?.hex ?? ACCENT_PRESETS.mint.hex;
}
