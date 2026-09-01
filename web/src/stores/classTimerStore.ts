import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ClassTimerState = {
  endsAt: number | null;
  startedAt: number | null;
  durationMin: number;
  wordCount: number;
  remindEveryMin: number;
  lastIntervalRemindAt: number | null;
  endedNotified: boolean;
  /** 暂停时冻结的剩余毫秒；非 null 表示计时已暂停 */
  pausedRemainingMs: number | null;
  start: (opts: {
    durationMin?: number;
    endsAt?: number;
    wordCount?: number;
    remindEveryMin?: number;
  }) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  isActive: () => boolean;
  markEndedNotified: () => void;
  takeIntervalRemind: () => boolean;
  remainingMs: () => number;
};

function clampDuration(mins: number) {
  return Math.max(1, Math.min(180, Math.round(mins)));
}

function clampRemind(mins: number) {
  if (!Number.isFinite(mins) || mins <= 0) return 0;
  return Math.min(60, Math.round(mins));
}

export const useClassTimerStore = create<ClassTimerState>()(
  persist(
    (set, get) => ({
      endsAt: null,
      startedAt: null,
      durationMin: 45,
      wordCount: 0,
      remindEveryMin: 0,
      lastIntervalRemindAt: null,
      endedNotified: false,
      pausedRemainingMs: null,

      start: ({ durationMin, endsAt: absEnds, wordCount = 0, remindEveryMin = 0 }) => {
        const now = Date.now();
        let ends: number;
        let mins: number;
        if (absEnds != null && absEnds > now) {
          ends = absEnds;
          mins = Math.max(1, Math.min(8 * 60, Math.round((absEnds - now) / 60_000)));
        } else {
          mins = clampDuration(durationMin ?? (get().durationMin || 45));
          ends = now + mins * 60_000;
        }
        set({
          endsAt: ends,
          startedAt: now,
          durationMin: mins,
          wordCount,
          remindEveryMin: clampRemind(remindEveryMin),
          lastIntervalRemindAt: now,
          endedNotified: false,
          pausedRemainingMs: null,
        });
      },

      stop: () => {
        set({
          endsAt: null,
          startedAt: null,
          endedNotified: false,
          wordCount: 0,
          lastIntervalRemindAt: null,
          pausedRemainingMs: null,
        });
      },

      pause: () => {
        const state = get();
        if (state.pausedRemainingMs != null) return;
        if (!state.endsAt) return;
        set({ pausedRemainingMs: state.remainingMs() });
      },

      resume: () => {
        const { pausedRemainingMs, endsAt, remindEveryMin, lastIntervalRemindAt } = get();
        if (pausedRemainingMs == null) return;
        const now = Date.now();
        const newEnds = now + pausedRemainingMs;
        let last = lastIntervalRemindAt;
        if (
          last != null &&
          endsAt != null &&
          remindEveryMin > 0 &&
          last >= endsAt - remindEveryMin * 60_000
        ) {
          last = newEnds - remindEveryMin * 60_000;
        }
        set({
          endsAt: newEnds,
          pausedRemainingMs: null,
          lastIntervalRemindAt: last,
        });
      },

      isPaused: () => get().pausedRemainingMs != null,

      isActive: () => {
        const { endsAt, pausedRemainingMs } = get();
        return endsAt != null || pausedRemainingMs != null;
      },

      markEndedNotified: () => set({ endedNotified: true }),

      takeIntervalRemind: () => {
        const { endsAt, startedAt, remindEveryMin, lastIntervalRemindAt, pausedRemainingMs } = get();
        if (!endsAt || !startedAt || remindEveryMin <= 0 || pausedRemainingMs != null) return false;
        const now = Date.now();
        if (now >= endsAt) return false;
        const windowMs = remindEveryMin * 60_000;
        const remaining = endsAt - now;
        if (remaining > windowMs) return false;
        if (lastIntervalRemindAt != null && lastIntervalRemindAt >= endsAt - windowMs) {
          return false;
        }
        set({ lastIntervalRemindAt: now });
        return true;
      },

      remainingMs: () => {
        const { endsAt, pausedRemainingMs } = get();
        if (pausedRemainingMs != null) return Math.max(0, pausedRemainingMs);
        if (!endsAt) return 0;
        return Math.max(0, endsAt - Date.now());
      },
    }),
    { name: "lb_class_timer" }
  )
);

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function secsPerWord(durationMin: number, wordCount: number): number | null {
  if (wordCount <= 0) return null;
  return Math.round((durationMin * 60) / wordCount);
}

export function endsAtFromHm(hm: string, from = Date.now()): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(h, min, 0, 0);
  let ts = d.getTime();
  if (ts <= from + 30_000) ts += 24 * 60 * 60_000;
  return ts;
}

export function formatHm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
