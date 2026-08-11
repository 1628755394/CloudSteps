import { useEffect, useState } from "react";
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
        <Spin tip="加载复盘报告..." />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-3 bg-gray-50">
        <Empty description="会话不存在" />
        <Button type="primary" onClick={() => navigate("/scenario-dialogues")}>
          返回选场景
        </Button>
      </div>
    );
  }

  const analysis = session.analysis;
  const assistantTurns = session.turns?.filter((t) => t.role === "assistant") || [];
  const userTurns = session.turns?.filter((t) => t.role === "user") || [];

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
            课后复盘
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
            {session.turnCount} 轮有效对话 · {Math.max(1, Math.round(session.durationSec / 60))} 分钟
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-[#2D3748] tabular-nums">{session.overallScore}</span>
            <span className="text-xs text-[#718096] ml-1">综合分</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 space-y-2.5">
          <div className="text-sm font-medium text-[#2D3748]">口语能力评分</div>
          <ScoreRow label="流利度" score={session.fluencyScore} color="#4ECDC4" />
          <ScoreRow label="准确度" score={session.accuracyScore} color="#55A3FF" />
          <ScoreRow label="发音" score={session.pronunciationScore} color="#66BB6A" />
          {analysis && (
            <>
              <ScoreRow label="词汇" score={analysis.vocabularyScore} color="#FF9800" />
              <ScoreRow label="参与度" score={analysis.participationScore} color="#9C27B0" />
            </>
          )}
        </div>

        {analysis && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
            <div className="text-sm font-medium text-[#2D3748] mb-2.5">量化指标</div>
            <div className="grid grid-cols-2 gap-2">
              <MetricCell label="语速" value={`${Math.round(analysis.wordsPerMinute)} 词/分`} />
              <MetricCell label="英语占比" value={`${Math.round(analysis.englishRatio * 100)}%`} />
              <MetricCell label="英文词数" value={String(analysis.userWordCount)} />
              <MetricCell label="独特词汇" value={String(analysis.uniqueWordCount)} />
              <MetricCell label="平均每轮" value={`${analysis.avgWordsPerTurn.toFixed(1)} 词`} />
              <MetricCell label="中文轮次" value={String(analysis.chineseTurnCount)} />
              <MetricCell label="语法纠正" value={String(analysis.explicitCorrections + analysis.implicitCorrections)} />
              <MetricCell label="短句/语气词" value={String(analysis.shortTurnCount)} />
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
              AI 教练分析
            </div>
            <p className="text-xs text-[#2D3748] leading-relaxed whitespace-pre-wrap">{analysis.aiAnalysis}</p>
          </div>
        )}

        <InsightBlock title="表现亮点" items={analysis?.highlights || []} color="#66BB6A" />
        <InsightBlock title="待改进" items={analysis?.issues || []} color="#FF9800" />
        <InsightBlock title="练习建议" items={analysis?.suggestions || []} color="#55A3FF" />
        <InsightBlock title="后续计划" items={analysis?.nextSteps || []} color="#9C27B0" />

        {assistantTurns.some((t) => t.hasCorrection || t.hasPronunciation) && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
            <div className="text-sm font-medium text-[#2D3748] mb-2">纠错 & 发音建议</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {assistantTurns
                .filter((t) => t.hasCorrection || t.hasPronunciation)
                .map((t) => (
                  <div key={t.id} className="text-xs text-[#718096] bg-amber-50 rounded-lg p-2.5 flex gap-1.5">
                    {t.hasCorrection && <IconExclamationCircle className="text-amber-600 shrink-0 mt-0.5" />}
                    {t.hasPronunciation && <IconCheckCircle className="text-green-600 shrink-0 mt-0.5" />}
                    <span className="line-clamp-4">{t.content}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {userTurns.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5">
            <div className="text-sm font-medium text-[#2D3748] mb-2">对话记录</div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {session.turns?.map((t, i) => (
                <div
                  key={t.id || i}
                  className={`text-xs rounded-lg p-2.5 ${
                    t.role === "user" ? "bg-[#55A3FF]/8" : "bg-[#66BB6A]/8"
                  }`}
                >
                  <Tag size="small" color={t.role === "user" ? "arcoblue" : "green"} className="!mr-1.5">
                    {t.role === "user" ? "你" : "AI"}
                  </Tag>
                  {t.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {stats && stats.totalSessions > 0 && (
          <div className="rounded-xl border border-[#4ECDC4]/20 bg-[#4ECDC4]/5 px-3.5 py-3 text-xs text-[#718096]">
            累计练习 <strong>{stats.totalSessions}</strong> 次，平均综合分{" "}
            <strong className="text-[#4ECDC4]">{stats.avgOverallScore}</strong>
            {stats.totalCorrections > 0 && (
              <> · 累计纠错 <strong>{stats.totalCorrections}</strong> 处</>
            )}
          </div>
        )}

        <Button long type="primary" onClick={() => navigate("/scenario-dialogues")}>
          <span className="inline-flex items-center gap-1.5">
            <IconTrophy />
            再练一个场景
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
