import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Empty, Message, Spin, Tag, Typography } from "@arco-design/web-react";
import { IconLeft, IconVoice, IconDashboard } from "@arco-design/web-react/icon";
import { CloudCard } from "../components/cloudsteps/arco";
import {
  listScenarios,
  startSession,
  getSpeakingStats,
  getVoiceReady,
  Scenario,
  SpeakingStats,
  VoiceReadyStatus,
} from "../api/scenarioDialogue";
import { ScenarioIcon } from "../components/ScenarioIcon";

const difficultyColor: Record<string, string> = {
  easy: "green",
  medium: "arcoblue",
  hard: "orangered",
};

const difficultyLabel: Record<string, string> = {
  easy: "入门",
  medium: "进阶",
  hard: "挑战",
};

export default function ScenarioSelection() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [stats, setStats] = useState<SpeakingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<number | null>(null);
  const [voiceReady, setVoiceReady] = useState<VoiceReadyStatus | null>(null);

  useEffect(() => {
    Promise.all([listScenarios(), getSpeakingStats(), getVoiceReady()])
      .then(([scRes, stRes, vrRes]) => {
        if (scRes.code === 200) setScenarios(scRes.data || []);
        if (stRes.code === 200) setStats(stRes.data);
        if (vrRes.code === 200) setVoiceReady(vrRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (scenario: Scenario) => {
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
        Message.error(res.msg || "创建会话失败");
      }
    } catch {
      Message.error("创建会话失败");
    } finally {
      setStarting(null);
    }
  };

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
            场景对话
          </Typography.Title>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <p className="text-center text-sm text-muted-foreground leading-relaxed">
          选择场景 → 语音对话 → 实时纠错 → 课后复盘
        </p>

        {voiceReady && !voiceReady.ready && (
          <div className="rounded-xl border border-warning/30 bg-tint-cream px-3.5 py-3 text-sm text-charcoal">
            <p className="font-medium mb-0.5 text-warning">语音服务未就绪</p>
            <p className="text-muted-foreground text-xs leading-relaxed">{voiceReady.hint}</p>
          </div>
        )}

        {stats && stats.totalSessions > 0 && (
          <CloudCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <IconDashboard className="text-primary" />
                口语能力概览
              </div>
              <Button
                type="text"
                size="mini"
                className="!text-primary"
                onClick={() => navigate("/scenario-dialogues/history")}
              >
                查看历史
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-tint-mint px-2 py-3">
                <div className="text-xl font-semibold text-primary tabular-nums">
                  {stats.avgOverallScore}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">综合分</div>
              </div>
              <div className="rounded-xl bg-tint-sky px-2 py-3">
                <div className="text-xl font-semibold text-secondary-brand tabular-nums">
                  {stats.totalSessions}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">练习次数</div>
              </div>
              <div className="rounded-xl bg-surface-soft px-2 py-3">
                <div className="text-xl font-semibold text-success tabular-nums">
                  {Math.round(stats.totalMinutes)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">累计分钟</div>
              </div>
            </div>
          </CloudCard>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Spin tip="加载场景中..." />
          </div>
        ) : scenarios.length === 0 ? (
          <Empty description="暂无可用场景" />
        ) : (
          <div className="space-y-2.5">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void handleSelect(s)}
                disabled={starting === s.id}
                className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary transition-colors disabled:opacity-60"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
                    <ScenarioIcon name={s.icon} size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{s.name}</span>
                      <Tag size="small" color={difficultyColor[s.difficulty] || "gray"}>
                        {difficultyLabel[s.difficulty] || s.difficulty}
                      </Tag>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                      {s.description}
                    </p>
                    {starting === s.id && (
                      <p className="text-xs text-primary mt-1.5">正在准备对话...</p>
                    )}
                  </div>
                  <IconVoice className="text-success shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
