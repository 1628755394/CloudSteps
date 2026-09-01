import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, Trash2, Upload } from "lucide-react";
import { PageBackHeader } from "../components/PageBackHeader";
import { CloudButton } from "../components/cloudsteps";
import { CloudInput } from "../components/cloudsteps/arco";
import { CloudSelect } from "../components/cloudsteps/CloudSelect";
import { Textarea } from "../components/ui/textarea";
import {
  createCustomReadingPassage,
  importCustomReadingPassages,
  type CustomReadingImportPassage,
} from "../api/customReading";
import {
  downloadCustomReadingTemplateLocal,
  draftToImportPassage,
  emptyQuestion,
  parseCustomReadingExcel,
  type QuestionDraft,
} from "../utils/customReadingLocal";
import { showToast } from "../utils/toast";
import { formatApiMessage } from "../utils/apiMessage";
import { cn } from "../utils/cn";

type ImportTab = "form" | "excel";

const LEVELS = ["初阶", "中阶", "高阶"] as const;
const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default function CreateCustomReading() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const excelRef = useRef<HTMLInputElement>(null);

  const importTabs: { key: ImportTab; label: string }[] = [
    { key: "form", label: t("custom_reading.tab_form") },
    { key: "excel", label: t("custom_reading.tab_excel") },
  ];

  const [tab, setTab] = useState<ImportTab>("form");
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<string>("初阶");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [preview, setPreview] = useState<CustomReadingImportPassage[]>([]);
  const [expandedPreview, setExpandedPreview] = useState<Record<string, boolean>>({});
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileLabel, setFileLabel] = useState("");

  const updateQuestion = (id: string, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const updateOption = (id: string, key: (typeof OPTION_KEYS)[number], value: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, options: { ...q.options, [key]: value } } : q
      )
    );
  };

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);

  const removeQuestion = (id: string) => {
    setQuestions((prev) => (prev.length <= 1 ? prev : prev.filter((q) => q.id !== id)));
  };

  const runImportForm = async () => {
    const payload = draftToImportPassage(title, level, summary, content, questions);
    if (!payload) {
      showToast.info(t("custom_reading.form_invalid"));
      return;
    }
    setImporting(true);
    try {
      const res = await createCustomReadingPassage(payload);
      if (res.code !== 200) {
        showToast.error(formatApiMessage(res.msg, "common.operation_failed"));
        return;
      }
      showToast.success(t("custom_reading.created"));
      navigate("/reading-comprehension", { replace: true });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : formatApiMessage(undefined, "common.operation_failed");
      showToast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const runParseExcel = async (file: File) => {
    setParsing(true);
    setFileLabel(file.name);
    try {
      const list = await parseCustomReadingExcel(file);
      if (!list.length) {
        showToast.error(t("custom_reading.excel_invalid"));
        setPreview([]);
        return;
      }
      setPreview(list);
      setExpandedPreview({ [list[0]?.title ?? "0"]: true });
      showToast.success(t("custom_reading.parsed", { count: list.length }));
    } catch {
      showToast.error(t("custom_reading.excel_parse_failed"));
    } finally {
      setParsing(false);
    }
  };

  const runImportExcel = async () => {
    if (!preview.length) {
      showToast.info(t("custom_reading.import_first"));
      return;
    }
    setImporting(true);
    try {
      const res = await importCustomReadingPassages({
        source: "excel",
        passages: preview,
      });
      if (res.code !== 200) {
        showToast.error(formatApiMessage(res.msg, "common.operation_failed"));
        return;
      }
      showToast.success(t("custom_reading.imported", { count: res.data?.count ?? 0 }));
      navigate("/reading-comprehension", { replace: true });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : formatApiMessage(undefined, "common.operation_failed");
      showToast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#F7F9FC]">
      <PageBackHeader
        title={t("custom_reading.title")}
        fallbackTo="/reading-comprehension"
        maxWidthClass="max-w-none"
      />

      <div className="flex-1 w-full max-w-2xl mx-auto py-4 px-4 pb-24 space-y-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5 space-y-5 shadow-sm">
          <p className="text-sm text-[#718096]">{t("custom_reading.desc")}</p>

          <div className="flex items-stretch border-b border-[#E2E8F0]">
            {importTabs.map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "relative flex-1 pb-2.5 pt-0.5 text-sm transition-colors",
                    active ? "text-[#4ECDC4] font-semibold" : "text-[#718096] font-medium"
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-8 rounded-full bg-[#4ECDC4]" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {tab === "form" ? (
            <div className="space-y-5">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[#2D3748]">
                  {t("custom_reading.section_passage")}
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#2D3748]">
                      {t("custom_reading.field_title")}
                    </label>
                    <CloudInput
                      value={title}
                      onChange={setTitle}
                      placeholder={t("custom_reading.field_title_ph")}
                      maxLength={128}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#2D3748]">
                      {t("custom_reading.field_level")}
                    </label>
                    <CloudSelect
                      value={level}
                      onChange={(v) => setLevel(String(v))}
                      options={LEVELS.map((lv) => ({ label: lv, value: lv }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#2D3748]">
                      {t("custom_reading.field_summary")}
                    </label>
                    <CloudInput
                      value={summary}
                      onChange={setSummary}
                      placeholder={t("custom_reading.field_summary_ph")}
                      maxLength={256}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#2D3748]">
                      {t("custom_reading.field_content")}
                    </label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={t("custom_reading.field_content_ph")}
                      rows={8}
                      className="resize-y min-h-[160px] text-sm leading-relaxed"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#2D3748]">
                    {t("custom_reading.section_questions")}
                  </h3>
                  <CloudButton type="button" variant="outline" onClick={addQuestion}>
                    <Plus size={14} className="mr-1" />
                    {t("custom_reading.add_question")}
                  </CloudButton>
                </div>

                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F7F9FC] p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[#2D3748]">
                          {t("custom_reading.question_no", { no: idx + 1 })}
                        </span>
                        {questions.length > 1 && (
                          <button
                            type="button"
                            className="text-[#A0AEC0] hover:text-red-500 p-1"
                            onClick={() => removeQuestion(q.id)}
                            aria-label={t("custom_reading.remove_question")}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-[#718096]">{t("custom_reading.field_stem")}</label>
                        <CloudInput
                          value={q.stem}
                          onChange={(v) => updateQuestion(q.id, { stem: v })}
                          placeholder={t("custom_reading.field_stem_ph")}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {OPTION_KEYS.map((key) => (
                          <div key={key} className="space-y-1">
                            <label className="text-xs text-[#718096]">
                              {t("custom_reading.option_label", { key })}
                            </label>
                            <CloudInput
                              value={q.options[key]}
                              onChange={(v) => updateOption(q.id, key, v)}
                              placeholder={t("custom_reading.option_ph")}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-[#718096]">{t("custom_reading.field_answer")}</label>
                          <CloudSelect
                            value={q.answer}
                            onChange={(v) =>
                              updateQuestion(q.id, { answer: String(v) as QuestionDraft["answer"] })
                            }
                            options={OPTION_KEYS.map((key) => ({ label: key, value: key }))}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-1">
                          <label className="text-xs text-[#718096]">
                            {t("custom_reading.field_explanation")}
                          </label>
                          <CloudInput
                            value={q.explanation}
                            onChange={(v) => updateQuestion(q.id, { explanation: v })}
                            placeholder={t("custom_reading.field_explanation_ph")}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#718096]">{t("custom_reading.excel_hint")}</p>
              <input
                ref={excelRef}
                type="file"
                accept=".xlsx,.xlsm,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void runParseExcel(f);
                }}
              />
              <div
                role="button"
                tabIndex={0}
                className="rounded-xl border-2 border-dashed border-[#CBD5E0] bg-[#F7F9FC] px-4 py-8 text-center cursor-pointer hover:border-[#4ECDC4] transition-colors"
                onClick={() => excelRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && excelRef.current?.click()}
              >
                <Upload className="mx-auto mb-2 text-[#A0AEC0]" size={28} />
                <p className="text-sm font-medium text-[#2D3748]">{t("custom_reading.choose_file")}</p>
                <p className="text-xs text-[#A0AEC0] mt-1">.xlsx / .xls / .csv</p>
                {fileLabel && (
                  <p className="text-xs text-[#4ECDC4] mt-2">
                    {t("custom_reading.file_label", { name: fileLabel })}
                  </p>
                )}
              </div>
              <CloudButton
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() =>
                  void downloadCustomReadingTemplateLocal()
                    .then(() => showToast.success(t("custom_reading.template_downloaded")))
                    .catch(() => showToast.error(t("custom_reading.excel_parse_failed")))
                }
              >
                {t("custom_reading.download_template")}
              </CloudButton>
              {preview.length > 0 && (
                <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-3 bg-white">
                  <p className="text-sm font-medium text-[#2D3748]">{t("custom_reading.preview_title")}</p>
                  {preview.map((p, idx) => {
                    const key = `${p.title}-${idx}`;
                    const open = !!expandedPreview[key];
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-[#E2E8F0] overflow-hidden bg-[#F7F9FC]"
                      >
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#EDF2F7] transition-colors"
                          onClick={() =>
                            setExpandedPreview((prev) => ({ ...prev, [key]: !prev[key] }))
                          }
                        >
                          <ChevronDown
                            size={16}
                            className={cn(
                              "shrink-0 text-[#A0AEC0] transition-transform",
                              open && "rotate-180"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#2D3748] truncate">{p.title}</p>
                            <p className="text-xs text-[#718096]">
                              {p.level} · {p.questions.length} {t("custom_reading.questions_unit")}
                              {p.summary ? ` · ${p.summary}` : ""}
                            </p>
                          </div>
                        </button>
                        {open && (
                          <div className="px-3 pb-3 space-y-3 border-t border-[#E2E8F0] bg-white">
                            <div className="pt-3">
                              <p className="text-xs font-medium text-[#718096] mb-1">
                                {t("custom_reading.preview_content")}
                              </p>
                              <p className="text-sm text-[#2D3748] whitespace-pre-line leading-relaxed">
                                {p.content}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-[#718096]">
                                {t("custom_reading.preview_questions")}
                              </p>
                              {p.questions.map((q, qIdx) => (
                                <div
                                  key={`${key}-q-${qIdx}`}
                                  className="rounded-md border border-[#E2E8F0] px-3 py-2 text-sm"
                                >
                                  <p className="font-medium text-[#2D3748]">
                                    {qIdx + 1}. {q.stem}
                                  </p>
                                  <ul className="mt-1 space-y-0.5 text-[#718096]">
                                    {q.options.map((o) => (
                                      <li
                                        key={o.key}
                                        className={cn(
                                          o.key === q.answer && "text-[#4ECDC4] font-medium"
                                        )}
                                      >
                                        {o.key}. {o.text}
                                        {o.key === q.answer ? ` (${t("custom_reading.preview_answer")})` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                  {q.explanation && (
                                    <p className="text-xs text-[#A0AEC0] mt-1">{q.explanation}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-3 safe-area-pb">
        <CloudButton
          type="button"
          variant="brand"
          className="w-full max-w-2xl mx-auto block"
          loading={importing || parsing}
          disabled={tab === "excel" && !preview.length}
          onClick={() => void (tab === "form" ? runImportForm() : runImportExcel())}
        >
          {tab === "form" ? t("custom_reading.create_submit") : t("custom_reading.import_submit")}
        </CloudButton>
      </div>
    </div>
  );
}
