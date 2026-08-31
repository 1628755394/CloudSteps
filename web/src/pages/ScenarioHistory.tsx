import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button, Empty, Progress, Spin, Typography } from "@arco-design/web-react";
import { IconLeft, IconCalendar, IconClockCircle } from "@arco-design/web-react/icon";
import { getSpeakingStats, SpeakingStats } from "@/api/scenarioDialogue";
import { ScenarioIcon } from "@/components/ScenarioIcon";

export default function ScenarioHistory() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<SpeakingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSpeakingStats()
      .then((res) => {
        if (res.code === 200) setStats(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language === "zh-CN" ? "zh-CN" : "en-US", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <Spin tip={t("scenario.loading_history")} />
      </div>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-3 bg-gray-50">
        <Empty description={t("scenario.no_history")} />
        <Button type="primary" onClick={() => navigate("/scenario-dialogues")}>
          {t("scenario.start_practice")}
        </Button>
      </div>
    );
  }

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
            {t("scenario.history_title")}
          </Typography.Title>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 pb-6">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
          <div className="text-sm font-medium text-[#2D3748] mb-2.5">{t("scenario.stats_title")}</div>
          <div className="grid grid-cols-2 gap-2">
            <StatCell label={t("scenario.total_sessions")} value={String(stats.totalSessions)} color="#4ECDC4" />
            <StatCell label={t("scenario.total_duration_min")} value={String(Math.round(stats.totalMinutes))} color="#55A3FF" />
            <StatCell label={t("scenario.avg_overall")} value={String(stats.avgOverallScore)} color="#66BB6A" />
            <StatCell label={t("scenario.total_corrections")} value={String(stats.totalCorrections)} color="#FF9800" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 space-y-2.5">
          <div className="text-sm font-medium text-[#2D3748]">{t("scenario.avg_scores")}</div>
          <ScoreBar label={t("scenario.fluency")} score={stats.avgFluencyScore} color="#4ECDC4" />
          <ScoreBar label={t("scenario.accuracy")} score={stats.avgAccuracyScore} color="#55A3FF" />
          <ScoreBar label={t("scenario.pronunciation")} score={stats.avgPronunciationScore} color="#66BB6A" />
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
          <div className="text-sm font-medium text-[#2D3748] mb-2">{t("scenario.recent_practice")}</div>
          <div className="space-y-2">
            {stats.recentSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => navigate(`/scenario-review/${session.id}`)}
                className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-[#4ECDC4]/8 border border-transparent hover:border-[#4ECDC4]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
                      <ScenarioIcon name={session.scenario?.icon} size={18} className="text-[#4ECDC4]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#2D3748] truncate">
                        {session.scenario?.name || t("scenario.unknown_scenario")}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#718096] mt-0.5">
                        <IconCalendar />
                        {formatDate(session.endedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold text-[#2D3748] tabular-nums">{session.overallScore}</div>
                    <div className="text-[11px] text-[#718096]">{t("scenario.overall_score")}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#A0AEC0]">
                  <span className="inline-flex items-center gap-1">
                    <IconClockCircle />
                    {t("scenario.minutes", {
                      count: Math.max(1, Math.round(session.durationSec / 60)),
                    })}
                  </span>
                  <span>{t("scenario.turns", { count: session.turnCount })}</span>
                </div>
                {session.reviewSummary && (
                  <div className="mt-1.5 text-[11px] text-[#718096] line-clamp-2">{session.reviewSummary}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        <Button long type="primary" onClick={() => navigate("/scenario-dialogues")}>
          {t("scenario.continue_practice")}
        </Button>
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: `${color}14` }}>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[11px] text-[#718096] mt-0.5">{label}</div>
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#718096]">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-[#2D3748]">{score}</span>
      </div>
      <Progress percent={score} showText={false} color={color} size="small" />
    </div>
  );
}
