import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, Flame, Loader2 } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { getCheckInStatus, postCheckIn, type CheckInStatus } from "../api/checkin";
import { formatTeachingMinutes } from "../utils/formatMinutes";
import { showToast } from "../utils/toast";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const FALLBACK_TIERS = [
  { days: 1, minutes: 60 },
  { days: 3, minutes: 70 },
  { days: 5, minutes: 90 },
  { days: 7, minutes: 110 },
  { days: 14, minutes: 180 },
  { days: 30, minutes: 180 },
];

export default function CheckIn() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCheckInStatus();
      if (res.code === 200 && res.data) {
        setStatus(res.data);
      } else {
        showToast.error(res.msg || "加载失败");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载失败";
      showToast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monthCells = useMemo(() => {
    if (!status?.monthMask?.length) return [];
    const pad = status.monthStartWeekday ?? 0;
    const todayDay = new Date().getDate();
    const cells: Array<{ day: number | null; checked: boolean; isToday: boolean }> = [];
    for (let i = 0; i < pad; i++) cells.push({ day: null, checked: false, isToday: false });
    status.monthMask.forEach((checked, i) => {
      const day = i + 1;
      cells.push({ day, checked, isToday: day === todayDay });
    });
    return cells;
  }, [status]);

  const tiers = status?.rewardPreview?.length ? status.rewardPreview : FALLBACK_TIERS;
  const streak = status?.currentStreak ?? 0;

  const onCheckIn = async () => {
    if (submitting || status?.checkedInToday) return;
    setSubmitting(true);
    try {
      const res = await postCheckIn();
      if (res.code !== 200 || !res.data) {
        showToast.error(res.msg || "签到失败");
        return;
      }
      const data = res.data;
      if (data.alreadyCheckedIn) {
        showToast.info("今日已签到");
      } else {
        const bonus =
          data.bonusMinutes > 0 ? `（含连续 +${data.bonusMinutes}）` : "";
        showToast.success(`签到成功，+${data.grantedMinutes} 分钟${bonus}`);
      }
      await load();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "签到失败";
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2.5 overflow-y-auto pb-3">
      <div className="flex items-center gap-1.5 shrink-0 -ml-1">
        <CloudButton
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => navigate("/coach-center")}
          aria-label="返回陪练中心"
        >
          <ChevronLeft size={18} />
        </CloudButton>
        <h1 className="text-sm font-semibold text-foreground tracking-tight">每日签到</h1>
      </div>

      {loading && !status ? (
        <CloudCard className="p-8 flex justify-center">
          <Loader2 className="size-5 animate-spin text-primary" />
        </CloudCard>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-transparent px-3.5 py-3.5">
            <div className="pointer-events-none absolute -right-10 -top-12 size-28 rounded-full bg-primary/10 blur-2xl" />

            <div className="relative flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  授课额度
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground tracking-tight leading-none">
                  {formatTeachingMinutes(status?.poolRemainingMinutes ?? 0)}
                </p>
                <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug">
                  {status?.checkedInToday
                    ? `今日已领 ${status.dailyReward} 分钟`
                    : `今日可领 ${status?.dailyReward ?? 60} 分钟`}
                </p>
              </div>

              <CloudButton
                type="button"
                variant="brand"
                size="sm"
                className="relative shrink-0 h-9 px-4 text-xs font-semibold shadow-sm"
                disabled={submitting || !!status?.checkedInToday}
                onClick={() => void onCheckIn()}
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                {status?.checkedInToday
                  ? "已签到"
                  : `签到 +${status?.dailyReward ?? 60}`}
              </CloudButton>
            </div>

            <div className="relative mt-3 grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-background/60 border border-border/50 px-2.5 py-2">
                <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  <Flame size={10} className="text-orange-500" />
                  连续
                </div>
                <p className="mt-0.5 text-sm font-semibold tabular-nums leading-none">
                  {status?.currentStreak ?? 0}
                  <span className="text-[10px] font-normal text-muted-foreground ml-0.5">天</span>
                </p>
              </div>
              <div className="rounded-lg bg-background/60 border border-border/50 px-2.5 py-2">
                <div className="text-[9px] text-muted-foreground">最长</div>
                <p className="mt-0.5 text-sm font-semibold tabular-nums leading-none">
                  {status?.longestStreak ?? 0}
                  <span className="text-[10px] font-normal text-muted-foreground ml-0.5">天</span>
                </p>
              </div>
              <div className="rounded-lg bg-background/60 border border-border/50 px-2.5 py-2">
                <div className="text-[9px] text-muted-foreground">本年</div>
                <p className="mt-0.5 text-sm font-semibold tabular-nums leading-none">
                  {status?.yearCheckIns ?? 0}
                  <span className="text-[10px] font-normal text-muted-foreground ml-0.5">天</span>
                </p>
              </div>
            </div>
          </section>

          <CloudCard className="px-3 py-3">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h2 className="text-xs font-semibold text-foreground">连续奖励</h2>
              <p className="text-[9px] text-muted-foreground truncate">
                第 3 天起每日 +10，上限 180
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tiers.map((tier) => {
                const done = streak >= tier.days;
                const next =
                  status?.nextStreakBonusDays === tier.days && !status?.checkedInToday;
                return (
                  <span
                    key={tier.days}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] tabular-nums transition-colors ${
                      done
                        ? "border-primary/25 bg-primary/8 text-primary"
                        : next
                          ? "border-primary bg-primary/12 text-primary font-medium"
                          : "border-border/80 bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <span className="opacity-70">{tier.days}天</span>
                    <span className="font-semibold">{tier.minutes}′</span>
                  </span>
                );
              })}
            </div>
          </CloudCard>

          <CloudCard className="px-3 py-3">
            <h2 className="text-xs font-semibold text-foreground mb-2">本月</h2>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] text-muted-soft mb-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-0.5">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {monthCells.map((cell, i) =>
                cell.day == null ? (
                  <div key={`e-${i}`} className="aspect-square" />
                ) : (
                  <div
                    key={cell.day}
                    className={`aspect-square rounded-md flex items-center justify-center text-[10px] tabular-nums ${
                      cell.checked
                        ? "bg-primary text-primary-foreground font-semibold"
                        : cell.isToday
                          ? "bg-primary/10 text-primary font-medium ring-1 ring-inset ring-primary/30"
                          : "text-muted-foreground"
                    }`}
                  >
                    {cell.day}
                  </div>
                ),
              )}
            </div>
          </CloudCard>
        </>
      )}
    </div>
  );
}
