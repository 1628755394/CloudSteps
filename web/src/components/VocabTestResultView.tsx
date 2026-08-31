import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export type VocabTestResultPayload = {
  level: string;
  estimatedVocab: number;
  correctCount: number;
  totalCount: number;
};

const LEVELS = [
  "L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11",
] as const;
export type VocabLevel = (typeof LEVELS)[number];

export const VOCAB_LEVEL_MAP: Record<VocabLevel, number> = {
  L0: 100,
  L1: 300,
  L2: 500,
  L3: 800,
  L4: 1200,
  L5: 1800,
  L6: 2500,
  L7: 3500,
  L8: 5000,
  L9: 7000,
  L10: 10000,
  L11: 15000,
};

/** 细分学段/考试表述 i18n key（金字塔与结果页主展示） */
export const VOCAB_LEVEL_KEY: Record<VocabLevel, string> = {
  L0: "vocab_test.level.L0",
  L1: "vocab_test.level.L1",
  L2: "vocab_test.level.L2",
  L3: "vocab_test.level.L3",
  L4: "vocab_test.level.L4",
  L5: "vocab_test.level.L5",
  L6: "vocab_test.level.L6",
  L7: "vocab_test.level.L7",
  L8: "vocab_test.level.L8",
  L9: "vocab_test.level.L9",
  L10: "vocab_test.level.L10",
  L11: "vocab_test.level.L11",
};

/** 结果图阶梯 i18n key：启蒙 / 筑基 / 拾阶 / 臻学（臻学仅初阶、进阶两层） */
export const VOCAB_PYRAMID_STAGE: Record<VocabLevel, { stageKey: string; rungKey: string }> = {
  L0: { stageKey: "vocab_test.stage.enlighten", rungKey: "vocab_test.rung.beginner" },
  L1: { stageKey: "vocab_test.stage.enlighten", rungKey: "vocab_test.rung.basic" },
  L2: { stageKey: "vocab_test.stage.enlighten", rungKey: "vocab_test.rung.advanced" },
  L3: { stageKey: "vocab_test.stage.foundation", rungKey: "vocab_test.rung.beginner" },
  L4: { stageKey: "vocab_test.stage.foundation", rungKey: "vocab_test.rung.basic" },
  L5: { stageKey: "vocab_test.stage.foundation", rungKey: "vocab_test.rung.advanced" },
  L6: { stageKey: "vocab_test.stage.ascent", rungKey: "vocab_test.rung.beginner" },
  L7: { stageKey: "vocab_test.stage.ascent", rungKey: "vocab_test.rung.basic" },
  L8: { stageKey: "vocab_test.stage.ascent", rungKey: "vocab_test.rung.advanced" },
  L9: { stageKey: "vocab_test.stage.mastery", rungKey: "vocab_test.rung.beginner" },
  L10: { stageKey: "vocab_test.stage.mastery", rungKey: "vocab_test.rung.advanced" },
  L11: { stageKey: "vocab_test.stage.mastery", rungKey: "vocab_test.rung.advanced" },
};

export function vocabPyramidLabel(lv: VocabLevel, t: (key: string) => string): string {
  const { stageKey, rungKey } = VOCAB_PYRAMID_STAGE[lv];
  return `${t(stageKey)} · ${t(rungKey)}`;
}

