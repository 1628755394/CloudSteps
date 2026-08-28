/** Cue for the next word in the guided sequence (not the current one). */
export function SequenceNextMark({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1.5 top-0 z-10 h-full w-1 rounded-full bg-primary"
    />
  );
}
