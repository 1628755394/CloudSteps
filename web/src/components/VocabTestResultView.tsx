import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";

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

/** 细分学段/考试表述（金字塔与结果页主展示） */
export const VOCAB_LEVEL_ZH: Record<VocabLevel, string> = {
  L0: "英语启蒙",
  L1: "小学初级",
  L2: "小学中级",
  L3: "小学高级",
  L4: "初中初级",
  L5: "初中高级",
  L6: "高中 / 四级",
  L7: "高中高级 / 四级优秀",
  L8: "六级 / 考研",
  L9: "雅思 / 托福起步",
  L10: "雅思高分 / 托福",
  L11: "GRE / 学术进阶",
};

/** 结果图阶梯：启蒙 / 筑基 / 拾阶 / 臻学（臻学仅初阶、进阶两层） */
export const VOCAB_PYRAMID_STAGE: Record<VocabLevel, { stage: string; rung: string }> = {
  L0: { stage: "启蒙", rung: "初阶" },
  L1: { stage: "启蒙", rung: "基础" },
  L2: { stage: "启蒙", rung: "进阶" },
  L3: { stage: "筑基", rung: "初阶" },
  L4: { stage: "筑基", rung: "基础" },
  L5: { stage: "筑基", rung: "进阶" },
  L6: { stage: "拾阶", rung: "初阶" },
  L7: { stage: "拾阶", rung: "基础" },
  L8: { stage: "拾阶", rung: "进阶" },
  L9: { stage: "臻学", rung: "初阶" },
  L10: { stage: "臻学", rung: "进阶" },
  L11: { stage: "臻学", rung: "进阶" },
};

export function vocabPyramidLabel(lv: VocabLevel): string {
  const { stage, rung } = VOCAB_PYRAMID_STAGE[lv];
  return `${stage} · ${rung}`;
}

