export function buildWordPracticeSequence(wordCount: number): number[] {
  if (wordCount <= 0) return [];
  const sequence = [0];
  for (let end = 1; end < wordCount; end++) {
    const start = end === 2 ? 0 : 1;
    for (let index = start; index <= end; index++) sequence.push(index);
    for (let index = end - 1; index >= 0; index--) sequence.push(index);
  }
  return sequence;
}
