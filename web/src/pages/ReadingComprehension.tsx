import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { IconLeft, IconPlus } from "@arco-design/web-react/icon";
import { ArrowRight } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import {
  getCustomReadingPassage,
  listCustomReadingPassages,
  submitCustomReadingPassage,
} from "../api/customReading";
import {
  getReadingPassage,
  listReadingPassages,
  submitReadingPassage,
  type ReadingPassageDetail,
  type ReadingPassageListItem,
  type ReadingSubmitResult,
} from "../api/reading";
import { formatApiMessage } from "../utils/apiMessage";
import { cn } from "../utils/cn";

type Phase = "list" | "practice" | "result";
type SourceTab = "system" | "custom";
type LevelFilter = "" | "初阶" | "中阶" | "高阶";

const LEVELS: LevelFilter[] = ["", "初阶", "中阶", "高阶"];

type PassageItem = ReadingPassageListItem & { isCustom?: boolean };

export default function ReadingComprehension() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("list");
  const [sourceTab, setSourceTab] = useState<SourceTab>("system");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPassage, setLoadingPassage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [passages, setPassages] = useState<PassageItem[]>([]);
  const [passage, setPassage] = useState<ReadingPassageDetail | null>(null);
  const [isCustomPassage, setIsCustomPassage] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<ReadingSubmitResult | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setErr(null);
    try {
      const params = {
        page: 1,
        pageSize: 30,
        ...(levelFilter ? { level: levelFilter } : {}),
      };
      const res =
        sourceTab === "custom"
          ? await listCustomReadingPassages(params)
          : await listReadingPassages(params);
      if (res.code !== 200) {
        setErr(formatApiMessage(res.msg, "reading.load_list_failed"));
        setPassages([]);
        return;
      }
      const list = Array.isArray(res.data?.list) ? res.data.list : [];
      setPassages(
        list.map((p) => ({
          ...p,
          isCustom: sourceTab === "custom",
        }))
      );
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      setErr(formatApiMessage(apiMsg, "reading.load_list_failed"));
      setPassages([]);
    } finally {
      setLoadingList(false);
    }
  }, [levelFilter, sourceTab]);

  useEffect(() => {
    if (phase === "list") void loadList();
  }, [phase, loadList]);

  const answeredCount = useMemo(
    () => Object.keys(answers).filter((k) => answers[Number(k)]).length,
    [answers]
  );
  const totalQuestions = passage?.questions?.length ?? 0;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;
  const percent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const openPassage = async (id: number, isCustom: boolean) => {
    setLoadingPassage(true);
    setErr(null);
    try {
      const res = isCustom ? await getCustomReadingPassage(id) : await getReadingPassage(id);
      if (res.code !== 200 || !res.data) {
        setErr(formatApiMessage(res.msg, "reading.load_passage_failed"));
        return;
      }
      setPassage(res.data);
      setIsCustomPassage(isCustom);
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
      const res = isCustomPassage
        ? await submitCustomReadingPassage(passage.id, payload)
        : await submitReadingPassage(passage.id, payload);
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
    setIsCustomPassage(false);
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

  const levelLabel = (lv: LevelFilter) =>
    lv === "" ? t("reading.level_all") : lv;

  return (
    <div className="h-dvh overflow-hidden bg-[#F7F9FC] flex flex-col">
      <header className="shrink-0 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center h-11 px-2 sm:px-3 gap-1.5">
          <Button type="text" shape="circle" size="small" icon={<IconLeft />} onClick={headerBack} />
          <div className="min-w-0 flex-1">
            <Typography.Text className="!font-medium !text-sm !text-[#2D3748]">
              {t("reading.title")}
            </Typography.Text>
            {phase === "practice" && passage && (
              <Typography.Text type="secondary" className="block !text-[11px] truncate leading-tight">
                {passage.title} · {passage.level}
                {isCustomPassage && (
                  <Tag size="small" className="ml-1 scale-90 origin-left">
                    {t("reading.custom_tag")}
                  </Tag>
                )}
              </Typography.Text>
            )}
          </div>
          {phase === "list" && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex rounded-md bg-[#F1F5F9] p-0.5">
                {(["system", "custom"] as SourceTab[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-medium transition-all whitespace-nowrap",
                      sourceTab === key
                        ? "bg-white text-[#2D3748] shadow-sm"
                        : "text-[#718096] hover:text-[#2D3748]"
                    )}
                    onClick={() => setSourceTab(key)}
                  >
                    {key === "system" ? t("reading.tab_system") : t("reading.tab_custom")}
                  </button>
                ))}
              </div>
              {sourceTab === "custom" && (
                <Button
                  type="primary"
                  size="mini"
                  icon={<IconPlus />}
                  onClick={() => navigate("/reading-comprehension/custom/new")}
                />
              )}
            </div>
          )}
          {phase === "practice" && (
            <Typography.Text type="secondary" className="!text-[11px] shrink-0">
              {answeredCount}/{totalQuestions}
            </Typography.Text>
          )}
        </div>
        {phase === "practice" && <Progress percent={percent} showText={false} size="small" className="!mb-0" />}
        {phase === "list" && (
          <div className="px-3 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
            {LEVELS.map((lv) => (
              <button
                key={lv || "all"}
                type="button"
                className={cn(
                  "shrink-0 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors",
                  levelFilter === lv
                    ? "bg-[#2D3748] text-white"
                    : "bg-[#F1F5F9] text-[#718096] hover:bg-[#E2E8F0]"
                )}
                onClick={() => setLevelFilter(lv)}
              >
                {levelLabel(lv)}
              </button>
            ))}
          </div>
        )}
      </header>

      {err && (
        <div className="mx-3 mt-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {err}
        </div>
      )}

      {phase === "list" && (
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          {loadingList || loadingPassage ? (
            <div className="flex justify-center py-12">
              <Spin tip={t("common.loading")} />
            </div>
          ) : passages.length === 0 ? (
            <Card className="!rounded-xl">
              <Empty
                description={
                  sourceTab === "custom"
                    ? t("reading.empty_custom")
                    : t("reading.empty_list")
                }
              />
              {sourceTab === "custom" && (
                <div className="flex justify-center mt-3">
                  <Button
                    type="primary"
                    onClick={() => navigate("/reading-comprehension/custom/new")}
                  >
                    {t("reading.import_custom")}
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <div className="space-y-1.5">
              {passages.map((p) => (
                <button
                  key={`${p.isCustom ? "c" : "s"}-${p.id}`}
                  type="button"
                  onClick={() => void openPassage(p.id, !!p.isCustom)}
                  className="w-full text-left bg-white border border-[#E2E8F0] rounded-lg px-3 py-2.5 hover:border-[#4ECDC4] transition-colors active:bg-[#F7FAFC]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium text-[#2D3748] truncate">{p.title}</span>
                        <Tag size="small" color="arcoblue" className="!scale-90 shrink-0">
                          {p.level}
                        </Tag>
                        {p.isCustom && (
                          <Tag size="small" color="purple" className="!scale-90 shrink-0">
                            {t("reading.custom_tag")}
                          </Tag>
                        )}
                      </div>
                      <p className="text-[11px] text-[#718096] mt-0.5 truncate">
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
                      </p>
                    </div>
                    {typeof p.lastScore === "number" && (
                      <Tag size="small" color={p.lastScore >= 80 ? "green" : "orangered"} className="shrink-0">
                        {t("practice.last_score", { score: p.lastScore })}
                      </Tag>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === "result" && result && (
        <div className="flex-1 min-h-0 overflow-auto px-4 mt-6 flex items-start justify-center">
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
                  if (result.passageId) void openPassage(result.passageId, isCustomPassage);
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
          <div className="flex-1 min-h-0 overflow-auto px-3 mt-6 pb-24">
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

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-3 hidden sm:block">
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

          <CloudButton
            type="button"
            variant="brand"
            size="iconRound"
            onClick={() => void onSubmit()}
            disabled={!allAnswered || submitting}
            loading={submitting}
            className="fixed right-3 bottom-20 z-50 size-11 shadow-lg sm:hidden"
            aria-label={t("practice.submit")}
          >
            <ArrowRight size={20} />
          </CloudButton>
        </>
      )}
    </div>
  );
}
