/** Format coaching minutes for display — always minutes, never decimal hours. */
export function formatTeachingMinutes(mins: number): string {
  if (!Number.isFinite(mins)) return "—";
  const n = Math.max(0, Math.round(mins));
  return `${n} 分钟`;
}
