import { useCallback, useEffect, useState } from "react";
import { Settings, Type, Check, Minus, Plus, Bold } from "lucide-react";
import { CloudButton } from "./cloudsteps";

const STORAGE_KEY = "lb_practice_display";

export type PracticeFontFamily =
  | "sans"
  | "nunito"
  | "serif"
  | "italic"
  | "italian";

type PracticeDisplaySettings = {
  /** 单词字号，单位 px */
  wordSizePx: number;
  fontFamily: PracticeFontFamily;
  bold: boolean;
};

const FAMILY_PRESETS: Record<
  PracticeFontFamily,
  { label: string; value: string; style?: "italic" | "normal" }
> = {
  sans: {
    label: "默认",
    value:
      'Plus Jakarta Sans, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  },
  nunito: {
    label: "圆润",
    value: 'Nunito, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  serif: {
    label: "衬线",
    value: 'Georgia, "Songti SC", "Noto Serif SC", "STSong", serif',
  },
  italic: {
    label: "斜体",
    value: '"Palatino Linotype", Palatino, "Times New Roman", serif',
    style: "italic",
  },
  italian: {
    label: "意大利体",
    value: '"Brush Script MT", "Segoe Script", "Apple Chancery", cursive',
    style: "italic",
  },
};

/** 单词字号范围（px） */
const WORD_SIZE_MIN = 14;
const WORD_SIZE_MAX = 48;
const WORD_SIZE_STEP = 1;
const WORD_SIZE_DEFAULT = 26;

const DEFAULTS: PracticeDisplaySettings = {
  wordSizePx: WORD_SIZE_DEFAULT,
  fontFamily: "sans",
  bold: false,
};

/** 释义相对单词略小 */
function translationSizePx(wordPx: number): number {
  return Math.max(12, Math.round(wordPx * 0.62));
}

function clampWordSize(n: number): number {
  if (!Number.isFinite(n)) return WORD_SIZE_DEFAULT;
  return Math.min(WORD_SIZE_MAX, Math.max(WORD_SIZE_MIN, Math.round(n)));
}

/** 兼容旧版 md/lg/xl 预设 */
function migrateLegacySize(raw: unknown): number | null {
  if (typeof raw === "number") return clampWordSize(raw);
  if (raw === "md") return 20;
  if (raw === "lg") return 26;
  if (raw === "xl") return 32;
  return null;
}

function migrateFontFamily(raw: unknown): PracticeFontFamily {
  if (typeof raw === "string" && raw in FAMILY_PRESETS) {
    return raw as PracticeFontFamily;
  }
  return DEFAULTS.fontFamily;
}

function readSettings(): PracticeDisplaySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const fromPx = migrateLegacySize(parsed.wordSizePx);
    const fromLegacy = migrateLegacySize(parsed.fontSize);
    const wordSizePx = fromPx ?? fromLegacy ?? DEFAULTS.wordSizePx;
    const fontFamily = migrateFontFamily(parsed.fontFamily);
    const bold = typeof parsed.bold === "boolean" ? parsed.bold : DEFAULTS.bold;
    return { wordSizePx: clampWordSize(wordSizePx), fontFamily, bold };
  } catch {
    return { ...DEFAULTS };
  }
}

function applyCssVars(settings: PracticeDisplaySettings) {
  const root = document.documentElement;
  const wordPx = clampWordSize(settings.wordSizePx);
  const family = FAMILY_PRESETS[settings.fontFamily] ?? FAMILY_PRESETS.sans;
  root.style.setProperty("--practice-word-size", `${wordPx}px`);
  root.style.setProperty("--practice-trans-size", `${translationSizePx(wordPx)}px`);
  root.style.setProperty("--practice-font-family", family.value);
  root.style.setProperty("--practice-font-weight", settings.bold ? "700" : "500");
  root.style.setProperty(
    "--practice-font-style",
    family.style === "italic" ? "italic" : "normal"
  );
}

// 尽早应用已保存偏好（默认字号偏大）
if (typeof document !== "undefined") {
  applyCssVars(readSettings());
}

/** 单词展示样式：练习页统一挂这个 class */
export const PRACTICE_WORD_CLASS =
  "practice-word text-[#2D3748] [font-family:var(--practice-font-family)] [font-size:var(--practice-word-size)] [font-weight:var(--practice-font-weight)] [font-style:var(--practice-font-style)]";

export const PRACTICE_TRANS_CLASS =
  "practice-translation text-[#718096] [font-family:var(--practice-font-family)] [font-size:var(--practice-trans-size)]";

/**
 * 练习页右上角：可精确调节字号（px）+ 字体族（localStorage 持久化）。
 */
