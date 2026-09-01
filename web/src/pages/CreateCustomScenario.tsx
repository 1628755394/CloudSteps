import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { PageBackHeader } from "../components/PageBackHeader";
import { CloudButton } from "../components/cloudsteps";
import { CloudInput } from "../components/cloudsteps/arco";
import { CloudSelect } from "../components/cloudsteps/CloudSelect";
import { Textarea } from "../components/ui/textarea";
import { createCustomScenario } from "../api/scenarioDialogue";
import { showToast } from "../utils/toast";
import { formatApiMessage } from "../utils/apiMessage";

const DIFFICULTIES = [
  { value: "easy", labelKey: "scenario.difficulty.easy" },
  { value: "medium", labelKey: "scenario.difficulty.medium" },
  { value: "hard", labelKey: "scenario.difficulty.hard" },
] as const;

export default function CreateCustomScenario() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiRole, setAiRole] = useState("");
  const [prompt, setPrompt] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedRole = aiRole.trim();
    const trimmedPrompt = prompt.trim();
    if (!trimmedName || !trimmedRole || !trimmedPrompt) {
      showToast.info(t("custom_scenario.form_invalid"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await createCustomScenario({
        name: trimmedName,
        description: description.trim(),
        aiRole: trimmedRole,
        prompt: trimmedPrompt,
        difficulty,
      });
      if (res.code !== 200) {
        showToast.error(formatApiMessage(res.msg, "common.operation_failed"));
        return;
      }
      showToast.success(t("custom_scenario.created"));
      navigate("/scenario-dialogues", { replace: true, state: { tab: "custom" } });
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
      <PageBackHeader
        title={t("custom_scenario.title")}
        fallbackTo="/scenario-dialogues"
        maxWidthClass="max-w-none"
      />

      <div className="flex-1 w-full max-w-2xl mx-auto py-4 px-4 pb-24 space-y-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5 space-y-5 shadow-sm">
          <p className="text-sm text-[#718096]">{t("custom_scenario.desc")}</p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#2D3748]">
                {t("custom_scenario.field_name")}
              </label>
              <CloudInput
                value={name}
                onChange={setName}
                placeholder={t("custom_scenario.field_name_ph")}
                maxLength={64}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#2D3748]">
                {t("custom_scenario.field_description")}
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("custom_scenario.field_description_ph")}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#2D3748]">
                {t("custom_scenario.field_difficulty")}
              </label>
              <CloudSelect
                value={difficulty}
                onChange={(v) => setDifficulty(String(v))}
                options={DIFFICULTIES.map((d) => ({
                  label: t(d.labelKey),
                  value: d.value,
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#2D3748]">
                {t("custom_scenario.field_ai_role")}
              </label>
              <CloudInput
                value={aiRole}
                onChange={setAiRole}
                placeholder={t("custom_scenario.field_ai_role_ph")}
                maxLength={128}
              />
              <p className="text-xs text-[#718096]">{t("custom_scenario.field_ai_role_hint")}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#2D3748]">
                {t("custom_scenario.field_prompt")}
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("custom_scenario.field_prompt_ph")}
                rows={8}
                className="resize-y text-sm font-mono leading-relaxed"
              />
              <p className="text-xs text-[#718096]">{t("custom_scenario.field_prompt_hint")}</p>
            </div>
          </div>

          <div className="rounded-lg bg-[#FFF9E6] border border-[#F6E05E]/40 px-3 py-2.5 text-xs text-[#744210] leading-relaxed">
            {t("custom_scenario.review_notice")}
          </div>

          <CloudButton
            type="primary"
            long
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            {t("custom_scenario.submit")}
          </CloudButton>
        </div>
      </div>
    </div>
  );
}
