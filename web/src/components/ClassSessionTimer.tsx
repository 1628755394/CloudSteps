import { useEffect, useMemo, useState } from "react";
import { Clock, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { CloudButton } from "./cloudsteps";
import { formatCountdown, useClassTimerStore } from "../stores/classTimerStore";
import { beginPracticeBilling, finishPracticeBilling } from "../utils/practiceBilling";
import { getTrainingStudent } from "../utils/trainingStudent";
import { showToast } from "../utils/toast";
import { useAuthStore } from "../stores/authStore";

const PRESETS = [30, 40, 45, 50, 60];
const REMIND_PRESETS = [5, 10, 15, 20, 30];
const INLINE_FLAG = "lbClassTimerInline";

type SetupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wordCount?: number;
};

function playBeep(freq = 880, ms = 0.25) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = freq;
    g.gain.value = 0.08;
    o.start();
    o.stop(ctx.currentTime + ms);
  } catch {
    // ignore
  }
}

async function settleAndStop() {
  const billing = useClassTimerStore.getState().billing;
  useClassTimerStore.getState().stop();
  await finishPracticeBilling(billing);
}

/** 设置 / 调整上课定时 */
export function ClassTimerSetupDialog({ open, onOpenChange, wordCount = 0 }: SetupProps) {
  const storeDuration = useClassTimerStore((s) => s.durationMin);
  const storeRemind = useClassTimerStore((s) => s.remindEveryMin);
  const endsAt = useClassTimerStore((s) => s.endsAt);
  const billing = useClassTimerStore((s) => s.billing);
  const start = useClassTimerStore((s) => s.start);
  const role = useAuthStore((s) => s.user?.role) || "user";
  const isCoach = role === "user" || role === "admin" || role === "teacher";

  const [durationMin, setDurationMin] = useState(storeDuration || 45);
  const [custom, setCustom] = useState("");
  const [remindEveryMin, setRemindEveryMin] = useState(
    REMIND_PRESETS.includes(storeRemind) ? storeRemind : 10
  );
  const [starting, setStarting] = useState(false);
  const [studentName, setStudentName] = useState(() => getTrainingStudent()?.name || "");

  useEffect(() => {
    if (!open) return;
    setDurationMin(storeDuration || 45);
    setCustom("");
    setRemindEveryMin(REMIND_PRESETS.includes(storeRemind) ? storeRemind : 10);
    setStudentName(getTrainingStudent()?.name || "");
  }, [open, storeDuration, storeRemind]);

  const effectiveDuration = useMemo(() => {
    if (custom) {
      const n = Number(custom);
      if (Number.isFinite(n) && n >= 1) return Math.min(180, Math.round(n));
    }
    return durationMin;
  }, [custom, durationMin]);

  const applyCustom = () => {
    const n = Number(custom);
    if (!Number.isFinite(n) || n < 1) return;
    setDurationMin(Math.min(180, Math.round(n)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>上课定时</DialogTitle>
          <DialogDescription>
            {isCoach
              ? studentName
                ? `当前学员：${studentName}（无排课练习时时长计入该学员）`
                : "请先在首页选择学员，再开始定时"
              : "选择课时长与中途提醒"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <p className="text-sm font-medium text-foreground mb-2">上课时间</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setDurationMin(m);
                    setCustom("");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                    durationMin === m && !custom
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {m} 分钟
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={1}
                max={180}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onBlur={applyCustom}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyCustom();
                }}
                placeholder="自定义分钟"
                className="w-28 h-9 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary"
              />
              <span className="text-xs text-muted-foreground">1–180 分钟</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">中途提醒</p>
            <div className="flex flex-wrap gap-2">
              {REMIND_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRemindEveryMin(m)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                    remindEveryMin === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  每 {m} 分
                </button>
              ))}
            </div>
          </div>

          {endsAt && (
            <p className="text-xs text-amber-700">
              当前计时进行中{billing?.studentName ? ` · ${billing.studentName}` : ""}，开始将重置
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {endsAt ? (
            <CloudButton
              type="button"
              variant="outline"
              onClick={() => {
                void (async () => {
                  await settleAndStop();
                  onOpenChange(false);
                  showToast.info("已结束上课定时");
                })();
              }}
            >
              结束定时
            </CloudButton>
          ) : (
            <CloudButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </CloudButton>
          )}
          <CloudButton
            type="button"
            variant="brand"
            loading={starting}
            onClick={() => {
              void (async () => {
                const mins = effectiveDuration;
                if (isCoach && !getTrainingStudent()?.id) {
                  showToast.warning("请先在首页选择学员");
                  return;
                }
                setStarting(true);
                try {
                  if (endsAt) await settleAndStop();

                  let billingLink = null;
                  if (isCoach) {
                    billingLink = await beginPracticeBilling(mins);
                    if (!billingLink) return;
                  }
                  start({
                    durationMin: mins,
                    wordCount,
                    remindEveryMin,
                    billing: billingLink,
                  });
                  onOpenChange(false);
                  showToast.success(`已开始 ${mins} 分钟定时，每 ${remindEveryMin} 分钟提醒`);
                } finally {
                  setStarting(false);
                }
              })();
            }}
          >
            开始定时
          </CloudButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 顶栏倒计时胶囊：点击打开设置（挂载时抑制全局浮动条） */
export function ClassTimerBadge({ onClick }: { onClick: () => void }) {
  const endsAt = useClassTimerStore((s) => s.endsAt);
  const [left, setLeft] = useState(() => useClassTimerStore.getState().remainingMs());

  useEffect(() => {
    document.documentElement.dataset[INLINE_FLAG] = "1";
    return () => {
      delete document.documentElement.dataset[INLINE_FLAG];
    };
  }, []);

  useEffect(() => {
    if (!endsAt) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(useClassTimerStore.getState().remainingMs());
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!endsAt) {
    return (
      <CloudButton
        type="button"
        variant="ghost"
        size="iconRound"
        onClick={onClick}
        aria-label="上课定时"
        className="text-foreground"
      >
        <Clock size={18} />
      </CloudButton>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="tabular-nums text-xs font-semibold px-2 py-1 rounded-full text-white shadow-sm bg-[#E53E3E]"
      aria-label="上课剩余时间"
    >
      {formatCountdown(left)}
    </button>
  );
}

/**
 * 全站上课定时：浮动倒计时（无顶栏入口的页面）+ 到点 / 中途提醒
 */
export function ClassSessionTimer() {
  const endsAt = useClassTimerStore((s) => s.endsAt);
  const markEndedNotified = useClassTimerStore((s) => s.markEndedNotified);
  const takeIntervalRemind = useClassTimerStore((s) => s.takeIntervalRemind);
  const wordCount = useClassTimerStore((s) => s.wordCount);
  const remindEveryMin = useClassTimerStore((s) => s.remindEveryMin);
  const billing = useClassTimerStore((s) => s.billing);
  const [left, setLeft] = useState(0);
  const [endOpen, setEndOpen] = useState(false);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [hideFloat, setHideFloat] = useState(false);

  useEffect(() => {
    const sync = () => setHideFloat(document.documentElement.dataset[INLINE_FLAG] === "1");
    sync();
    const id = window.setInterval(sync, 400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!endsAt) {
      setLeft(0);
      return;
    }
    const tick = () => {
      const state = useClassTimerStore.getState();
      const ms = state.remainingMs();
      setLeft(ms);

      if (ms > 0 && state.takeIntervalRemind()) {
        setIntervalOpen(true);
        playBeep(660, 0.18);
        showToast.info(
          `中途提醒：已过 ${state.remindEveryMin} 分钟，剩余 ${formatCountdown(ms)}`
        );
      }

      if (ms <= 0 && !state.endedNotified) {
        markEndedNotified();
        setEndOpen(true);
        setIntervalOpen(false);
        playBeep(880, 0.25);
        showToast.warning("上课时间到");
        void finishPracticeBilling(state.billing);
        // 保留 billing 直到用户关闭弹窗；结算已做完，避免重复结算
        useClassTimerStore.setState({ billing: state.billing ? { ...state.billing, owned: false } : null });
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [endsAt, markEndedNotified, takeIntervalRemind]);

  if (!endsAt && !endOpen && !intervalOpen) return null;

  return (
    <>
      {endsAt && left > 0 && !hideFloat && (
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-[90] flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#E53E3E] text-white text-xs font-semibold shadow-lg tabular-nums"
          >
            <Clock size={14} />
            {formatCountdown(left)}
          </button>
          <button
            type="button"
            aria-label="结束定时"
            onClick={() => void settleAndStop()}
            className="size-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/55"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <ClassTimerSetupDialog open={setupOpen} onOpenChange={setSetupOpen} wordCount={wordCount} />

      <Dialog open={intervalOpen} onOpenChange={setIntervalOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>中途提醒</DialogTitle>
            <DialogDescription>
              已过去约 {remindEveryMin} 分钟，剩余 {formatCountdown(left)}
              {billing?.studentName ? ` · ${billing.studentName}` : ""}
              {wordCount > 0 ? ` · 本节约 ${wordCount} 词` : ""}。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <CloudButton type="button" variant="brand" onClick={() => setIntervalOpen(false)}>
              继续上课
            </CloudButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={endOpen}
        onOpenChange={(o) => {
          setEndOpen(o);
          if (!o) useClassTimerStore.getState().stop();
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>上课时间到</DialogTitle>
            <DialogDescription>
              本节课定时已结束
              {billing?.studentName ? `，已计入「${billing.studentName}」` : ""}。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <CloudButton
              type="button"
              variant="outline"
              onClick={() => {
                setEndOpen(false);
                useClassTimerStore.getState().stop();
                setSetupOpen(true);
              }}
            >
              再设一段时间
            </CloudButton>
            <CloudButton
              type="button"
              variant="brand"
              onClick={() => {
                setEndOpen(false);
                useClassTimerStore.getState().stop();
              }}
            >
              知道了
            </CloudButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
