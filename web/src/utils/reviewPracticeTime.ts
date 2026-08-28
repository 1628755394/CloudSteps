function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatClock(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 抗遗忘列表：识记练习时段，如 2026/08/28 10:00-11:00 */
export function formatPracticeTimeRange(
  startedAt?: string | null,
  endedAt?: string | null,
  timeZone?: string
): string {
  if (!startedAt) return "";
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return "";

  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  const dateFmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dateFmt.formatToParts(start);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const dateLabel = `${y}/${m}/${day}`;

  const timeFmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const startClock = timeFmt.format(start);

  if (endedAt) {
    const end = new Date(endedAt);
    if (!Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
      const endClock = timeFmt.format(end);
      return `${dateLabel}  ${startClock}-${endClock}`;
    }
  }

  return `${dateLabel}  ${startClock}`;
}