const PYRAMID_ROWS: Array<{
  stageKey: string;
  stageColor: string;
  left: string;
  top: string;
  height: string;
  levels: Array<{ level: VocabLevel; rungKey: string; color: string }>;
}> = [
  {
    stageKey: "vocab_test.stage.mastery",
    stageColor: "#16805E",
    left: "77%",
    top: "0%",
    height: "24%",
    levels: [
      { level: "L10", rungKey: "vocab_test.rung.advanced", color: "#16805E" },
      { level: "L9", rungKey: "vocab_test.rung.beginner", color: "#2EA789" },
    ],
  },
  {
    stageKey: "vocab_test.stage.ascent",
    stageColor: "#4DAA48",
    left: "54%",
    top: "25%",
    height: "24%",
    levels: [
      { level: "L8", rungKey: "vocab_test.rung.advanced", color: "#4DAA48" },
      { level: "L7", rungKey: "vocab_test.rung.basic", color: "#69C47E" },
      { level: "L6", rungKey: "vocab_test.rung.beginner", color: "#93E1C2" },
    ],
  },
  {
    stageKey: "vocab_test.stage.foundation",
    stageColor: "#FFAD00",
    left: "31.5%",
    top: "50%",
    height: "24%",
    levels: [
      { level: "L5", rungKey: "vocab_test.rung.advanced", color: "#FFAD00" },
      { level: "L4", rungKey: "vocab_test.rung.basic", color: "#FFCA00" },
      { level: "L3", rungKey: "vocab_test.rung.beginner", color: "#FFE3A8" },
    ],
  },
  {
    stageKey: "vocab_test.stage.enlighten",
    stageColor: "#E74718",
    left: "13.5%",
    top: "75%",
    height: "25%",
    levels: [
      { level: "L2", rungKey: "vocab_test.rung.advanced", color: "#E74718" },
      { level: "L1", rungKey: "vocab_test.rung.basic", color: "#F56548" },
      { level: "L0", rungKey: "vocab_test.rung.beginner", color: "#FA8876" },
    ],
  },
];

/** 对应 CEFR 参考 */
export const VOCAB_LEVEL_CEFR: Record<VocabLevel, string> = {
  L0: "Pre-A1",
  L1: "A1",
  L2: "A1+",
  L3: "A2",
  L4: "A2+",
  L5: "B1",
  L6: "B1+",
  L7: "B2",
  L8: "B2+",
  L9: "C1",
  L10: "C1+",
  L11: "C2",
};

/** 旧 CEFR 级别 → 新细分级别映射（兼容后端返回 A1~C1） */
const LEGACY_CEFR_TO_LEVEL: Record<string, VocabLevel> = {
  A1: "L1",
  A2: "L3",
  B1: "L5",
  B2: "L7",
  C1: "L9",
};

/** 根据估算词汇量精确匹配最接近的细分级别 */
export const vocabToLevel = (vocab: number): VocabLevel => {
  let result: VocabLevel = "L0";
  for (const lv of LEVELS) {
    if (vocab >= VOCAB_LEVEL_MAP[lv]) result = lv;
  }
  return result;
};

export const clampVocabLevel = (lv: string): VocabLevel => {
  const up = String(lv || "").toUpperCase();
  if (up in LEGACY_CEFR_TO_LEVEL) return LEGACY_CEFR_TO_LEVEL[up] as VocabLevel;
  return (LEVELS.find((x) => x === up) as VocabLevel) || "L0";
};

/** 根据估算词汇量给出中文水平描述的 i18n key（面向学生/家长，不用 CEFR） */
export const vocabToChineseLevelKey = (vocab: number): string => {
  if (vocab < 200) return "vocab_test.cn_level.0";
  if (vocab < 500) return "vocab_test.cn_level.1";
  if (vocab < 800) return "vocab_test.cn_level.2";
  if (vocab < 1200) return "vocab_test.cn_level.3";
  if (vocab < 1800) return "vocab_test.cn_level.4";
  if (vocab < 2500) return "vocab_test.cn_level.5";
  if (vocab < 3500) return "vocab_test.cn_level.6";
  if (vocab < 5000) return "vocab_test.cn_level.7";
  if (vocab < 7000) return "vocab_test.cn_level.8";
  if (vocab < 10000) return "vocab_test.cn_level.9";
  return "vocab_test.cn_level.10";
};

