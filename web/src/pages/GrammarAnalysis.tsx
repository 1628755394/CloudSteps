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
  getGrammarLesson,
  listGrammarLessons,
  submitGrammarLesson,
  type GrammarLessonDetail,
  type GrammarLessonListItem,
  type GrammarSubmitResult,
} from "../api/grammar";
import { formatApiMessage } from "../utils/apiMessage";

type Phase = "list" | "learn" | "practice" | "result";

export default function GrammarAnalysis() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("list");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [lessons, setLessons] = useState<GrammarLessonListItem[]>([]);
  const [lesson, setLesson] = useState<GrammarLessonDetail | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<GrammarSubmitResult | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const loadList = async () => {
    setLoadingList(true);
    setErr(null);
    try {
      const res = await listGrammarLessons({ page: 1, pageSize: 50 });
      if (res.code !== 200) {
        setErr(formatApiMessage(res.msg, "grammar.load_list_failed"));
        setLessons([]);
        return;
      }
      setLessons(Array.isArray(res.data?.list) ? res.data.list : []);
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      setErr(formatApiMessage(apiMsg, "grammar.load_list_failed"));
      setLessons([]);
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
  const totalQuestions = lesson?.questions?.length ?? 0;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;
  const percent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const openLesson = async (id: number) => {
    setLoadingLesson(true);
    setErr(null);
    try {
      const res = await getGrammarLesson(id);
      if (res.code !== 200 || !res.data) {
        setErr(formatApiMessage(res.msg, "grammar.load_lesson_failed"));
        return;
      }
      setLesson(res.data);
      setAnswers({});
      setResult(null);
      startedAtRef.current = Date.now();
      setPhase("learn");
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      setErr(formatApiMessage(apiMsg, "grammar.load_lesson_failed"));
    } finally {
      setLoadingLesson(false);
    }
  };

  const onSubmit = async () => {
    if (!lesson || !allAnswered) return;
    setSubmitting(true);
    setErr(null);
    try {
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      const res = await submitGrammarLesson(lesson.id, {
        answers: lesson.questions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id] || "",
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
    setLesson(null);
    setAnswers({});
    setResult(null);
    setErr(null);
  };

  const headerBack = () => {
    if (phase === "list") navigate(-1);
    else if (phase === "practice") setPhase("learn");
    else if (phase === "result") backToList();
    else backToList();
  };

  return (
    <div className="h-dvh overflow-hidden bg-[#F7F9FC] flex flex-col">
      <header className="shrink-0 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center h-12 px-3 gap-2">
          <Button type="text" shape="circle" icon={<IconLeft />} onClick={headerBack} />
          <div className="min-w-0 flex-1">
            <Typography.Text className="!font-medium !text-[#2D3748]">{t("grammar.title")}</Typography.Text>
            {(phase === "learn" || phase === "practice") && lesson && (
              <Typography.Text type="secondary" className="block !text-xs truncate">
                {lesson.title} · {lesson.level}
              </Typography.Text>
            )}
            {phase === "list" && (
              <Typography.Text type="secondary" className="block !text-xs">
                {t("grammar.subtitle_list")}
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
          {loadingList || loadingLesson ? (
            <div className="flex justify-center py-16">
              <Spin tip={t("common.loading")} />
            </div>
          ) : lessons.length === 0 ? (
            <Card className="!rounded-xl">
              <Empty description={t("grammar.empty_list")} />
            </Card>
          ) : (
            <Space direction="vertical" size={10} className="w-full">
              {lessons.map((l) => (
                <Card
                  key={l.id}
                  hoverable
                  className="!rounded-xl cursor-pointer"
                  onClick={() => void openLesson(l.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Typography.Text className="!font-semibold !text-[#2D3748]">
                          {l.title}
                        </Typography.Text>
                        <Tag size="small" color="arcoblue">
                          {l.level}
                        </Tag>
                        {l.topic && (
                          <Tag size="small" color="cyan">
                            {l.topic}
                          </Tag>
                        )}
                      </div>
                      {l.summary && (
                        <Typography.Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          className="!mb-2 !text-xs"
                        >
                          {l.summary}
                        </Typography.Paragraph>
                      )}
                      <Typography.Text type="secondary" className="!text-xs">
                        {t("practice.questions_meta", {
                          count: l.questionCount ?? 0,
                          minutes: l.estimatedMinutes ?? 5,
                        })}
                      </Typography.Text>
                    </div>
                    {typeof l.lastScore === "number" && (
                      <Tag color={l.lastScore >= 80 ? "green" : "orangered"}>
                        {t("practice.last_score", { score: l.lastScore })}
                      </Tag>
                    )}
                  </div>
                </Card>
              ))}
            </Space>
          )}
        </div>
      )}

      {phase === "learn" && lesson && (
        <>
          <div className="flex-1 min-h-0 overflow-auto px-3 py-3 pb-24">
            <Card className="!rounded-xl shadow-sm !mb-3" title={t("grammar.explanation")}>
              <div
                className="grammar-html-content !text-[#2D3748] leading-7"
                dangerouslySetInnerHTML={{ __html: lesson.explanation }}
              />
            </Card>

            {(lesson.examples?.length ?? 0) > 0 && (
              <Card className="!rounded-xl shadow-sm !mb-3" title={t("grammar.examples")}>
                <Space direction="vertical" size={12} className="w-full">
                  {lesson.examples.map((ex, i) => (
                    <div key={i} className="rounded-lg bg-[#F7F9FC] px-3 py-2.5">
                      <div className="text-sm font-medium text-[#2D3748]">{ex.en}</div>
                      {ex.zh && (
                        <div className="text-xs text-[#718096] mt-1">{ex.zh}</div>
                      )}
                    </div>
                  ))}
                </Space>
              </Card>
            )}
          </div>
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-3">
            <Button
              type="primary"
              long
              size="large"
              disabled={!lesson.questions?.length}
              onClick={() => {
                startedAtRef.current = Date.now();
                setPhase("practice");
              }}
            >
              {lesson.questions?.length ? t("grammar.start_practice") : t("grammar.no_questions")}
            </Button>
          </div>
        </>
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
                    d.correct ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
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
                  if (result.lessonId) void openLesson(result.lessonId);
                }}
              >
                {t("practice.learn_again")}
              </Button>
            </Space>
          </Card>
        </div>
      )}

      {phase === "practice" && lesson && (
        <>
          <div className="flex-1 min-h-0 overflow-auto px-3 py-3 pb-24">
            <Space direction="vertical" size={12} className="w-full">
              {lesson.questions.map((q, idx) => (
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
