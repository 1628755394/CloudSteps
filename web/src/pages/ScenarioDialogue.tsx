import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { Alert, Button, Message, Typography } from "@arco-design/web-react";
import {
  IconLeft,
  IconMute,
  IconSound,
  IconPoweroff,
  IconMessage,
  IconVoice,
} from "@arco-design/web-react/icon";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import { activateSession, completeSession, Scenario, VoiceReadyStatus } from "@/api/scenarioDialogue";
import { ScenarioIcon } from "@/components/ScenarioIcon";
import { buildWebSocketURL } from "@/config/apiConfig";
import { formatApiMessage } from "@/utils/apiMessage";

interface LocationState {
  sessionId: number;
  deviceId: string;
  wsPath: string;
  scenario: Scenario;
  voiceReady?: VoiceReadyStatus;
}

export default function ScenarioDialogue() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [corrections, setCorrections] = useState<string[]>([]);
  const [ending, setEnding] = useState(false);
  const [connectError, setConnectError] = useState("");

  const wsUrl = useMemo(() => {
    if (!state?.wsPath) return "";
    return buildWebSocketURL(state.wsPath);
  }, [state?.wsPath]);

  const voice = useRealtimeVoice({
    wsUrl,
    onAssistantText: (text) => {
      if (text.includes("Better:")) {
        setCorrections((prev) => [...prev.slice(-4), text]);
      }
    },
    onError: (msg) => setConnectError(msg),
    onConnected: () => {
      if (state?.sessionId) void activateSession(state.sessionId);
    },
  });

  useEffect(() => {
    if (!state?.sessionId) {
      navigate("/scenario-dialogues", { replace: true });
      return;
    }
    if (state.voiceReady && !state.voiceReady.ready) {
      setConnectError(state.voiceReady.hint || t("scenario.voice_not_configured"));
      return;
    }
    setConnectError("");
    voice.connect();
    return () => voice.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.sessionId]);

  const handleEnd = async () => {
    if (!state || ending) return;
    setEnding(true);
    voice.disconnect();
    try {
      const res = await completeSession(state.sessionId);
      if (res.code === 200) {
        navigate(`/scenario-review/${state.sessionId}`, { replace: true });
      } else {
        Message.error(formatApiMessage(res.msg, "scenario.end_session_failed"));
      }
    } catch {
      Message.error(formatApiMessage(undefined, "scenario.end_session_failed"));
    } finally {
      setEnding(false);
    }
  };

  const handleInterrupt = () => {
    if (!voice.isConnected) return;
    voice.interrupt();
    Message.info(t("scenario.interrupted"));
  };

  const handleMute = () => {
    if (!voice.isConnected) return;
    voice.toggleMute();
  };

  if (!state) return null;

  const statusLabel: Record<string, string> = {
    idle: t("scenario.status.idle"),
    connecting: t("scenario.status.connecting"),
    connected: voice.muted ? t("scenario.status.connected_muted") : t("scenario.status.connected"),
    disconnected: t("scenario.status.disconnected"),
    error: t("scenario.status.error"),
  };

  return (
    <div className="h-dvh overflow-hidden bg-background flex flex-col">
      <div className="bg-card shrink-0 border-b border-border">
        <div className="flex items-center h-12 px-3 gap-2">
          <Button
            type="text"
            shape="circle"
            icon={<IconLeft style={{ fontSize: 18 }} />}
            onClick={() => navigate(-1)}
            className="-ml-1"
          />
          <div className="flex-1 min-w-0 text-center -ml-8">
            <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground">
              <ScenarioIcon name={state.scenario.icon} size={16} className="text-primary" />
              <span className="truncate">{state.scenario.name}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">{statusLabel[voice.status]}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {(connectError || voice.status === "error") && (
          <Alert
            type="error"
            title={t("scenario.voice_connect_failed")}
            content={
              <div className="space-y-2 text-xs">
                <p className="whitespace-pre-wrap">{connectError || t("scenario.status.error")}</p>
                <Button size="mini" type="outline" status="danger" onClick={() => { setConnectError(""); voice.connect(); }}>
                  {t("scenario.retry_connect")}
                </Button>
              </div>
            }
          />
        )}

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
            <IconMessage />
            {t("scenario.you_say")}
          </div>
          <Typography.Paragraph className="!mb-0 text-sm text-charcoal min-h-[2rem] leading-relaxed">
            {voice.userText || "..."}
          </Typography.Paragraph>
        </div>

        <div className="bg-card rounded-xl border border-primary/35 p-4">
          <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
            <IconVoice />
            {t("scenario.ai_coach")}
          </div>
          <Typography.Paragraph className="!mb-0 text-sm text-charcoal min-h-[2rem] whitespace-pre-wrap leading-relaxed">
            {voice.assistantText || (voice.status === "connected" ? t("scenario.ai_preparing") : "...")}
          </Typography.Paragraph>
        </div>

        {corrections.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-tint-cream p-3.5">
            <p className="text-xs font-medium text-warning mb-1.5">{t("scenario.realtime_correction")}</p>
            {corrections.map((c, i) => (
              <p key={i} className="text-xs text-charcoal mb-1 line-clamp-3 leading-relaxed">{c}</p>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 bg-card border-t border-border px-4 py-3">
        <div className="flex items-center justify-center gap-5">
          <div className="flex flex-col items-center gap-1">
            <Button
              shape="circle"
              size="large"
              type="outline"
              disabled={!voice.isConnected}
              onClick={handleInterrupt}
              icon={<IconSound />}
              className="!w-12 !h-12"
            />
            <span className="text-[11px] text-muted-foreground">{t("scenario.interrupt")}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <Button
              shape="circle"
              size="large"
              status="danger"
              type="primary"
              loading={ending}
              onClick={() => void handleEnd()}
              icon={<IconPoweroff />}
              className="!w-14 !h-14"
            />
            <span className="text-[11px] text-muted-foreground">
              {ending ? t("scenario.generating") : t("scenario.end")}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <Button
              shape="circle"
              size="large"
              type={voice.muted ? "primary" : "outline"}
              status={voice.muted ? "warning" : undefined}
              disabled={!voice.isConnected}
              onClick={handleMute}
              icon={voice.muted ? <IconMute /> : <IconVoice />}
              className="!w-12 !h-12"
            />
            <span className="text-[11px] text-muted-foreground">
              {voice.muted ? t("scenario.muted") : t("scenario.mute")}
            </span>
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-soft mt-2">
          {ending ? t("scenario.generating_review") : t("scenario.end_for_review")}
        </p>
      </div>
    </div>
  );
}
