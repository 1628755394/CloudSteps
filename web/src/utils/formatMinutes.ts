/** Format coaching minutes for display (e.g. 90 → "1 小时 30 分"). */
export function formatTeachingMinutes(mins: number): string {
  if (!Number.isFinite(mins)) return "—";
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
  }
  return `${mins} 分钟`;
}
