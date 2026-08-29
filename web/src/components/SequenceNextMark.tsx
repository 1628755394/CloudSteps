/** Cue for the next word in the guided sequence (not the current one). */
export function SequenceNextMark({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1.5 top-1/2 z-10 h-9 w-1 -translate-y-1/2 rounded-full bg-primary"
    />
  );
}