/** 能力导向说明 i18n key：现在大致能做什么 / 还做不到什么 */
export const vocabCapabilityKeys = (vocab: number): { canDoKey: string; nextStepKey: string } => {
  if (vocab < 200) {
    return {
      canDoKey: "vocab_test.cap.0.canDo",
      nextStepKey: "vocab_test.cap.0.nextStep",
    };
  }
  if (vocab < 500) {
    return {
      canDoKey: "vocab_test.cap.1.canDo",
      nextStepKey: "vocab_test.cap.1.nextStep",
    };
  }
  if (vocab < 800) {
    return {
      canDoKey: "vocab_test.cap.2.canDo",
      nextStepKey: "vocab_test.cap.2.nextStep",
    };
  }
  if (vocab < 1200) {
    return {
      canDoKey: "vocab_test.cap.3.canDo",
      nextStepKey: "vocab_test.cap.3.nextStep",
    };
  }
  if (vocab < 1800) {
    return {
      canDoKey: "vocab_test.cap.4.canDo",
      nextStepKey: "vocab_test.cap.4.nextStep",
    };
  }
  if (vocab < 2500) {
    return {
      canDoKey: "vocab_test.cap.5.canDo",
      nextStepKey: "vocab_test.cap.5.nextStep",
    };
  }
  if (vocab < 3500) {
    return {
      canDoKey: "vocab_test.cap.6.canDo",
      nextStepKey: "vocab_test.cap.6.nextStep",
    };
  }
  if (vocab < 5000) {
    return {
      canDoKey: "vocab_test.cap.7.canDo",
      nextStepKey: "vocab_test.cap.7.nextStep",
    };
  }
  if (vocab < 7000) {
    return {
      canDoKey: "vocab_test.cap.8.canDo",
      nextStepKey: "vocab_test.cap.8.nextStep",
    };
  }
  if (vocab < 10000) {
    return {
      canDoKey: "vocab_test.cap.9.canDo",
      nextStepKey: "vocab_test.cap.9.nextStep",
    };
  }
  return {
    canDoKey: "vocab_test.cap.10.canDo",
    nextStepKey: "vocab_test.cap.10.nextStep",
  };
};

export function buildVocabTestSummary(result: VocabTestResultPayload) {
  const legacyLv = clampVocabLevel(result.level);
  const approxByLevel = VOCAB_LEVEL_MAP[legacyLv];
  const vocab = result.estimatedVocab || approxByLevel;
  // 用估算词汇量精确匹配细分级别，比后端粗粒度 CEFR 更准
  const level = vocabToLevel(vocab);
  return {
    level,
    approxByLevel,
    chineseLevelKey: vocabToChineseLevelKey(vocab),
    capabilityKeys: vocabCapabilityKeys(vocab),
    vocab,
  };
}

type VocabTestResultViewProps = {
  result: VocabTestResultPayload;
  /** 紧凑模式：用于弹层，隐藏金字塔可选用 compact */
  compact?: boolean;
  className?: string;
};

