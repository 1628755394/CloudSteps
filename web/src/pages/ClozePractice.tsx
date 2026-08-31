import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  Button,
  Card,
  Empty,
  Progress,
  Radio,
  Result,
  Space,
  Spin,
  Tag,
  Typography,
} from "@arco-design/web-react";
import { IconLeft } from "@arco-design/web-react/icon";
import {
  getClozePassage,
  listClozePassages,
  submitClozePassage,
  type ClozePassageDetail,
  type ClozePassageListItem,
  type ClozeSubmitResult,
} from "../api/cloze";
import { formatApiMessage } from "../utils/apiMessage";

type Phase = "list" | "practice" | "result";

function renderPassageWithBlanks(
  content: string,
  answers: Record<number, string>,
  blankNoToId: Record<number, number>
) {
  const parts = content.split(/(\{\{\d+\}\})/g);
  return parts.map((part, idx) => {
    const m = part.match(/^\{\{(\d+)\}\}$/);
    if (!m) {
      return (
        <span key={idx} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    }
    const blankNo = Number(m[1]);
    const blankId = blankNoToId[blankNo];
    const selected = blankId ? answers[blankId] : "";
    return (
      <span
        key={idx}
        className={`inline-flex items-center justify-center min-w-[2.5rem] mx-0.5 px-1.5 py-0.5 rounded border text-sm font-semibold align-baseline ${
          selected
            ? "border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#2D3748]"
            : "border-dashed border-[#CBD5E0] bg-white text-[#A0AEC0]"
        }`}
      >
        {selected || blankNo}
      </span>
    );
  });
}

export default function ClozePractice() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("list");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPassage, setLoadingPassage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [passages, setPassages] = useState<ClozePassageListItem[]>([]);
  const [passage, setPassage] = useState<ClozePassageDetail | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [activeBlankId, setActiveBlankId] = useState<number | null>(null);
  const [result, setResult] = useState<ClozeSubmitResult | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const blankNoToId = useMemo(() => {
    const map: Record<number, number> = {};
    passage?.blanks?.forEach((b) => {
      map[b.blankNo] = b.id;
    });
    return map;
  }, [passage]);

  const loadList = async () => {
    setLoadingList(true);
    setErr(null);
    try {
      const res = await listClozePassages({ page: 1, pageSize: 50 });
      if (res.code !== 200) {
        setErr(formatApiMessage(res.msg, "cloze.load_list_failed"));
        setPassages([]);
        return;
      }
      setPassages(Array.isArray(res.data?.list) ? res.data.list : []);
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      setErr(formatApiMessage(apiMsg, "cloze.load_list_failed"));
      setPassages([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadList();
  }, []);

  const answeredCount = useMemo(
    () => Object.keys(answers).filter((k) => answers[Number(k)]).length,
    [answers]
  );
  const totalBlanks = passage?.blanks?.length ?? 0;
  const allAnswered = totalBlanks > 0 && answeredCount === totalBlanks;
  const percent = totalBlanks > 0 ? Math.round((answeredCount / totalBlanks) * 100) : 0;

  const activeBlank = useMemo(
    () => passage?.blanks?.find((b) => b.id === activeBlankId) ?? passage?.blanks?.[0] ?? null,
    [passage, activeBlankId]
  );

  const openPassage = async (id: number) => {
    setLoadingPassage(true);
    setErr(null);
    try {
      const res = await getClozePassage(id);
      if (res.code !== 200 || !res.data) {
        setErr(formatApiMessage(res.msg, "cloze.load_passage_failed"));
        return;
      }
      setPassage(res.data);
      setAnswers({});
      setResult(null);
      setActiveBlankId(res.data.blanks?.[0]?.id ?? null);
      startedAtRef.current = Date.now();
      setPhase("practice");
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      setErr(formatApiMessage(apiMsg, "cloze.load_passage_failed"));
    } finally {
      setLoadingPassage(false);
    }
  };

  const onPickAnswer = (blankId: number, key: string) => {
    setAnswers((prev) => ({ ...prev, [blankId]: key }));
    if (!passage) return;
    const idx = passage.blanks.findIndex((b) => b.id === blankId);
    const next = passage.blanks[idx + 1];
    if (next) setActiveBlankId(next.id);
  };

  const onSubmit = async () => {
    if (!passage || !allAnswered) return;
    setSubmitting(true);
    setErr(null);
    try {
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      const res = await submitClozePassage(passage.id, {
        answers: passage.blanks.map((b) => ({
          blankId: b.id,
          answer: answers[b.id] || "",
        })),
        durationSec,
      });
      if (res.code !== 200 || !res.data) {
        setErr(formatApiMessage(res.msg, "practice.submit_failed"));
        return;
      }
      setResult(res.data);
      setPhase("result");
      void loadList();
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      setErr(formatApiMessage(apiMsg, "practice.submit_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const backToList = () => {
    setPhase("list");
    setPassage(null);
    setAnswers({});
    setResult(null);
    setActiveBlankId(null);
    setErr(null);
  };

  const headerBack = () => {
    if (phase === "list") navigate(-1);
    else backToList();
  };

  return (
    <div className="h-dvh overflow-hidden bg-[#F7F9FC] flex flex-col">
      <header className="shrink-0 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center h-12 px-3 gap-2">
          <Button type="text" shape="circle" icon={<IconLeft />} onClick={headerBack} />
          <div className="min-w-0 flex-1">
            <Typography.Text className="!font-medium !text-[#2D3748]">{t("cloze.title")}</Typography.Text>
            {phase === "practice" && passage && (
              <Typography.Text type="secondary" className="block !text-xs truncate">
                {passage.title} · {passage.level}
              </Typography.Text>
            )}
            {phase === "list" && (
              <Typography.Text type="secondary" className="block !text-xs">
                {t("cloze.subtitle_list")}
              </Typography.Text>
            )}
          </div>
          {phase === "practice" && (
            <Typography.Text type="secondary" className="!text-xs shrink-0">
              {answeredCount}/{totalBlanks}
            </Typography.Text>
          )}
        </div>
        {phase === "practice" && <Progress percent={percent} showText={false} size="small" />}
      </header>

      {err && (
        <div className="mx-3 mt-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {err}
        </div>
      )}

      {phase === "list" && (
        <div className="flex-1 min-h-0 overflow-auto px-3 py-3">
          {loadingList || loadingPassage ? (
            <div className="flex justify-center py-16">
              <Spin tip={t("common.loading")} />
            </div>
          ) : passages.length === 0 ? (
            <Card className="!rounded-xl">
              <Empty description={t("cloze.empty_list")} />
            </Card>
          ) : (
            <Space direction="vertical" size={10} className="w-full">
              {passages.map((p) => (
                <Card
                  key={p.id}
                  hoverable
                  className="!rounded-xl cursor-pointer"
                  onClick={() => void openPassage(p.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Typography.Text className="!font-semibold !text-[#2D3748]">
                          {p.title}
                        </Typography.Text>
                        <Tag size="small" color="arcoblue">
                          {p.level}
                        </Tag>
                      </div>
                      {p.summary && (
                        <Typography.Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          className="!mb-2 !text-xs"
                        >
                          {p.summary}
                        </Typography.Paragraph>
                      )}
                      <Typography.Text type="secondary" className="!text-xs">
                        {t("practice.blanks_meta", {
                          count: p.blankCount ?? 0,
                          minutes: p.estimatedMinutes ?? 5,
                        })}
                      </Typography.Text>
                    </div>
                    {typeof p.lastScore === "number" && (
                      <Tag color={p.lastScore >= 80 ? "green" : "orangered"}>
                        {t("practice.last_score", { score: p.lastScore })}
                      </Tag>
                    )}
                  </div>
                </Card>
              ))}
            </Space>
          )}
        </div>
      )}

      {phase === "result" && result && (
        <div className="flex-1 min-h-0 overflow-auto px-4 py-6 flex items-start justify-center">
          <Card className="w-full max-w-md !rounded-2xl shadow-sm">
            <Result
              status={result.score === 100 ? "success" : "info"}
              title={`${result.correctCount} / ${result.blankCount}`}
              subTitle={t("practice.score_subtitle", {
                score: result.score,
                seconds: result.durationSec,
              })}
            />
            <div className="space-y-3 mt-2">
              {(result.details || []).map((d) => (
                <div
                  key={d.blankId}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${
                    d.correct ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="font-medium text-[#2D3748] mb-1">
                    {t("cloze.blank_no", { no: d.blankNo })}
                  </div>
                  <div className="text-[#718096]">
                    {t("practice.your_answer", {
                      answer: d.answer || t("practice.no_answer"),
                    })}
                    {!d.correct && (
                      <span className="ml-2 text-[#4ECDC4]">
                        {t("practice.correct_answer", { answer: d.rightAnswer })}
                      </span>
                    )}
                  </div>
                  {d.explanation && (
                    <div className="text-xs text-[#A0AEC0] mt-1">
                      {t("practice.explanation", { text: d.explanation })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Space className="mt-5 w-full justify-center">
              <Button onClick={backToList}>{t("practice.back_to_list")}</Button>
              <Button
                type="primary"
                onClick={() => {
                  if (result.passageId) void openPassage(result.passageId);
                }}
              >
                {t("practice.try_again")}
              </Button>
            </Space>
          </Card>
        </div>
      )}

      {phase === "practice" && passage && (
        <>
          <div className="flex-1 min-h-0 overflow-auto px-3 py-3 pb-28">
            <Card className="!rounded-xl shadow-sm !mb-3" title={t("practice.passage")}>
              <div className="text-[#2D3748] leading-8 text-[15px]">
                {renderPassageWithBlanks(passage.content, answers, blankNoToId)}
              </div>
            </Card>

            <div className="flex flex-wrap gap-2 mb-3">
              {passage.blanks.map((b) => (
                <Button
                  key={b.id}
                  size="small"
                  type={activeBlank?.id === b.id ? "primary" : "outline"}
                  status={answers[b.id] ? undefined : undefined}
                  onClick={() => setActiveBlankId(b.id)}
                >
                  {b.blankNo}
                  {answers[b.id] ? ` · ${answers[b.id]}` : ""}
                </Button>
              ))}
            </div>

            {activeBlank && (
              <Card
                className="!rounded-xl shadow-sm"
                title={t("cloze.blank_no", { no: activeBlank.blankNo })}
              >
                <Radio.Group
                  direction="vertical"
                  value={answers[activeBlank.id]}
                  onChange={(v) => onPickAnswer(activeBlank.id, String(v))}
                >
                  {(activeBlank.options || []).map((opt) => (
                    <Radio key={opt.key} value={opt.key} className="!mb-2 !mr-0">
                      <span className="text-sm">
                        {opt.key}. {opt.text}
                      </span>
                    </Radio>
                  ))}
                </Radio.Group>
              </Card>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-3">
            <Button
              type="primary"
              long
              size="large"
              loading={submitting}
              disabled={!allAnswered}
              onClick={() => void onSubmit()}
            >
              {allAnswered
                ? t("practice.submit")
                : t("practice.complete_all_blanks", {
                    answered: answeredCount,
                    total: totalBlanks,
                  })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
