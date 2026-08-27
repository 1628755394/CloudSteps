/** 老师新手引导 — 请与 miniapp/src/utils/coachOnboarding.ts 保持步骤与 key 同步 */

export type CoachOnboardingIcon =
  | "welcome"
  | "students"
  | "picker"
  | "schedule"
  | "training";

export type CoachOnboardingStep = {
  id: string;
  title: string;
  body: string;
  icon: CoachOnboardingIcon;
  /** data-coach 锚点；缺省则居中卡片（欢迎步） */
  target?: string;
};

/** 与小程序端文案保持一致 */
export const COACH_ONBOARDING_STEPS: CoachOnboardingStep[] = [
  {
    id: "welcome",
    title: "欢迎来到云阶",
    body: "注册后你已是陪练老师。先添加学员，再开始测评与单词训练。",
    icon: "welcome",
  },
  {
    id: "students",
    title: "先添加学员",
    body: "点这里进入「学员管理」，新建或关联学员。没有学员时无法开始单词训练。",
    icon: "students",
    target: "students",
  },
  {
    id: "picker",
    title: "选择当前学员",
    body: "在这里切换当前学员，词汇测试与单词训练都会绑定到所选学员。",
    icon: "picker",
    target: "picker",
  },
  {
    id: "schedule",
    title: "备课与排课",
    body: "进入「备课」课表后，点击空格子即可排课；点已有课程可开始或下课。",
    icon: "schedule",
    target: "schedule",
  },
  {
    id: "training",
    title: "开始单词训练",
    body: "选好学员后点这里：选词库 → 记忆灯塔 →「继续练习」。",
    icon: "training",
    target: "training",
  },
];

const DONE_VALUE = "done";

export function coachOnboardingStorageKey(userId: number | string): string {
  return `cs_coach_onboarding_v1:${userId}`;
}

export function isCoachOnboardingDone(userId: number | string): boolean {
  try {
    return localStorage.getItem(coachOnboardingStorageKey(userId)) === DONE_VALUE;
  } catch {
    return false;
  }
}

export function markCoachOnboardingDone(userId: number | string): void {
  try {
    localStorage.setItem(coachOnboardingStorageKey(userId), DONE_VALUE);
  } catch {
    // ignore quota / private mode
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
