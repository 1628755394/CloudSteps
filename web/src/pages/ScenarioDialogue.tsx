import { useEffect, useMemo, useState } from "react";
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

interface LocationState {
  sessionId: number;
  deviceId: string;
  wsPath: string;
  scenario: Scenario;
  voiceReady?: VoiceReadyStatus;
}

export default function ScenarioDialogue() {
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
      setConnectError(state.voiceReady.hint || "语音服务未配置");
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
        Message.error(res.msg || "结束会话失败");
      }
    } catch {
      Message.error("结束会话失败");
    } finally {
      setEnding(false);
    }
  };

  const handleInterrupt = () => {
    if (!voice.isConnected) return;
    voice.interrupt();
    Message.info("已打断 AI");
  };

  const handleMute = () => {
    if (!voice.isConnected) return;
    voice.toggleMute();
  };

  if (!state) return null;

  const statusLabel: Record<string, string> = {
    idle: "准备中",
    connecting: "连接中...",
    connected: voice.muted ? "已静音 — AI 正在陪练" : "对话中 — AI 会先开口",
    disconnected: "已断开",
    error: "连接失败",
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
            title="语音连接失败"
            content={
              <div className="space-y-2 text-xs">
                <p className="whitespace-pre-wrap">{connectError || "realtime init failed"}</p>
                <Button size="mini" type="outline" status="danger" onClick={() => { setConnectError(""); voice.connect(); }}>
                  重试连接
                </Button>
              </div>
            }
          />
        )}

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
            <IconMessage />
            你说
          </div>
          <Typography.Paragraph className="!mb-0 text-sm text-charcoal min-h-[2rem] leading-relaxed">
            {voice.userText || "..."}
          </Typography.Paragraph>
        </div>

        <div className="bg-card rounded-xl border border-primary/35 p-4">
          <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
            <IconVoice />
            AI 陪练
          </div>
          <Typography.Paragraph className="!mb-0 text-sm text-charcoal min-h-[2rem] whitespace-pre-wrap leading-relaxed">
            {voice.assistantText || (voice.status === "connected" ? "AI 正在准备开场..." : "...")}
          </Typography.Paragraph>
        </div>

        {corrections.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-tint-cream p-3.5">
            <p className="text-xs font-medium text-warning mb-1.5">实时纠错</p>
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
            <span className="text-[11px] text-muted-foreground">打断</span>
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
            <span className="text-[11px] text-muted-foreground">{ending ? "生成中" : "结束"}</span>
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
            <span className="text-[11px] text-muted-foreground">{voice.muted ? "已静音" : "静音"}</span>
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-soft mt-2">
          {ending ? "正在生成复盘..." : "结束对话后可查看复盘报告"}
        </p>
      </div>
    </div>
  );
}
