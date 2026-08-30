import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  CalendarDays,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { CloudButton } from "./cloudsteps";
import {
  COACH_ONBOARDING_STEPS,
  markCoachOnboardingDone,
  measureCoachTarget,
  scrollCoachTargetIntoView,
  setCoachOnboardingUiActive,
  type CoachOnboardingIcon,
  type CoachTargetRect,
} from "../utils/coachOnboarding";

type Props = {
  open: boolean;
  userId: number;
  onDone: () => void;
};

const PAD = 8;

function StepIcon({ name }: { name: CoachOnboardingIcon }) {
  const common = "text-primary";
  switch (name) {
    case "welcome":
      return <Sparkles className={common} size={22} />;
    case "students":
      return <UserPlus className={common} size={22} />;
    case "picker":
      return <Users className={common} size={22} />;
    case "schedule":
      return <CalendarDays className={common} size={22} />;
    case "training":
      return <BookOpen className={common} size={22} />;
  }
}

function TooltipCard({
  stepIndex,
  total,
  title,
  body,
  icon,
  isLast,
  showPrev,
  onSkip,
  onPrev,
  onNext,
  className,
  style,
}: {
  stepIndex: number;
  total: number;
  title: string;
  body: string;
  icon: CoachOnboardingIcon;
  isLast: boolean;
  showPrev: boolean;
  onSkip: () => void;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`w-[min(100vw-2rem,22rem)] rounded-2xl border border-border bg-card shadow-xl ${className ?? ""}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-onboarding-title"
    >
      <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {stepIndex + 1} / {total}
        </span>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={onSkip}
        >
          跳过
        </button>
      </div>
      <div className="px-4 pb-3 pt-1 flex gap-3 items-start">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
          <StepIcon name={icon} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="coach-onboarding-title"
            className="text-base font-semibold text-foreground mb-1"
          >
            {title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 pb-3">
        {COACH_ONBOARDING_STEPS.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === stepIndex ? "w-5 bg-primary" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
      <div className="px-4 pb-4 flex gap-2">
        {showPrev ? (
          <CloudButton
            variant="brandOutline"
            size="sm"
            className="flex-1"
            onClick={onPrev}
          >
            上一步
          </CloudButton>
        ) : null}
        <CloudButton
          variant="brand"
          size="sm"
          className="flex-1"
          onClick={onNext}
        >
          {isLast ? "去添加学员" : "下一步"}
        </CloudButton>
      </div>
    </div>
  );
}

export function CoachOnboarding({ open, userId, onDone }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [hole, setHole] = useState<CoachTargetRect | null>(null);

  const current = COACH_ONBOARDING_STEPS[step];
  const total = COACH_ONBOARDING_STEPS.length;
  const isLast = step >= total - 1;
  const hasTarget = Boolean(current?.target);

  const remountMeasure = useCallback(() => {
    const target = COACH_ONBOARDING_STEPS[step]?.target;
    if (!target) {
      setHole(null);
      return;
    }
    scrollCoachTargetIntoView(target);
    const run = () => {
      setHole(measureCoachTarget(target));
    };
    run();
    window.setTimeout(run, 120);
    window.setTimeout(run, 280);
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    remountMeasure();
  }, [open, remountMeasure]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => remountMeasure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, remountMeasure]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // 一旦展示过就写入浏览器缓存，避免下次进入重复弹出；并占用全局弹层闸门
  useEffect(() => {
    if (!open || !userId) return;
    setCoachOnboardingUiActive(true);
    markCoachOnboardingDone(userId);
    return () => {
      setCoachOnboardingUiActive(false);
    };
  }, [open, userId]);

  if (!open || !current) return null;

  const finish = (goAddStudent: boolean) => {
    markCoachOnboardingDone(userId);
    setCoachOnboardingUiActive(false);
    onDone();
    if (goAddStudent) navigate("/my-students/new");
  };

  const goNext = () => {
    if (isLast) {
      finish(true);
      return;
    }
    setStep((s) => s + 1);
  };

  const goPrev = () => {
    if (step <= 0) return;
    setStep((s) => s - 1);
  };

  // 居中欢迎步 / 找不到锚点时回退居中
  if (!hasTarget || !hole) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
        <TooltipCard
          stepIndex={step}
          total={total}
          title={current.title}
          body={
            hasTarget && !hole
              ? `${current.body}（当前布局下未找到入口，可先跳过或点下一步）`
              : current.body
          }
          icon={current.icon}
          isLast={isLast}
          showPrev={step > 0}
          onSkip={() => finish(false)}
          onPrev={goPrev}
          onNext={goNext}
          className="animate-in fade-in-0 zoom-in-95 duration-200"
        />
      </div>
    );
  }

  const hl = {
    top: Math.max(0, hole.top - PAD),
    left: Math.max(0, hole.left - PAD),
    width: hole.width + PAD * 2,
    height: hole.height + PAD * 2,
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const vh = typeof window !== "undefined" ? window.innerHeight : 667;
  const tipWidth = Math.min(vw - 32, 352);
  const tipLeft = Math.min(
    Math.max(16, hl.left + hl.width / 2 - tipWidth / 2),
    vw - tipWidth - 16,
  );

  // 预估卡片高度，避免贴边被裁切
  const tipH = 210;
  const placeBelowPrefer = hl.top + hl.height < vh * 0.55;
  let tipTop: number;
  let arrowBelowHole: boolean;
  if (placeBelowPrefer) {
    tipTop = hl.top + hl.height + 14;
    arrowBelowHole = true;
    if (tipTop + tipH > vh - 12) {
      tipTop = Math.max(12, hl.top - tipH - 14);
      arrowBelowHole = false;
    }
  } else {
    tipTop = Math.max(12, hl.top - tipH - 14);
    arrowBelowHole = false;
    if (tipTop < 12) {
      tipTop = Math.min(vh - tipH - 12, hl.top + hl.height + 14);
      arrowBelowHole = true;
    }
  }

  const arrowLeft = Math.min(
    Math.max(24, hl.left + hl.width / 2 - tipLeft - 8),
    tipWidth - 40,
  );

  return (
    <div className="fixed inset-0 z-[70]" aria-hidden={false}>
      {/* 挖洞高亮 */}
      <div
        className="pointer-events-none absolute rounded-xl border-2 border-primary transition-[top,left,width,height] duration-300 ease-out"
        style={{
          top: hl.top,
          left: hl.left,
          width: hl.width,
          height: hl.height,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          animation: "coach-pulse 1.6s ease-in-out infinite",
        }}
      />
      {/* 拦截点击（高亮区外） */}
      <div className="absolute inset-0" />

      <div
        className="absolute z-[71] animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
        style={{ top: tipTop, left: tipLeft, width: tipWidth }}
      >
        <div
          className={`absolute w-0 h-0 border-x-8 border-x-transparent ${
            arrowBelowHole
              ? "bottom-full border-b-8 border-b-card"
              : "top-full border-t-8 border-t-card"
          }`}
          style={{ left: arrowLeft }}
        />
        <TooltipCard
          stepIndex={step}
          total={total}
          title={current.title}
          body={current.body}
          icon={current.icon}
          isLast={isLast}
          showPrev={step > 0}
          onSkip={() => finish(false)}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>

      <style>{`
        @keyframes coach-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 0 rgba(78,205,196,0.45); }
          50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 10px rgba(78,205,196,0); }
        }
      `}</style>
    </div>
  );
}
