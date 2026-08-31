import { describe, expect, it } from "vitest";
import { buildWordPracticeSequence } from "./wordPracticeSequence";
import { getPracticeTapState } from "./wordPracticeTap";

describe("buildWordPracticeSequence", () => {
  it("builds the five-word practice order", () => {
    expect(buildWordPracticeSequence(5)).toEqual([
      0, 1, 0, 1, 2, 1, 0, 1, 2, 3, 2,
      1, 0, 1, 2, 3, 4, 3, 2, 1, 0,
    ]);
  });

  it("handles empty and partial batches", () => {
    expect(buildWordPracticeSequence(0)).toEqual([]);
    expect(buildWordPracticeSequence(1)).toEqual([0]);
    expect(buildWordPracticeSequence(2)).toEqual([0, 1, 0]);
  });

  it("starts over after switching words and reveals on a continuation tap", () => {
    const firstTap = getPracticeTapState(0, null, { heard: true, showTranslation: false });
    expect(firstTap.shouldPlay).toBe(true);
    expect(firstTap.showTranslation).toBe(false);

    const switchedBackTap = getPracticeTapState(0, 1, { heard: true, showTranslation: false });
    expect(switchedBackTap.shouldPlay).toBe(true);
    expect(switchedBackTap.showTranslation).toBe(false);

    const secondTap = getPracticeTapState(0, 0, { heard: true, showTranslation: false });
    expect(secondTap.shouldPlay).toBe(false);
    expect(secondTap.showTranslation).toBe(true);
  });
});
