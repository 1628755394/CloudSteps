import { useEffect, useMemo, useState } from "react";
import { CloudButton } from "../components/cloudsteps";
import { useNavigate } from "react-router";
import { ChevronLeft, RefreshCw, TrendingUp } from "lucide-react";

import { getVocabResult } from "../api/vocab";
import {
  clearVocabTestResultCache,
  refreshVocabTestQuestions,
} from "../utils/vocabTestCache";

type ResultPayload = {
  level: string;
  estimatedVocab: number;
  correctCount: number;
  totalCount: number;
  levelStats?: Record<
    string,
    {
      total: number;
      correct: number;
      correctRate: number;
      weightedRate?: number;
    }
  >;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
type Level = (typeof LEVELS)[number];

const VOCAB_MAP: Record<Level, number> = {
  A1: 300,
  A2: 1000,
  B1: 2500,
  B2: 4000,
  C1: 6000,
};

const clampLevel = (lv: string): Level => {
  const up = String(lv || "").toUpperCase();
  return (LEVELS.find((x) => x === up) as Level) || "A1";
};

/** 根据估算词汇量给出中文水平描述（面向学生/家长，不用 CEFR） */
const vocabToChineseLevel = (vocab: number): string => {
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
const vocabCapability = (vocab: number): { canDo: string; nextStep: string } => {
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

export default function VocabularyTestResult() {
  const navigate = useNavigate();
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const cached = sessionStorage.getItem("vocabulary_test_result");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (mounted) setResult(parsed);
          return;
        }

        const res = await getVocabResult();
        if (res.code === 200) {
          const r = res.data?.record;
          if (r) {
            const mapped: ResultPayload = {
              level: r.estimatedLevel,
              estimatedVocab: r.estimatedVocab,
              correctCount: r.correctCount,
              totalCount: r.questionCount,
            };
            if (mounted) setResult(mapped);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!result) return;
    refreshVocabTestQuestions().catch(() => {});
  }, [result]);

  const accuracy = useMemo(() => {
    if (!result || !result.totalCount) return 0;
    return Math.round((result.correctCount / result.totalCount) * 100);
  }, [result]);

  const summary = useMemo(() => {
    if (!result) return null;
    const lv = clampLevel(result.level);
    const approxByLevel = VOCAB_MAP[lv];
    const vocab = result.estimatedVocab || approxByLevel;
    const chineseLevel = vocabToChineseLevel(vocab);
    const capability = vocabCapability(vocab);
    return {
      level: lv,
      approxByLevel,
      chineseLevel,
      capability,
      vocab,
    };
  }, [result]);

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-20">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center h-11 px-3">
          <CloudButton
            type="button"
            variant="ghost"
            size="iconRound"
            onClick={() => navigate("/material-selection", { replace: true })}
            className="mr-2"
          >
            <ChevronLeft size={18} className="text-[#2D3748]" />
          </CloudButton>
          <span className="text-sm font-semibold text-[#2D3748]">测试结果</span>
        </div>
      </div>

      <div className="pt-14 px-4">
        {loading ? (
          <div className="max-w-2xl mx-auto text-center text-[#718096] py-16">
            结果加载中...
          </div>
        ) : !result ? (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl p-8 text-center shadow-sm border border-[#E2E8F0]">
            <div className="text-[#2D3748] font-semibold text-base">暂无测试结果</div>
            <div className="text-[#718096] text-sm mt-2">去开始一次词汇量测试吧</div>
            <CloudButton
              variant="brand"
              size="pill"
              className="mt-6 w-full"
              onClick={() => navigate("/material-selection", { replace: true })}
            >
              返回资料选择
            </CloudButton>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E8F0]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-[#718096]">词汇水平</div>
                  <div className="text-xl font-bold text-[#2D3748] mt-1">
                    {summary?.chineseLevel || "—"}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#4ECDC4]/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-[#4ECDC4]" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#F7F9FC] p-3">
                  <div className="text-xs text-[#718096]">估算词汇量</div>
                  <div className="text-lg font-semibold text-[#2D3748] mt-1">
                    {result.estimatedVocab}
                  </div>
                </div>
                <div className="rounded-xl bg-[#F7F9FC] p-3">
                  <div className="text-xs text-[#718096]">正确</div>
                  <div className="text-lg font-semibold text-[#2D3748] mt-1">
                    {result.correctCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#F7F9FC] p-3">
                  <div className="text-xs text-[#718096]">正确率</div>
                  <div className="text-lg font-semibold text-[#2D3748] mt-1">{accuracy}%</div>
                </div>
              </div>
            </div>

            {summary && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E8F0]">
                <div className="text-base font-semibold text-[#2D3748]">词汇量金字塔</div>
                <div className="text-sm text-[#718096] mt-1">
                  高亮层为本次测评落点，越高表示词汇面越宽。
                </div>

                <div className="mt-5 flex flex-col items-center gap-2">
                  {[...LEVELS].reverse().map((lv, idx) => {
                    const isActive = lv === summary.level;
                    const widthPct = 55 + idx * 10;
                    const vocabHint = VOCAB_MAP[lv];
                    return (
                      <div
                        key={lv}
                        className={`rounded-xl px-4 py-3 border w-full transition-colors ${
                          isActive
                            ? "bg-[#4ECDC4]/10 border-[#4ECDC4]"
                            : "bg-[#F7F9FC] border-[#E2E8F0]"
                        }`}
                        style={{ maxWidth: `${widthPct}%` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-[#2D3748]">{lv}</div>
                          <div className="text-xs text-[#718096]">约 {vocabHint}+</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl bg-[#F7F9FC] p-4 space-y-2">
                  <div className="text-sm font-semibold text-[#2D3748]">本次自测总结</div>
                  <p className="text-sm text-[#718096] leading-relaxed">
                    当前大约相当于{" "}
                    <span className="text-[#2D3748] font-semibold">{summary.chineseLevel}</span>
                    （估算约{" "}
                    <span className="text-[#2D3748] font-semibold">{summary.vocab}</span> 词）。
                  </p>
                  <p className="text-sm text-[#2D3748] leading-relaxed">
                    {summary.capability.canDo}
                  </p>
                  <p className="text-sm text-[#718096] leading-relaxed">
                    {summary.capability.nextStep}
                  </p>
                  <p className="text-xs text-[#A0AEC0]">
                    结果仅作起点参考，可据此安排正课与抗遗忘；选择「不认识」有助于更快贴近真实水平。
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <CloudButton
                variant="brand"
                size="pill"
                className="flex-1"
                onClick={() => {
                  clearVocabTestResultCache();
                  navigate("/vocabulary-test/testing", { replace: true });
                }}
              >
                重新测试
              </CloudButton>
              <CloudButton
                variant="outline"
                size="pill"
                className="flex-1"
                onClick={() => navigate("/material-selection", { replace: true })}
              >
                返回资料选择
              </CloudButton>
            </div>

            <CloudButton
              variant="outline"
              size="pill"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4" /> 刷新结果
            </CloudButton>
          </div>
        )}
      </div>
    </div>
  );
}
