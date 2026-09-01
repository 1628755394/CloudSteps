import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { Button, Empty, Message, Spin, Tag, Typography } from "@arco-design/web-react";
import { IconLeft, IconPlus, IconVoice, IconDashboard } from "@arco-design/web-react/icon";
import { CloudCard } from "../components/cloudsteps/arco";
import {
  listScenarios,
  listMyScenarios,
  startSession,
  getSpeakingStats,
  getVoiceReady,
  Scenario,
  SpeakingStats,
  VoiceReadyStatus,
} from "../api/scenarioDialogue";
import { ScenarioIcon } from "../components/ScenarioIcon";
import { formatApiMessage } from "../utils/apiMessage";
import { cn } from "../utils/cn";

const difficultyColor: Record<string, string> = {
  easy: "green",
  medium: "arcoblue",
  hard: "orangered",
};

type SourceTab = "system" | "custom";

const reviewColor: Record<string, string> = {
  pending: "orange",
  approved: "green",
  rejected: "red",
};

export default function ScenarioSelection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab =
    (location.state as { tab?: SourceTab } | null)?.tab === "custom" ? "custom" : "system";

  const [sourceTab, setSourceTab] = useState<SourceTab>(initialTab);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [myScenarios, setMyScenarios] = useState<Scenario[]>([]);
  const [stats, setStats] = useState<SpeakingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<number | null>(null);
  const [voiceReady, setVoiceReady] = useState<VoiceReadyStatus | null>(null);

  const difficultyLabel = (key: string) => {
    const map: Record<string, string> = {
      easy: t("scenario.difficulty.easy"),
      medium: t("scenario.difficulty.medium"),
      hard: t("scenario.difficulty.hard"),
    };
    return map[key] || key;
  };

  const reviewLabel = (status?: string) => {
    if (status === "pending") return t("custom_scenario.status_pending");
    if (status === "rejected") return t("custom_scenario.status_rejected");
    if (status === "approved") return t("custom_scenario.status_approved");
    return status || "";
  };

  const load = async () => {
    setLoading(true);
    try {
      const [scRes, myRes, stRes, vrRes] = await Promise.all([
        listScenarios(),
        listMyScenarios(),
        getSpeakingStats(),
        getVoiceReady(),
      ]);
      if (scRes.code === 200) setScenarios(scRes.data || []);
      if (myRes.code === 200) setMyScenarios(myRes.data || []);
      if (stRes.code === 200) setStats(stRes.data);
      if (vrRes.code === 200) setVoiceReady(vrRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSelect = async (scenario: Scenario) => {
    if (sourceTab === "custom" && scenario.reviewStatus !== "approved") {
      Message.info(t("custom_scenario.not_usable"));
      return;
    }

    setStarting(scenario.id);
    try {
      const res = await startSession(scenario.id);
      if (res.code === 200 && res.data) {
        navigate("/scenario-dialogue", {
          state: {
            sessionId: res.data.sessionId,
            deviceId: res.data.deviceId,
            wsPath: res.data.wsPath,
            scenario: res.data.scenario,
            voiceReady: res.data.voiceReady,
          },
        });
      } else {
        Message.error(formatApiMessage(res.msg, "scenario.create_session_failed"));
      }
    } catch {
      Message.error(formatApiMessage(undefined, "scenario.create_session_failed"));
    } finally {
      setStarting(null);
    }
  };

  const displayList = sourceTab === "system" ? scenarios : myScenarios;

  return (
    <div className="h-dvh overflow-hidden bg-background flex flex-col">
      <div className="bg-card shrink-0 border-b border-border">
        <div className="flex items-center h-12 px-3">
          <Button
            type="text"
            shape="circle"
            icon={<IconLeft style={{ fontSize: 18 }} />}
            onClick={() => navigate(-1)}
            className="-ml-1"
          />
          <Typography.Title
            heading={6}
            className="!m-0 flex-1 text-center !text-base !font-semibold text-foreground -ml-8"
          >
            {t("scenario.title")}
          </Typography.Title>
          {sourceTab === "custom" && (
            <Button
              type="primary"
              size="mini"
              icon={<IconPlus />}
              onClick={() => navigate("/scenario-dialogues/custom/new")}
              className="shrink-0"
            />
          )}
        </div>
        <div className="px-4 pb-3 flex gap-2">
          {(["system", "custom"] as SourceTab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors",
                sourceTab === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
              onClick={() => setSourceTab(key)}
            >
              {key === "system" ? t("scenario.tab_system") : t("scenario.tab_custom")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <p className="text-center text-sm text-muted-foreground leading-relaxed">
          {sourceTab === "system" ? t("scenario.tagline") : t("custom_scenario.list_desc")}
        </p>

        {voiceReady && !voiceReady.ready && (
          <div className="rounded-xl border border-warning/30 bg-tint-cream px-3.5 py-3 text-sm text-charcoal">
            <p className="font-medium mb-0.5 text-warning">{t("scenario.voice_not_ready")}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">{voiceReady.hint}</p>
          </div>
        )}

        {stats && stats.totalSessions > 0 && (
          <CloudCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <IconDashboard className="text-primary" />
                {t("scenario.speaking_overview")}
              </div>
              <Button
                type="text"
                size="mini"
                className="!text-primary"
                onClick={() => navigate("/scenario-dialogues/history")}
              >
                {t("scenario.view_history")}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-tint-mint px-2 py-3">
                <div className="text-xl font-semibold text-primary tabular-nums">
                  {stats.avgOverallScore}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{t("scenario.overall_score")}</div>
              </div>
              <div className="rounded-xl bg-tint-sky px-2 py-3">
                <div className="text-xl font-semibold text-secondary-brand tabular-nums">
                  {stats.totalSessions}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{t("scenario.practice_count")}</div>
              </div>
              <div className="rounded-xl bg-surface-soft px-2 py-3">
                <div className="text-xl font-semibold text-success tabular-nums">
                  {Math.round(stats.totalMinutes)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{t("scenario.total_minutes")}</div>
              </div>
            </div>
          </CloudCard>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Spin tip={t("scenario.loading_scenarios")} />
          </div>
        ) : displayList.length === 0 ? (
          <Empty
            description={
              sourceTab === "custom"
                ? t("custom_scenario.empty")
                : t("scenario.no_scenarios")
            }
          />
        ) : (
          <div className="space-y-2.5">
            {displayList.map((s) => {
              const usable = sourceTab === "system" || s.reviewStatus === "approved";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void handleSelect(s)}
                  disabled={starting === s.id || !usable}
                  className={cn(
                    "w-full text-left bg-card border border-border rounded-xl p-4 transition-colors disabled:opacity-60",
                    usable ? "hover:border-primary" : "opacity-80"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
                      <ScenarioIcon name={s.icon} size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">{s.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {sourceTab === "custom" && s.reviewStatus && (
                            <Tag size="small" color={reviewColor[s.reviewStatus] || "gray"}>
                              {reviewLabel(s.reviewStatus)}
                            </Tag>
                          )}
                          <Tag size="small" color={difficultyColor[s.difficulty] || "gray"}>
                            {difficultyLabel(s.difficulty)}
                          </Tag>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {s.description}
                      </p>
                      {sourceTab === "custom" && s.reviewStatus === "rejected" && s.rejectReason && (
                        <p className="text-xs text-red-500 mt-1.5">{s.rejectReason}</p>
                      )}
                      {sourceTab === "custom" && s.reviewStatus === "pending" && (
                        <p className="text-xs text-orange-600 mt-1.5">{t("custom_scenario.pending_hint")}</p>
                      )}
                      {starting === s.id && (
                        <p className="text-xs text-primary mt-1.5">{t("scenario.preparing_dialogue")}</p>
                      )}
                    </div>
                    {usable && <IconVoice className="text-success shrink-0 mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {sourceTab === "custom" && !loading && displayList.length === 0 && (
          <div className="flex justify-center pt-2">
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={() => navigate("/scenario-dialogues/custom/new")}
            >
              {t("custom_scenario.create_btn")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
