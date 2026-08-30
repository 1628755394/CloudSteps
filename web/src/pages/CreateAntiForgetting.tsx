import { CloudButton } from "../components/cloudsteps";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import {
  REVIEW_SCHEDULE_DAYS,
  REVIEW_TIMES_OPTIONS,
  normalizeReviewCurvePreset,
  reviewCurveLabel,
} from "../utils/reviewCurve";

function formatDateCN(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${mm}/${dd} 周${weekday}`;
}

export default function CreateAntiForgetting() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [preset, setPreset] = useState<string>("times5");

  useEffect(() => {
    setPreset(normalizeReviewCurvePreset(user?.reviewCurvePreset));
  }, [user?.reviewCurvePreset]);

  const scheduleDays = useMemo(() => {
    const p = normalizeReviewCurvePreset(preset) as keyof typeof REVIEW_SCHEDULE_DAYS;
    return REVIEW_SCHEDULE_DAYS[p] ?? REVIEW_SCHEDULE_DAYS.times5;
  }, [preset]);

  const reviewDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return scheduleDays.map((dayNum) => {
      const d = new Date(today);
      d.setDate(d.getDate() + (dayNum - 1));
      return { dayNum, date: d, label: formatDateCN(d) };
    });
  }, [scheduleDays]);

  const currentOpt = REVIEW_TIMES_OPTIONS.find((o) => o.value === normalizeReviewCurvePreset(preset));

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
            今天学完的词已按<strong className="font-semibold">{reviewCurveLabel(preset)}</strong>
            排入复习计划，开课当天（第 1 天）即开始。以下是各次复习的具体日期：
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarClock size={16} className="text-primary" />
            复习时间安排
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            如需调整抗遗忘次数（{currentOpt?.label ?? "5 次"}），请前往学员管理页面设置。
          </p>

          <div className="space-y-2 mt-2">
            {reviewDates.map((item, idx) => (
              <div
                key={item.dayNum}
                className={`flex items-center gap-3 rounded-xl border p-3.5 ${
                  idx === 0
                    ? "border-primary bg-primary-soft/40"
                    : "border-border bg-card"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold ${
                    idx === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">
                    第 {item.dayNum} 天
                    {idx === 0 && (
                      <span className="ml-2 text-[11px] text-primary font-normal">今天</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <CloudButton
          variant="brand"
          className="w-full h-11"
          onClick={() => navigate("/anti-forgetting")}
        >
          查看复习计划
        </CloudButton>
      </div>
    </div>
  );
}
