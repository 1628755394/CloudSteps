export function buildWordPracticeSequence(wordCount: number): number[] {
  if (wordCount <= 0) return [];
  if (wordCount === 1) return [0];
  const sequence: number[] = [];
  for (let end = 1; end < wordCount; end++) {
    for (let i = 0; i <= end; i++) sequence.push(i);
    for (let i = end - 1; i >= 1; i--) sequence.push(i);
  }
  return sequence;
}
