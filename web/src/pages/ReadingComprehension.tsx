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
  getReadingPassage,
  listReadingPassages,
  submitReadingPassage,
  type ReadingPassageDetail,
  type ReadingPassageListItem,
  type ReadingSubmitResult,
} from "../api/reading";
import { formatApiMessage } from "../utils/apiMessage";

type Phase = "list" | "practice" | "result";

export default function ReadingComprehension() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("list");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPassage, setLoadingPassage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [passages, setPassages] = useState<ReadingPassageListItem[]>([]);
  const [passage, setPassage] = useState<ReadingPassageDetail | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<ReadingSubmitResult | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const loadList = async () => {
    setLoadingList(true);
    setErr(null);
    try {
      const res = await listReadingPassages({ page: 1, pageSize: 50 });
      if (res.code !== 200) {
        setErr(formatApiMessage(res.msg, "reading.load_list_failed"));
        setPassages([]);
        return;
      }
      setPassages(Array.isArray(res.data?.list) ? res.data.list : []);
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      setErr(formatApiMessage(apiMsg, "reading.load_list_failed"));
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
  const totalQuestions = passage?.questions?.length ?? 0;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;
  const percent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const openPassage = async (id: number) => {
    setLoadingPassage(true);
    setErr(null);
    try {
      const res = await getReadingPassage(id);
      if (res.code !== 200 || !res.data) {
        setErr(formatApiMessage(res.msg, "reading.load_passage_failed"));
        return;
      }
      setPassage(res.data);
      setAnswers({});
      setResult(null);
      startedAtRef.current = Date.now();
      setPhase("practice");
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      setErr(formatApiMessage(apiMsg, "reading.load_passage_failed"));
    } finally {
      setLoadingPassage(false);
    }
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
      const payload = {
        answers: passage.questions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id] || "",
        })),
        durationSec,
      };
      const res = await submitReadingPassage(passage.id, payload);
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
    setErr(null);
  };

  const headerBack = () => {
    if (phase === "list") {
      navigate(-1);
      return;
    }
    if (phase === "result") {
      backToList();
      return;
    }
    backToList();
  };

  return (
    <div className="h-dvh overflow-hidden bg-[#F7F9FC] flex flex-col">
      <header className="shrink-0 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center h-12 px-3 gap-2">
          <Button type="text" shape="circle" icon={<IconLeft />} onClick={headerBack} />
          <div className="min-w-0 flex-1">
            <Typography.Text className="!font-medium !text-[#2D3748]">
              {t("reading.title")}
            </Typography.Text>
            {phase === "practice" && passage && (
              <Typography.Text type="secondary" className="block !text-xs truncate">
                {passage.title} · {passage.level}
              </Typography.Text>
            )}
            {phase === "list" && (
              <Typography.Text type="secondary" className="block !text-xs">
                {t("reading.subtitle_list")}
              </Typography.Text>
            )}
          </div>
          {phase === "practice" && (
            <Typography.Text type="secondary" className="!text-xs shrink-0">
              {answeredCount}/{totalQuestions}
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
              <Empty description={t("reading.empty_list")} />
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
                        {typeof p.wordCount === "number"
                          ? t("practice.questions_meta_words", {
                              count: p.questionCount ?? 0,
                              minutes: p.estimatedMinutes ?? 5,
                              words: p.wordCount,
                            })
                          : t("practice.questions_meta", {
                              count: p.questionCount ?? 0,
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
              title={`${result.correctCount} / ${result.questionCount}`}
              subTitle={t("practice.score_subtitle", {
                score: result.score,
                seconds: result.durationSec,
              })}
            />
            <div className="space-y-3 mt-2">
              {(result.details || []).map((d, idx) => (
                <div
                  key={d.questionId}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${
                    d.correct
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="font-medium text-[#2D3748] mb-1">
                    {idx + 1}. {d.stem}
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
          <div className="flex-1 min-h-0 overflow-auto px-3 py-3 pb-24">
            <Card
              className="!rounded-xl shadow-sm !mb-3"
              title={<span className="text-sm font-semibold">{t("practice.passage")}</span>}
              extra={
                <Typography.Text type="secondary" className="!text-xs">
                  {passage.level}
                </Typography.Text>
              }
            >
              <Typography.Paragraph className="!mb-0 !text-[#2D3748] leading-7 whitespace-pre-line">
                {passage.content}
              </Typography.Paragraph>
            </Card>

            <Space direction="vertical" size={12} className="w-full">
              {passage.questions.map((q, idx) => (
                <Card
                  key={q.id}
                  className="!rounded-xl shadow-sm"
                  title={
                    <span className="text-sm font-medium text-[#2D3748]">
                      {idx + 1}. {q.stem}
                    </span>
                  }
                >
                  <Radio.Group
                    direction="vertical"
                    value={answers[q.id]}
                    onChange={(v) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: String(v) }))
                    }
                  >
                    {(q.options || []).map((opt) => (
                      <Radio key={opt.key} value={opt.key} className="!mb-2 !mr-0">
                        <span className="text-sm">
                          {opt.key}. {opt.text}
                        </span>
                      </Radio>
                    ))}
                  </Radio.Group>
                </Card>
              ))}
            </Space>
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
                : t("practice.complete_all_questions", {
                    answered: answeredCount,
                    total: totalQuestions,
                  })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
