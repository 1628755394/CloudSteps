/** 老师新手引导 — 请与 miniapp/src/utils/coachOnboarding.ts 保持步骤与 key 同步 */

export type CoachOnboardingIcon =
  | "welcome"
  | "students"
  | "picker"
  | "schedule"
  | "training";

export type CoachOnboardingStep = {
  id: string;
  icon: CoachOnboardingIcon;
  /** data-coach 锚点；缺省则居中卡片（欢迎步） */
  target?: string;
};

/** Step copy lives in i18n: coaching.onboarding.{id}.title / .body */
export const COACH_ONBOARDING_STEPS: CoachOnboardingStep[] = [
  {
    id: "welcome",
    icon: "welcome",
  },
  {
    id: "students",
    icon: "students",
    target: "students",
  },
  {
    id: "picker",
    icon: "picker",
    target: "picker",
  },
  {
    id: "schedule",
    icon: "schedule",
    target: "schedule",
  },
  {
    id: "training",
    icon: "training",
    target: "training",
  },
];

const DONE_VALUE = "done";

function normalizeUserId(userId: number | string | null | undefined): string | null {
  if (userId == null || userId === "") return null;
  const id = String(userId).trim();
  if (!id || id === "0" || id === "NaN") return null;
  return id;
}

export function coachOnboardingStorageKey(userId: number | string): string {
  return `cs_coach_onboarding_v1:${normalizeUserId(userId) ?? userId}`;
}

export function isCoachOnboardingDone(userId: number | string): boolean {
  const id = normalizeUserId(userId);
  if (!id) return false;
  try {
    return localStorage.getItem(coachOnboardingStorageKey(id)) === DONE_VALUE;
  } catch {
    return false;
  }
}

export function markCoachOnboardingDone(userId: number | string): void {
  const id = normalizeUserId(userId);
  if (!id) return;
  try {
    localStorage.setItem(coachOnboardingStorageKey(id), DONE_VALUE);
  } catch {
    // ignore quota / private mode
  }
}

/** 备课页「点天排课」单次提示 */
export function timetableCellTipStorageKey(userId: number | string): string {
  return `cs_timetable_cell_tip_v1:${normalizeUserId(userId) ?? userId}`;
}

export function isTimetableCellTipDone(userId: number | string): boolean {
  const id = normalizeUserId(userId);
  if (!id) return false;
  try {
    return localStorage.getItem(timetableCellTipStorageKey(id)) === DONE_VALUE;
  } catch {
    return false;
  }
}

export function markTimetableCellTipDone(userId: number | string): void {
  const id = normalizeUserId(userId);
  if (!id) return;
  try {
    localStorage.setItem(timetableCellTipStorageKey(id), DONE_VALUE);
  } catch {
    // ignore
  }
}

export function isCoachRole(role?: string | null): boolean {
  return role === "user" || role === "teacher" || role === "admin";
}

export function shouldShowCoachOnboarding(
  role: string | null | undefined,
  userId: number | string | null | undefined,
): boolean {
  if (!userId || !isCoachRole(role)) return false;
  return !isCoachOnboardingDone(userId);
}

/** 新手引导 UI 是否正在展示（与 localStorage「已看过」分开：打开时会立刻 mark done，但仍需挡住公告）。 */
const COACH_ONBOARDING_UI_EVENT = "cs:coach-onboarding-ui";

let coachOnboardingUiActive = false;

export function isCoachOnboardingUiActive(): boolean {
  return coachOnboardingUiActive;
}

export function setCoachOnboardingUiActive(active: boolean): void {
  if (coachOnboardingUiActive === active) return;
  coachOnboardingUiActive = active;
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(COACH_ONBOARDING_UI_EVENT, { detail: { active } }),
  );
}

export function subscribeCoachOnboardingUi(
  listener: (active: boolean) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ active?: boolean }>).detail;
    listener(Boolean(detail?.active));
  };
  window.addEventListener(COACH_ONBOARDING_UI_EVENT, handler);
  return () => window.removeEventListener(COACH_ONBOARDING_UI_EVENT, handler);
}

/** 系统公告等全局弹层应让路：尚需引导，或引导蒙层仍在展示。 */
export function shouldDeferSystemPopups(
  role: string | null | undefined,
  userId: number | string | null | undefined,
): boolean {
  if (isCoachOnboardingUiActive()) return true;
  return shouldShowCoachOnboarding(role, userId);
}

export type CoachTargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/** 查找可见的 data-coach 锚点；多处同名时取第一个有尺寸的 */
export function measureCoachTarget(target: string): CoachTargetRect | null {
  const nodes = document.querySelectorAll(`[data-coach="${target}"]`);
  for (const node of Array.from(nodes)) {
    const el = node as HTMLElement;
    const r = el.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) {
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
  }
  return null;
}

export function scrollCoachTargetIntoView(target: string): void {
  const nodes = document.querySelectorAll(`[data-coach="${target}"]`);
  for (const node of Array.from(nodes)) {
    const el = node as HTMLElement;
    const r = el.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      return;
    }
  }
}