export function VocabTestResultView({
  result,
  compact = false,
  className = "",
}: VocabTestResultViewProps) {
  const { t } = useTranslation();
  const accuracy = useMemo(() => {
    if (!result.totalCount) return 0;
    return Math.round((result.correctCount / result.totalCount) * 100);
  }, [result]);

  const summary = useMemo(() => buildVocabTestSummary(result), [result]);
  const pyramidRef = useRef<HTMLDivElement>(null);
  const levelRefs = useRef<Partial<Record<VocabLevel, HTMLDivElement | null>>>({});
  const [marker, setMarker] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const pyramid = pyramidRef.current;
    const levelElement = levelRefs.current[summary.level];
    if (!pyramid || !levelElement) {
      setMarker(null);
      return;
    }

    const measureMarker = () => {
      const pyramidRect = pyramid.getBoundingClientRect();
      const levelRect = levelElement.getBoundingClientRect();
      setMarker({
        left: pyramidRect.width + 12,
        top: levelRect.top - pyramidRect.top + levelRect.height / 2,
      });
    };

    measureMarker();
    const observer = new ResizeObserver(measureMarker);
    observer.observe(pyramid);
    window.addEventListener("resize", measureMarker);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureMarker);
    };
  }, [summary.level]);

  return (
    <div className={`w-full min-w-0 space-y-4 ${className}`}>
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-[#E2E8F0]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-[#718096]">{t("vocab_test.vocab_level")}</div>
            <div className="text-xl font-bold text-[#2D3748] mt-1">{t(summary.chineseLevelKey)}</div>
            <div className="text-xs text-[#A0AEC0] mt-1">
              {t("vocab_test.approx_equal", { pyramidLabel: vocabPyramidLabel(summary.level, t), levelZh: t(VOCAB_LEVEL_KEY[summary.level]) })}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#4ECDC4]/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-[#4ECDC4]" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl bg-[#F7F9FC] p-2 sm:p-3">
            <div className="text-xs text-[#718096]">{t("vocab_test.estimated_vocab")}</div>
            <div className="text-lg font-semibold text-[#2D3748] mt-1">{summary.vocab}</div>
          </div>
          <div className="rounded-xl bg-[#F7F9FC] p-2 sm:p-3">
            <div className="text-xs text-[#718096]">{t("vocab_test.correct")}</div>
            <div className="text-lg font-semibold text-[#2D3748] mt-1">
              {result.correctCount}/{result.totalCount}
            </div>
          </div>
          <div className="rounded-xl bg-[#F7F9FC] p-2 sm:p-3">
            <div className="text-xs text-[#718096]">{t("vocab_test.accuracy")}</div>
            <div className="text-lg font-semibold text-[#2D3748] mt-1">{accuracy}%</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-[#E2E8F0]">
        {!compact && (
          <>
            <div className="text-base font-semibold text-[#2D3748]">{t("vocab_test.pyramid_title")}</div>
            <div className="text-sm text-[#718096] mt-1">
              {t("vocab_test.pyramid_desc", { label: vocabPyramidLabel(summary.level, t) })}
            </div>

            <div
              className="mt-5 relative mx-auto w-full max-w-[36rem] min-w-0 overflow-visible"
              aria-label={t("vocab_test.pyramid_aria")}
            >
              <div
                ref={pyramidRef}
                className="relative mr-auto aspect-[1024/629] w-[calc(100%-3.5rem)] overflow-visible"
              >
              {PYRAMID_ROWS.map((row) => (
                <div
                  key={row.stageKey}
                  className="absolute inset-x-0"
                  style={{ top: row.top, height: row.height }}
                >
                  <div
                    className="absolute top-1/2 w-[13%] -translate-y-1/2 text-right text-[clamp(0.75rem,2.6vw,1.6rem)] font-extrabold leading-none"
                    style={{ left: `max(0px, calc(${row.left} - 13.5%))`, color: row.stageColor }}
                  >
                    {t(row.stageKey)}
                  </div>
                  <div
                    className="absolute inset-y-0 right-0 flex flex-col overflow-hidden rounded-tl-[2.5rem]"
                    style={{ left: row.left }}
                  >
                    {row.levels.map((item) => (
                      <div
                        key={item.level}
                        ref={(element) => {
                          levelRefs.current[item.level] = element;
                        }}
                        data-stage={t(row.stageKey)}
                        data-rung={t(item.rungKey)}
                        title={t("vocab_test.pyramid_rung_title", { stage: t(row.stageKey), rung: t(item.rungKey), vocab: VOCAB_LEVEL_MAP[item.level] })}
                        className="flex min-w-0 flex-1 cursor-default items-center justify-center text-[clamp(0.7rem,2.25vw,1.4rem)] font-extrabold leading-none text-white transition-[filter,box-shadow] duration-200 hover:z-10 hover:brightness-110 hover:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.75)]"
                        style={{ backgroundColor: item.color }}
                      >
                        {t(item.rungKey)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              </div>
              {marker && (
                <div
                  className="absolute z-10 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-[#2D3748] pointer-events-none"
                  style={{ left: marker.left, top: marker.top }}
                >
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-[#4ECDC4] shadow-[0_1px_4px_rgba(45,55,72,0.45)]" />
                  {t("vocab_test.your_position")}
                </div>
              )}
            </div>
          </>
        )}

        <div className={`${compact ? "" : "mt-4"} rounded-xl bg-[#F7F9FC] p-4 space-y-2`}>
          <div className="text-sm font-semibold text-[#2D3748]">{t("vocab_test.summary_title")}</div>
          <p className="text-sm text-[#718096] leading-relaxed">
            {t("vocab_test.summary_desc", { level: t(summary.chineseLevelKey), vocab: summary.vocab })}
          </p>
          <p className="text-sm text-[#2D3748] leading-relaxed">{t(summary.capabilityKeys.canDoKey)}</p>
          <p className="text-sm text-[#718096] leading-relaxed">{t(summary.capabilityKeys.nextStepKey)}</p>
          <p className="text-xs text-[#A0AEC0]">
            {t("vocab_test.result_tip")}
          </p>
        </div>
      </div>
    </div>
  );
}
