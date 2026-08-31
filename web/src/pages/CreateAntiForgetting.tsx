import { CloudButton } from "../components/cloudsteps";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type ReviewCurvePreset, updateUserPreferences } from "../api/auth";
import { useAuthStore } from "../stores/authStore";
import { showToast } from "../utils/toast";
import { formatApiMessage } from "../utils/apiMessage";
import {
  getReviewTimesOptions,
  normalizeReviewCurvePreset,
} from "../utils/reviewCurve";

export default function CreateAntiForgetting() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [preset, setPreset] = useState<ReviewCurvePreset>("times5");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPreset(normalizeReviewCurvePreset(user?.reviewCurvePreset));
  }, [user?.reviewCurvePreset]);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const res = await updateUserPreferences({ reviewCurvePreset: preset });
      if (res.code !== 200) {
        showToast.error(formatApiMessage(res.msg, "common.operation_failed"));
        return;
      }
      updateProfile({ reviewCurvePreset: preset });
      showToast.success(t("create_anti_forgetting.saved_toast"));
      navigate("/anti-forgetting");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? formatApiMessage(String((e as { msg: string }).msg))
          : t("common.operation_failed");
      showToast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="bg-card sticky top-0 z-10 border-b border-border">
        <div className="flex items-center px-4 h-14">
          <CloudButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="-ml-1"
          >
            <ArrowLeft size={22} className="text-charcoal" />
          </CloudButton>
          <h1 className="flex-1 text-center text-base font-semibold text-foreground -ml-8">
            {t("create_anti_forgetting.title")}
          </h1>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4 max-w-lg mx-auto pb-8">
        <div className="rounded-xl bg-primary-soft px-4 py-3">
          <p className="text-sm text-charcoal leading-relaxed">
            {t("create_anti_forgetting.intro")}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t("create_anti_forgetting.times_label")}</p>
          {getReviewTimesOptions().map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPreset(opt.value)}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${
                preset === opt.value
                  ? "border-primary bg-primary-soft/60"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="text-sm font-semibold text-foreground">{opt.label}</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
            </button>
          ))}
        </div>

        <CloudButton
          variant="brand"
          className="w-full h-11"
          loading={saving}
          onClick={() => void handleConfirm()}
        >
          {t("create_anti_forgetting.save_view")}
        </CloudButton>
      </div>
    </div>
  );
}
