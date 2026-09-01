const VOWEL_RE = /[aeiouy]+/gi;

function vowelGroups(word: string): Array<{ text: string; start: number; end: number }> {
  const groups: Array<{ text: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = VOWEL_RE.exec(word)) !== null) {
    groups.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return groups;
}

function autoSplitWord(word: string): string[] {
  const trimmed = word.trim().toLowerCase();
  if (trimmed.length < 2) return [trimmed];

  const groups = vowelGroups(trimmed);
  if (groups.length <= 1) return [trimmed];

  const parts: string[] = [];
  let start = 0;

  for (let i = 0; i < groups.length - 1; i++) {
    const current = groups[i];
    const next = groups[i + 1];
    const between = next.start - current.end;

    // 把最后一个辅音（若存在）作为下一个音节的 onset，其余辅音作为当前音节 coda
    const splitOffset = between >= 1 ? between - 1 : 0;
    const splitAt = current.end + splitOffset;

    parts.push(trimmed.slice(start, splitAt));
    start = splitAt;
  }

  parts.push(trimmed.slice(start));

  return parts.length > 1 ? parts : [trimmed];
}

export function splitSyllableParts(opts: {
  syllables?: string | null;
  word?: string | null;
}): string[] | null {
  if (opts.syllables?.trim()) {
    const parts = opts.syllables
      .split("-")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
  }

  if (opts.word?.trim()) {
    const parts = autoSplitWord(opts.word);
    if (parts.length > 1) return parts;
  }

  return null;
}
