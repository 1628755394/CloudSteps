import { CloudButton } from "../components/cloudsteps";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { type ReviewCurvePreset, updateUserPreferences } from "../api/auth";
import { useAuthStore } from "../stores/authStore";
import { showToast } from "../utils/toast";
import {
  REVIEW_TIMES_OPTIONS,
  normalizeReviewCurvePreset,
} from "../utils/reviewCurve";

export default function CreateAntiForgetting() {
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
        showToast.error(res.msg || "保存失败");
        return;
      }
      updateProfile({ reviewCurvePreset: preset });
      showToast.success("抗遗忘次数已保存，今天学的词当天（第 1 天）即进入复习计划");
      navigate("/anti-forgetting");
    } catch {
      showToast.error("保存失败");
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
            抗遗忘设置
          </h1>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4 max-w-lg mx-auto pb-8">
        <div className="rounded-xl bg-primary-soft px-4 py-3">
          <p className="text-sm text-charcoal leading-relaxed">
            今天学完的词会排在<strong className="font-semibold">开课当天（第 1 天）</strong>的复习任务里。
            按所选次数与艾宾浩斯「第 N 天」表头，在抗遗忘日历各日期自动出现；列表会显示对应识记时段。
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">抗遗忘次数</p>
          {REVIEW_TIMES_OPTIONS.map((opt) => (
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
          保存并查看复习计划
        </CloudButton>
      </div>
    </div>
  );
}
