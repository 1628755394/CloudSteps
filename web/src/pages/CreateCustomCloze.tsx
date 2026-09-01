import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { PageBackHeader } from "../components/PageBackHeader";
import { CloudButton } from "../components/cloudsteps";
import { CloudInput } from "../components/cloudsteps/arco";
import { CloudSelect } from "../components/cloudsteps/CloudSelect";
import { Textarea } from "../components/ui/textarea";
import { createCustomClozePassage, type CustomClozeBlankInput } from "../api/customCloze";
import { showToast } from "../utils/toast";
import { formatApiMessage } from "../utils/apiMessage";

const LEVELS = ["初阶", "中阶", "高阶"] as const;
const OPTION_KEYS = ["A", "B", "C", "D"] as const;

type BlankDraft = CustomClozeBlankInput & { id: string };

const emptyBlank = (no: number): BlankDraft => ({
  id: crypto.randomUUID(),
  blankNo: no,
  options: OPTION_KEYS.map((k) => ({ key: k, text: "" })),
  answer: "A",
  explanation: "",
});

export default function CreateCustomCloze() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<string>("初阶");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [blanks, setBlanks] = useState<BlankDraft[]>([emptyBlank(1)]);
  const [submitting, setSubmitting] = useState(false);

  const updateBlank = (id: string, patch: Partial<BlankDraft>) => {
    setBlanks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const updateOption = (id: string, key: (typeof OPTION_KEYS)[number], value: string) => {
    setBlanks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, options: b.options.map((o) => (o.key === key ? { ...o, text: value } : o)) }
          : b
      )
    );
  };

  const addBlank = () => {
    setBlanks((prev) => [...prev, emptyBlank(prev.length + 1)]);
  };

  const removeBlank = (id: string) => {
    setBlanks((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, blankNo: i + 1 }));
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      showToast.info(t("custom_cloze.form_invalid"));
      return;
    }
    const payloadBlanks = blanks.map(({ id: _id, ...b }) => b);
    const invalid = payloadBlanks.some(
      (b) => !b.options.every((o) => o.text.trim()) || !b.answer
    );
    if (invalid) {
      showToast.info(t("custom_cloze.form_invalid"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await createCustomClozePassage({
        title: title.trim(),
        level,
        summary: summary.trim(),
        content: content.trim(),
        blanks: payloadBlanks,
      });
      if (res.code !== 200) {
        showToast.error(formatApiMessage(res.msg, "common.operation_failed"));
        return;
      }
      showToast.success(t("custom_cloze.created"));
      navigate("/cloze-practice", { replace: true, state: { tab: "custom" } });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : formatApiMessage(undefined, "common.operation_failed");
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#F7F9FC]">
      <PageBackHeader title={t("custom_cloze.title")} fallbackTo="/cloze-practice" maxWidthClass="max-w-none" />

      <div className="flex-1 w-full max-w-2xl mx-auto py-4 px-4 pb-24 space-y-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5 space-y-5 shadow-sm">
          <p className="text-sm text-[#718096]">{t("custom_cloze.desc")}</p>

          <div className="space-y-3">
            <label className="text-sm font-medium text-[#2D3748]">{t("custom_cloze.field_title")}</label>
            <CloudInput value={title} onChange={setTitle} placeholder={t("custom_cloze.field_title_ph")} maxLength={128} />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-[#2D3748]">{t("custom_cloze.field_level")}</label>
            <CloudSelect
              value={level}
              onChange={(v) => setLevel(String(v))}
              options={LEVELS.map((lv) => ({ label: lv, value: lv }))}
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-[#2D3748]">{t("custom_cloze.field_content")}</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("custom_cloze.field_content_ph")}
              rows={6}
              className="resize-y text-sm font-mono leading-relaxed"
            />
            <p className="text-xs text-[#718096]">{t("custom_cloze.content_hint")}</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#2D3748]">{t("custom_cloze.section_blanks")}</h3>
              <button type="button" className="text-xs text-[#4ECDC4] flex items-center gap-1" onClick={addBlank}>
                <Plus size={14} /> {t("custom_cloze.add_blank")}
              </button>
            </div>
            {blanks.map((b) => (
              <div key={b.id} className="rounded-lg border border-[#E2E8F0] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("custom_cloze.blank_no", { no: b.blankNo })}</span>
                  <button type="button" className="text-[#718096]" onClick={() => removeBlank(b.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {OPTION_KEYS.map((key) => (
                  <CloudInput
                    key={key}
                    value={b.options.find((o) => o.key === key)?.text || ""}
                    onChange={(v) => updateOption(b.id, key, v)}
                    placeholder={t("custom_cloze.option_ph", { key })}
                  />
                ))}
                <CloudSelect
                  value={b.answer}
                  onChange={(v) => updateBlank(b.id, { answer: String(v) })}
                  options={OPTION_KEYS.map((k) => ({ label: k, value: k }))}
                />
                <Textarea
                  value={b.explanation || ""}
                  onChange={(e) => updateBlank(b.id, { explanation: e.target.value })}
                  placeholder={t("custom_cloze.field_explanation_ph")}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            ))}
          </div>

          <CloudButton type="button" variant="brand" long loading={submitting} onClick={() => void handleSubmit()}>
            {t("custom_cloze.submit")}
          </CloudButton>
        </div>
      </div>
    </div>
  );
}
