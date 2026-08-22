const IPA_DIGRAPHS = [
  "aɪə",
  "aʊə",
  "əʊ",
  "aɪ",
  "aʊ",
  "eɪ",
  "ɔɪ",
  "ɪə",
  "eə",
  "ʊə",
  "tʃ",
  "dʒ",
  "ɜː",
  "ɑː",
  "ɔː",
  "iː",
  "uː",
  "eː",
  "oː",
  "æ",
  "θ",
  "ð",
  "ʃ",
  "ʒ",
  "ŋ",
  "ɡ",
];

/** 辅音/辅音连缀（拆分展示时把 st、tr 等合为一块，贴近参考 App） */
const IPA_CONSONANTS = new Set([
  "p",
  "b",
  "t",
  "d",
  "k",
  "ɡ",
  "g",
  "m",
  "n",
  "ŋ",
  "f",
  "v",
  "θ",
  "ð",
  "s",
  "z",
  "ʃ",
  "ʒ",
  "h",
  "l",
  "r",
  "w",
  "j",
  "tʃ",
  "dʒ",
]);

const IPA_CLUSTERS = [
  "str",
  "spr",
  "skr",
  "spl",
  "θr",
  "ʃr",
  "st",
  "sp",
  "sk",
  "sm",
  "sn",
  "sw",
  "sl",
  "tr",
  "dr",
  "cr",
  "br",
  "fr",
  "gr",
  "pr",
  "pl",
  "bl",
  "cl",
  "fl",
  "gl",
  "tw",
  "kw",
];

function tokenizeIpaPhonemes(raw: string): string[] {
  let s = raw.trim().replace(/^[\/\[\]]+|[\/\[\]]+$/g, "");
  s = s.replace(/[ˈˌ.()]/g, "");
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) {
      i += 1;
      continue;
    }
    let matched = false;
    for (const d of IPA_DIGRAPHS) {
      if (s.slice(i, i + d.length) === d) {
        out.push(d);
        i += d.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (s[i] === "ː" && out.length > 0) {
      out[out.length - 1] += "ː";
      i += 1;
      continue;
    }
    out.push(s[i]);
    i += 1;
  }
  return out.filter(Boolean);
}

/** 把相邻辅音合并成常见连缀（如 s+t → st） */
function mergeIpaClusters(phonemes: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < phonemes.length) {
    if (!IPA_CONSONANTS.has(phonemes[i])) {
      out.push(phonemes[i]);
      i += 1;
      continue;
    }
    let merged = false;
    for (const c of IPA_CLUSTERS) {
      // 用当前起的音素拼接能否凑出连缀
      let acc = "";
      let j = i;
      while (j < phonemes.length && acc.length < c.length) {
        acc += phonemes[j];
        j += 1;
        if (acc === c) {
          out.push(c);
          i = j;
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
    if (!merged) {
      out.push(phonemes[i]);
      i += 1;
    }
  }
  return out;
}

/** 把 IPA 拆成音标块，用于「拆分」展示（始终是音标，不是单词拼写） */
export function splitIpaParts(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return mergeIpaClusters(tokenizeIpaPhonemes(raw));
}

export type PhonicsParts = {
  kind: "ipa";
  parts: string[];
};

/** 拆分只使用音标；无音标则无法拆分 */
export function getPhonicsParts(opts: {
  syllables?: string | null;
  phonetic?: string | null;
}): PhonicsParts | null {
  void opts.syllables;
  const ipa = splitIpaParts(opts.phonetic);
  if (ipa.length >= 1) return { kind: "ipa", parts: ipa };
  return null;
}
