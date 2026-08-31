import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import {
  Button,
  Empty,
  Progress,
  Spin,
  Tag,
  Typography,
} from "@arco-design/web-react";
import {
  IconLeft,
  IconCheckCircle,
  IconExclamationCircle,
  IconTrophy,
  IconCommon,
} from "@arco-design/web-react/icon";
import { getSession, getSpeakingStats, ScenarioSession, SpeakingStats } from "@/api/scenarioDialogue";
import { ScenarioIcon } from "@/components/ScenarioIcon";

function ScoreRow({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#718096]">{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>{score}</span>
      </div>
      <Progress percent={score} showText={false} color={color} size="small" />
    </div>
  );
}

function InsightBlock({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  if (!items?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
      <div className="text-sm font-medium text-[#2D3748] mb-2" style={{ borderLeft: `3px solid ${color}`, paddingLeft: 8 }}>
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-[#718096] leading-relaxed flex gap-1.5">
            <span className="text-[#A0AEC0] shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ScenarioReview() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<ScenarioSession | null>(null);
  const [stats, setStats] = useState<SpeakingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Number(sessionId);
    if (!id) return;
    Promise.all([getSession(id), getSpeakingStats()])
      .then(([sRes, stRes]) => {
        if (sRes.code === 200) setSession(sRes.data);
        if (stRes.code === 200) setStats(stRes.data);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <Spin tip={t("scenario.loading_review")} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-3 bg-gray-50">
        <Empty description={t("scenario.session_not_found")} />
        <Button type="primary" onClick={() => navigate("/scenario-dialogues")}>
          {t("scenario.back_to_selection")}
        </Button>
      </div>
    );
  }

  const analysis = session.analysis;
  const assistantTurns = session.turns?.filter((turn) => turn.role === "assistant") || [];
  const userTurns = session.turns?.filter((turn) => turn.role === "user") || [];

  return (
    <div className="h-dvh overflow-hidden bg-gray-50 flex flex-col">
      <div className="bg-white shrink-0 shadow-sm">
        <div className="flex items-center h-11 px-3">
          <Button
            type="text"
            shape="circle"
            icon={<IconLeft style={{ fontSize: 18 }} />}
            onClick={() => navigate(-1)}
            className="-ml-1"
          />
          <Typography.Title heading={6} className="!m-0 flex-1 text-center !text-sm !font-semibold text-[#2D3748] -ml-8">
            {t("scenario.review_title")}
          </Typography.Title>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 pb-6">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-center">
          <div className="w-11 h-11 mx-auto rounded-full bg-[#4ECDC4]/10 flex items-center justify-center mb-2">
            <ScenarioIcon name={session.scenario?.icon} size={22} className="text-[#4ECDC4]" />
          </div>
          <div className="text-base font-semibold text-[#2D3748]">{session.scenario?.name}</div>
          <div className="text-xs text-[#718096] mt-1">
            {t("scenario.effective_turns", {
              turns: session.turnCount,
              minutes: Math.max(1, Math.round(session.durationSec / 60)),
            })}
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-[#2D3748] tabular-nums">{session.overallScore}</span>
            <span className="text-xs text-[#718096] ml-1">{t("scenario.overall_score")}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 space-y-2.5">
          <div className="text-sm font-medium text-[#2D3748]">{t("scenario.speaking_scores")}</div>
          <ScoreRow label={t("scenario.fluency")} score={session.fluencyScore} color="#4ECDC4" />
          <ScoreRow label={t("scenario.accuracy")} score={session.accuracyScore} color="#55A3FF" />
          <ScoreRow label={t("scenario.pronunciation")} score={session.pronunciationScore} color="#66BB6A" />
          {analysis && (
            <>
              <ScoreRow label={t("scenario.vocabulary")} score={analysis.vocabularyScore} color="#FF9800" />
              <ScoreRow label={t("scenario.participation")} score={analysis.participationScore} color="#9C27B0" />
            </>
          )}
        </div>

        {analysis && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
            <div className="text-sm font-medium text-[#2D3748] mb-2.5">{t("scenario.quantitative_metrics")}</div>
            <div className="grid grid-cols-2 gap-2">
              <MetricCell label={t("scenario.speech_rate")} value={t("scenario.words_per_min", { count: Math.round(analysis.wordsPerMinute) })} />
              <MetricCell label={t("scenario.english_ratio")} value={`${Math.round(analysis.englishRatio * 100)}%`} />
              <MetricCell label={t("scenario.english_word_count")} value={String(analysis.userWordCount)} />
              <MetricCell label={t("scenario.unique_words")} value={String(analysis.uniqueWordCount)} />
              <MetricCell label={t("scenario.avg_per_turn")} value={t("scenario.words", { count: Number(analysis.avgWordsPerTurn.toFixed(1)) })} />
              <MetricCell label={t("scenario.chinese_turns")} value={String(analysis.chineseTurnCount)} />
              <MetricCell label={t("scenario.grammar_corrections")} value={String(analysis.explicitCorrections + analysis.implicitCorrections)} />
              <MetricCell label={t("scenario.short_turns")} value={String(analysis.shortTurnCount)} />
            </div>
          </div>
        )}

        {session.reviewSummary && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
            <Typography.Paragraph className="!mb-0 text-sm text-[#2D3748] leading-relaxed">
              {session.reviewSummary}
            </Typography.Paragraph>
          </div>
        )}

        {analysis?.aiAnalysis && (
          <div className="rounded-xl border border-[#4ECDC4]/30 bg-[#4ECDC4]/5 p-3.5">
            <div className="flex items-center gap-1.5 text-sm font-medium text-[#2D3748] mb-2">
              <IconCommon className="text-[#4ECDC4]" />
              {t("scenario.ai_coach_analysis")}
            </div>
            <p className="text-xs text-[#2D3748] leading-relaxed whitespace-pre-wrap">{analysis.aiAnalysis}</p>
          </div>
        )}

        <InsightBlock title={t("scenario.highlights")} items={analysis?.highlights || []} color="#66BB6A" />
        <InsightBlock title={t("scenario.issues")} items={analysis?.issues || []} color="#FF9800" />
        <InsightBlock title={t("scenario.suggestions")} items={analysis?.suggestions || []} color="#55A3FF" />
        <InsightBlock title={t("scenario.next_steps")} items={analysis?.nextSteps || []} color="#9C27B0" />

        {assistantTurns.some((turn) => turn.hasCorrection || turn.hasPronunciation) && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
            <div className="text-sm font-medium text-[#2D3748] mb-2">{t("scenario.corrections_pronunciation")}</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {assistantTurns
                .filter((turn) => turn.hasCorrection || turn.hasPronunciation)
                .map((turn) => (
                  <div key={turn.id} className="text-xs text-[#718096] bg-amber-50 rounded-lg p-2.5 flex gap-1.5">
                    {turn.hasCorrection && <IconExclamationCircle className="text-amber-600 shrink-0 mt-0.5" />}
                    {turn.hasPronunciation && <IconCheckCircle className="text-green-600 shrink-0 mt-0.5" />}
                    <span className="line-clamp-4">{turn.content}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {userTurns.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
            <div className="text-sm font-medium text-[#2D3748] mb-2">{t("scenario.dialogue_log")}</div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {session.turns?.map((turn, i) => (
                <div
                  key={turn.id || i}
                  className={`text-xs rounded-lg p-2.5 ${
                    turn.role === "user" ? "bg-[#55A3FF]/8" : "bg-[#66BB6A]/8"
                  }`}
                >
                  <Tag size="small" color={turn.role === "user" ? "arcoblue" : "green"} className="!mr-1.5">
                    {turn.role === "user" ? t("scenario.role.user") : t("scenario.role.ai")}
                  </Tag>
                  {turn.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {stats && stats.totalSessions > 0 && (
          <div className="rounded-xl border border-[#4ECDC4]/20 bg-[#4ECDC4]/5 px-3.5 py-3 text-xs text-[#718096]">
            {t("scenario.cumulative_stats", {
              sessions: stats.totalSessions,
              score: stats.avgOverallScore,
            })}
            {stats.totalCorrections > 0 && (
              <> {t("scenario.cumulative_corrections", { count: stats.totalCorrections })}</>
            )}
          </div>
        )}

        <Button long type="primary" onClick={() => navigate("/scenario-dialogues")}>
          <span className="inline-flex items-center gap-1.5">
            <IconTrophy />
            {t("scenario.practice_another")}
          </span>
        </Button>
      </div>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F7F9FC] rounded-lg p-2.5">
      <div className="text-[11px] text-[#718096]">{label}</div>
      <div className="text-sm font-semibold text-[#2D3748] mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
