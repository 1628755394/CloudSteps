import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

/** 主题色预设键名 */
export type AccentPresetKey = "mint" | "sky" | "violet" | "coral" | "white";

/** 主题色来源：预设键 或 自定义 hex */
export type AccentColor = AccentPresetKey | "custom";

/**
 * 应用壳布局（真正的导航结构切换，不是宽度微调）
 * - sidebar：桌面左侧栏 + 移动端底栏
 * - top：顶栏横向导航，无侧栏/底栏
 * - bottom：全端底部导航，无侧栏
 */
export type LayoutMode = "sidebar" | "bottom";

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

type AccentPreset = {
  label: string;
  hex: string;
  deep: string;
  light: SurfaceTone;
  dark: SurfaceTone;
};

export const ACCENT_PRESETS: Record<AccentPresetKey, AccentPreset> = {
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
  white: {
    label: "经典白",
    hex: "#6B7280",
    deep: "#4B5563",
    light: {
      background: "#ffffff",
      card: "#ffffff",
      muted: "#f5f5f5",
      accent: "#f0f0f0",
      tint: "#eaeaea",
      sidebar: "#ffffff",
      border: "#e5e5e5",
      surfaceSoft: "#fafafa",
    },
    dark: {
      background: "#0f0f0f",
      card: "#1a1a1a",
      muted: "#262626",
      accent: "#222222",
      tint: "#222222",
      sidebar: "#121212",
      border: "#333333",
      surfaceSoft: "#161616",
    },
  },
};

export const LAYOUT_PRESETS: Record<LayoutMode, { label: string; desc: string }> = {
  sidebar: { label: "侧栏", desc: "桌面左侧导航，移动端底部导航" },
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
  customHex: string; // 自定义颜色 hex，当 accent === "custom" 时使用
  layout: LayoutMode;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setCustomHex: (hex: string) => void;
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

/** 把任意 hex 颜色稍微调深，用于 --primary-deep */
function darkenHex(hex: string, factor = 0.85): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function normalizeLayout(raw: unknown): LayoutMode {
  if (raw === "bottom" || raw === "sidebar") return raw;
  // 兼容旧版 top → sidebar
  return "sidebar";
}

/** 兼容旧版 accent 值（amber/rose/indigo/forest）→ 映射到新预设 */
function normalizeAccent(raw: unknown): AccentColor {
  if (raw === "mint" || raw === "sky" || raw === "violet" || raw === "coral" || raw === "white" || raw === "custom") {
    return raw;
  }
  // 旧版预设映射到最接近的新预设
  return "mint";
}

/** 解析当前主题色对应的 hex + deep + surface tone */
function resolveAccentTone(accent: AccentColor, customHex: string, isDark: boolean) {
  if (accent === "custom") {
    const hex = customHex || "#6B7280";
    const deep = darkenHex(hex, 0.85);
    // 自定义颜色使用中性灰表面
    const tone: SurfaceTone = isDark
      ? { background: "#0f0f0f", card: "#1a1a1a", muted: "#262626", accent: "#222222", tint: "#222222", sidebar: "#121212", border: "#333333", surfaceSoft: "#161616" }
      : { background: "#ffffff", card: "#ffffff", muted: "#f5f5f5", accent: "#f0f0f0", tint: "#eaeaea", sidebar: "#ffffff", border: "#e5e5e5", surfaceSoft: "#fafafa" };
    return { hex, deep, tone };
  }
  const preset = ACCENT_PRESETS[accent] ?? ACCENT_PRESETS.mint;
  return { hex: preset.hex, deep: preset.deep, tone: isDark ? preset.dark : preset.light };
}

function applyAppearance(opts: {
  mode: ThemeMode;
  isDark: boolean;
  accent: AccentColor;
  customHex: string;
  layout: LayoutMode;
}) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(opts.isDark ? "dark" : "light");
  root.dataset.accent = opts.accent;
  root.dataset.layout = opts.layout;

  const { hex, deep, tone } = resolveAccentTone(opts.accent, opts.customHex, opts.isDark);

  root.style.setProperty("--primary", hex);
  root.style.setProperty("--primary-deep", deep);
  root.style.setProperty("--primary-soft", hexToRgba(hex, opts.isDark ? 0.2 : 0.14));
  root.style.setProperty("--ring", hexToRgba(hex, opts.isDark ? 0.5 : 0.4));
  root.style.setProperty("--sidebar-primary", hex);
  root.style.setProperty("--sidebar-ring", hexToRgba(hex, opts.isDark ? 0.5 : 0.4));
  root.style.setProperty("--chart-1", hex);
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
      customHex: "#6B7280",
      layout: "sidebar",

      setMode: (mode) => {
        const isDark = resolveIsDark(mode);
        const { accent, customHex, layout } = get();
        applyAppearance({ mode, isDark, accent, customHex, layout });
        set({ mode, isDark });
      },

      setAccent: (accent) => {
        const { mode, isDark, customHex, layout } = get();
        applyAppearance({ mode, isDark, accent, customHex, layout });
        set({ accent });
      },

      setCustomHex: (hex) => {
        const { mode, isDark, accent, layout } = get();
        // 设置自定义颜色时自动切换到 custom
        const nextAccent: AccentColor = "custom";
        applyAppearance({ mode, isDark, accent: nextAccent, customHex: hex, layout });
        set({ accent: nextAccent, customHex: hex });
      },

      setLayout: (layout) => {
        const next = normalizeLayout(layout);
        const { mode, isDark, accent, customHex } = get();
        applyAppearance({ mode, isDark, accent, customHex, layout: next });
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
        state.accent = normalizeAccent(state.accent);
        applyAppearance({
          mode: state.mode,
          isDark,
          accent: state.accent,
          customHex: state.customHex ?? "#6B7280",
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
  const state = useThemeStore.getState();
  if (state.accent === "custom") return state.customHex || "#6B7280";
  return ACCENT_PRESETS[state.accent]?.hex ?? ACCENT_PRESETS.mint.hex;
}