export function PracticeFontSettingsButton() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<PracticeDisplaySettings>(DEFAULTS);

  useEffect(() => {
    const next = readSettings();
    setSettings(next);
    applyCssVars(next);
  }, []);

  const update = useCallback((patch: Partial<PracticeDisplaySettings>) => {
    setSettings((prev) => {
      const next: PracticeDisplaySettings = {
        wordSizePx: clampWordSize(patch.wordSizePx ?? prev.wordSizePx),
        fontFamily: patch.fontFamily ?? prev.fontFamily,
        bold: patch.bold ?? prev.bold,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      applyCssVars(next);
      return next;
    });
  }, []);

  const bump = (delta: number) => {
    update({ wordSizePx: settings.wordSizePx + delta });
  };

  const previewFamily = FAMILY_PRESETS[settings.fontFamily];

  return (
    <div className="relative">
      <CloudButton
        type="button"
        variant="ghost"
        size="iconRound"
        aria-label="显示设置"
        title="显示设置"
        onClick={() => setOpen((v) => !v)}
        className={open ? "bg-primary-soft text-primary" : ""}
      >
        <Settings size={18} className="text-[#2D3748]" />
      </CloudButton>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="关闭设置"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-[#E2E8F0] bg-white shadow-lg p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#718096] mb-2">
              <Type size={14} />
              单词显示
            </div>

            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-[#A0AEC0]">字号</span>
              <span className="text-xs font-semibold tabular-nums text-[#2D3748]">
                {settings.wordSizePx}px
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                aria-label="减小字号"
                disabled={settings.wordSizePx <= WORD_SIZE_MIN}
                onClick={() => bump(-WORD_SIZE_STEP)}
                className="shrink-0 size-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#2D3748] hover:border-primary/40 disabled:opacity-40"
              >
                <Minus size={14} />
              </button>
              <input
                type="range"
                min={WORD_SIZE_MIN}
                max={WORD_SIZE_MAX}
                step={WORD_SIZE_STEP}
                value={settings.wordSizePx}
                onChange={(e) => update({ wordSizePx: Number(e.target.value) })}
                className="flex-1 accent-[#4ECDC4] h-1.5 cursor-pointer"
                aria-label="单词字号"
              />
              <button
                type="button"
                aria-label="增大字号"
                disabled={settings.wordSizePx >= WORD_SIZE_MAX}
                onClick={() => bump(WORD_SIZE_STEP)}
                className="shrink-0 size-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#2D3748] hover:border-primary/40 disabled:opacity-40"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[10px] text-[#A0AEC0]">{WORD_SIZE_MIN}px</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={WORD_SIZE_MIN}
                  max={WORD_SIZE_MAX}
                  step={WORD_SIZE_STEP}
                  value={settings.wordSizePx}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) update({ wordSizePx: v });
                  }}
                  className="w-14 rounded-md border border-[#E2E8F0] px-1.5 py-0.5 text-xs text-center tabular-nums text-[#2D3748] focus:outline-none focus:border-primary"
                  aria-label="字号数值"
                />
                <span className="text-[10px] text-[#A0AEC0]">px</span>
              </div>
              <span className="text-[10px] text-[#A0AEC0]">{WORD_SIZE_MAX}px</span>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-[#A0AEC0]">加粗</span>
              <button
                type="button"
                aria-label="加粗"
                aria-pressed={settings.bold}
                onClick={() => update({ bold: !settings.bold })}
                className={`size-8 rounded-lg border flex items-center justify-center transition-colors ${
                  settings.bold
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-[#E2E8F0] text-[#2D3748] hover:border-primary/40"
                }`}
              >
                <Bold size={14} />
              </button>
            </div>

            <p
              className="mb-3 rounded-lg bg-[#F7F9FC] px-2.5 py-2 text-center text-[#2D3748] truncate"
              style={{
                fontSize: settings.wordSizePx,
                fontFamily: previewFamily.value,
                fontWeight: settings.bold ? 700 : 500,
                fontStyle: previewFamily.style === "italic" ? "italic" : "normal",
                lineHeight: 1.2,
              }}
            >
              Example
            </p>

            <div className="text-[11px] text-[#A0AEC0] mb-1.5">字体</div>
            <div className="space-y-1">
              {(Object.keys(FAMILY_PRESETS) as PracticeFontFamily[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => update({ fontFamily: id })}
                  className={`w-full flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                    settings.fontFamily === id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-[#E2E8F0] text-[#2D3748] hover:border-primary/40"
                  }`}
                  style={{
                    fontFamily: FAMILY_PRESETS[id].value,
                    fontStyle: FAMILY_PRESETS[id].style === "italic" ? "italic" : "normal",
                  }}
                >
                  <span>{FAMILY_PRESETS[id].label}</span>
                  {settings.fontFamily === id && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
