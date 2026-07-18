/** 解析排课日期 + HH:MM 为本地 Date */
export function parseCoachingSlotEnd(scheduledDate: string, endTime: string): Date | null {
  const datePart = scheduledDate.slice(0, 10);
  const m = /^(\d{1,2}):(\d{2})$/.exec(endTime.trim());
  if (!m) return null;
  const [y, mo, d] = datePart.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, Number(m[1]), Number(m[2]), 0, 0);
}

export function parseCoachingSlotStart(scheduledDate: string, startTime: string): Date | null {
  const datePart = scheduledDate.slice(0, 10);
  const m = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
  if (!m) return null;
  const [y, mo, d] = datePart.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, Number(m[1]), Number(m[2]), 0, 0);
}

/** 是否处于可开始上课时段 [start, end) */
export function isWithinCoachingStartWindow(
  scheduledDate: string,
  startTime: string,
  endTime: string,
  now = Date.now()
): boolean {
  const start = parseCoachingSlotStart(scheduledDate, startTime);
  const end = parseCoachingSlotEnd(scheduledDate, endTime);
  if (!start || !end) return false;
  return now >= start.getTime() && now < end.getTime();
}

export function minutesUntilCoachingEnd(
  scheduledDate: string,
  endTime: string,
  now = Date.now()
): number | null {
  const end = parseCoachingSlotEnd(scheduledDate, endTime);
  if (!end) return null;
  return Math.floor((end.getTime() - now) / 60_000);
}
