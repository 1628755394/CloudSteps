import i18n from "../i18n";

/** Format coaching minutes for display — always minutes, never decimal hours. */
export function formatTeachingMinutes(mins: number): string {
  if (!Number.isFinite(mins)) return "—";
  const n = Math.max(0, Math.round(mins));
  return i18n.t("ui.minutes", { count: n });
}

/** Format student quota minutes as 课时 (1 课时 = 60 分钟). */
export function formatLessons(mins: number): string {
  if (!Number.isFinite(mins)) return "—";
  const lessons = Math.max(0, Math.round(mins)) / 60;
  const n = Math.round(lessons * 10) / 10;
  return i18n.t("ui.lessons", { count: n });
}

/** Convert 课时 input to minutes for API. */
export function lessonsToMinutes(lessons: number): number {
  return Math.round(lessons * 60);
}

/** Convert minutes to 课时 for display in input fields. */
export function minutesToLessons(mins: number): number {
  return Math.round((mins / 60) * 10) / 10;
}