const PYRAMID_ROWS: Array<{
  stage: string;
  stageColor: string;
  left: string;
  top: string;
  height: string;
  levels: Array<{ level: VocabLevel; rung: string; color: string }>;
}> = [
  {
    stage: "臻学",
    stageColor: "#16805E",
    left: "77%",
    top: "0%",
    height: "24%",
    levels: [
      { level: "L10", rung: "进阶", color: "#16805E" },
      { level: "L9", rung: "初阶", color: "#2EA789" },
    ],
  },
  {
    stage: "拾阶",
    stageColor: "#4DAA48",
    left: "54%",
    top: "25%",
    height: "24%",
    levels: [
      { level: "L8", rung: "进阶", color: "#4DAA48" },
      { level: "L7", rung: "基础", color: "#69C47E" },
      { level: "L6", rung: "初阶", color: "#93E1C2" },
    ],
  },
  {
    stage: "筑基",
    stageColor: "#FFAD00",
    left: "31.5%",
    top: "50%",
    height: "24%",
    levels: [
      { level: "L5", rung: "进阶", color: "#FFAD00" },
      { level: "L4", rung: "基础", color: "#FFCA00" },
      { level: "L3", rung: "初阶", color: "#FFE3A8" },
    ],
  },
  {
    stage: "启蒙",
    stageColor: "#E74718",
    left: "13.5%",
    top: "75%",
    height: "25%",
    levels: [
      { level: "L2", rung: "进阶", color: "#E74718" },
      { level: "L1", rung: "基础", color: "#F56548" },
      { level: "L0", rung: "初阶", color: "#FA8876" },
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

/** 根据估算词汇量给出中文水平描述（面向学生/家长，不用 CEFR） */
export const vocabToChineseLevel = (vocab: number): string => {
  if (vocab < 200) return "英语启蒙阶段";
  if (vocab < 500) return "小学初级阶段";
  if (vocab < 800) return "小学中级阶段";
  if (vocab < 1200) return "小学高级阶段";
  if (vocab < 1800) return "初中阶段";
  if (vocab < 2500) return "初中高级阶段";
  if (vocab < 3500) return "高中阶段";
  if (vocab < 5000) return "高中高级 / 大学四级水平";
  if (vocab < 7000) return "大学六级水平";
  if (vocab < 10000) return "考研 / 雅思水平";
  return "托福 / GRE 高级水平";
};

/** 能力导向说明：现在大致能做什么 / 还做不到什么 */
export const vocabCapability = (vocab: number): { canDo: string; nextStep: string } => {
  if (vocab < 200) {
    return {
      canDo:
        "目前大致能认读少量基础单词（如颜色、数字、称呼），尚难独立看懂完整句子或短文。",
      nextStep: "建议先稳住高频启蒙词，配合听音跟读，再过渡到极短句。",
    };
  }
  if (vocab < 500) {
    return {
      canDo:
        "目前大致能认识常见简单词汇，但独立阅读整句、理解短文仍比较吃力。",
      nextStep: "建议巩固小学基础词，多做「看词说义 + 听音辨词」，再逐步接触极简句。",
    };
  }
  if (vocab < 800) {
    return {
      canDo:
        "目前对日常基础词较熟，能勉强看懂很短的简单句，但连贯阅读和听懂完整对话仍不稳定。",
      nextStep: "建议在识词同时加入短句跟读，把「认识单词」推进到「能读懂一句话」。",
    };
  }
  if (vocab < 1200) {
    return {
      canDo:
        "目前能处理多数小学常见词，短句阅读开始成型，但稍长段落或陌生主题仍会卡住。",
      nextStep: "建议扩大主题词（学校、天气、购物等），并用抗遗忘巩固已学词。",
    };
  }
  if (vocab < 1800) {
    return {
      canDo:
        "目前接近初中起步：能读懂简单叙述句，但对复合句、抽象词和稍长短文仍吃力。",
      nextStep: "建议加强动词短语与常见搭配，配合短文精读，提升「句子→段落」的理解。",
    };
  }
  if (vocab < 2500) {
    return {
      canDo:
        "目前能较顺利阅读简易短文，日常话题交流词基本够用，但议论文与考试长难句仍需支撑。",
      nextStep: "建议系统补齐初中核心词，并开始训练段落大意与关键词抓取。",
    };
  }
  if (vocab < 3500) {
    return {
      canDo:
        "目前大致能应对初高中常规阅读中的多数实词，简单说明文可跟读；复杂论证与学术词仍有缺口。",
      nextStep: "建议按主题扩展（科技、社会、环境），并结合错词抗遗忘。",
    };
  }
  if (vocab < 5000) {
    return {
      canDo:
        "目前接近高中 / 四级起步：一般新闻短文与课堂材料可抓大意，细读精确理解仍需词典辅助。",
      nextStep: "建议突破同义替换与多义词，积累写作高频词块。",
    };
  }
  if (vocab < 7000) {
    return {
      canDo:
        "目前大致能独立阅读多数一般英语材料，课堂听力与阅读障碍明显减少；专业/学术文本仍有挑战。",
      nextStep: "建议向六级 / 雅思方向推进：学术词、搭配与长难句精读。",
    };
  }
  if (vocab < 10000) {
    return {
      canDo:
        "目前接近较高阶应试水平：多数议论文与说明文可较顺畅阅读，表达也更精确。",
      nextStep: "建议聚焦低频词、近义辨析与写作地道表达。",
    };
  }
  return {
    canDo:
      "目前词汇面较广，一般学术与专业阅读障碍较小，可支撑较高阶听说读写任务。",
    nextStep: "建议按目标场景（学术、职场、考试）做专题精进即可。",
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
    chineseLevel: vocabToChineseLevel(vocab),
    capability: vocabCapability(vocab),
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
        left: levelRect.left - pyramidRect.left + levelRect.width / 2,
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
            <div className="text-sm text-[#718096]">词汇水平</div>
            <div className="text-xl font-bold text-[#2D3748] mt-1">{summary.chineseLevel}</div>
            <div className="text-xs text-[#A0AEC0] mt-1">
              约相当于{vocabPyramidLabel(summary.level)}（{VOCAB_LEVEL_ZH[summary.level]}）
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#4ECDC4]/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-[#4ECDC4]" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl bg-[#F7F9FC] p-2 sm:p-3">
            <div className="text-xs text-[#718096]">估算词汇量</div>
            <div className="text-lg font-semibold text-[#2D3748] mt-1">{summary.vocab}</div>
          </div>
          <div className="rounded-xl bg-[#F7F9FC] p-2 sm:p-3">
            <div className="text-xs text-[#718096]">正确</div>
            <div className="text-lg font-semibold text-[#2D3748] mt-1">
              {result.correctCount}/{result.totalCount}
            </div>
          </div>
          <div className="rounded-xl bg-[#F7F9FC] p-2 sm:p-3">
            <div className="text-xs text-[#718096]">正确率</div>
            <div className="text-lg font-semibold text-[#2D3748] mt-1">{accuracy}%</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-[#E2E8F0]">
        {!compact && (
          <>
            <div className="text-base font-semibold text-[#2D3748]">词汇量金字塔</div>
            <div className="text-sm text-[#718096] mt-1">
              阶梯越高表示词汇面越宽。本次测评落点为{" "}
              <span className="text-[#4ECDC4] font-semibold">{vocabPyramidLabel(summary.level)}</span>
              。
            </div>

            <div
              ref={pyramidRef}
              className="mt-5 relative mx-auto w-full max-w-[36rem] min-w-0 aspect-[1024/629] overflow-visible"
              aria-label="词汇量金字塔"
            >
              {PYRAMID_ROWS.map((row) => (
                <div
                  key={row.stage}
                  className="absolute inset-x-0"
                  style={{ top: row.top, height: row.height }}
                >
                  <div
                    className="absolute top-1/2 w-[13%] -translate-y-1/2 text-right text-[clamp(0.75rem,2.6vw,1.6rem)] font-extrabold leading-none"
                    style={{ left: `max(0px, calc(${row.left} - 13.5%))`, color: row.stageColor }}
                  >
                    {row.stage}
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
                        data-stage={row.stage}
                        data-rung={item.rung}
                        title={`${row.stage} · ${item.rung}（约 ${VOCAB_LEVEL_MAP[item.level]} 词）`}
                        className="flex min-w-0 flex-1 cursor-default items-center justify-center text-[clamp(0.7rem,2.25vw,1.4rem)] font-extrabold leading-none text-white transition-[filter,box-shadow] duration-200 hover:z-10 hover:brightness-110 hover:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.75)]"
                        style={{ backgroundColor: item.color }}
                      >
                        {item.rung}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {marker && (
                <div
                  className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-[#2D3748] pointer-events-none"
                  style={{ left: marker.left, top: marker.top }}
                >
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-[#4ECDC4] shadow-[0_1px_4px_rgba(45,55,72,0.45)]" />
                  您的位置
                </div>
              )}
            </div>
          </>
        )}

        <div className={`${compact ? "" : "mt-4"} rounded-xl bg-[#F7F9FC] p-4 space-y-2`}>
          <div className="text-sm font-semibold text-[#2D3748]">本次自测总结</div>
          <p className="text-sm text-[#718096] leading-relaxed">
            当前大约相当于{" "}
            <span className="text-[#2D3748] font-semibold">{summary.chineseLevel}</span>
            （估算约 <span className="text-[#2D3748] font-semibold">{summary.vocab}</span> 词）。
          </p>
          <p className="text-sm text-[#2D3748] leading-relaxed">{summary.capability.canDo}</p>
          <p className="text-sm text-[#718096] leading-relaxed">{summary.capability.nextStep}</p>
          <p className="text-xs text-[#A0AEC0]">
            结果仅作起点参考，可据此安排正课与抗遗忘；选择「不认识」有助于更快贴近真实水平。
          </p>
        </div>
      </div>
    </div>
  );
}
