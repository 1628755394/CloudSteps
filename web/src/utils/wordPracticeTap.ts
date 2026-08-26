import { nextWordTapState } from "./wordReveal";

export function getPracticeTapState(
  index: number,
  lastTappedIndex: number | null,
  state: { heard: boolean; showTranslation: boolean },
) {
  const isContinuation = lastTappedIndex === index;
  return nextWordTapState({
    heard: isContinuation ? state.heard : false,
    showTranslation: isContinuation ? state.showTranslation : false,
  });
}
