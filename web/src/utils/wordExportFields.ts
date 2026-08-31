import type { WordDetail } from "../api/wordbooks";
import i18n from "../i18n";
import { formatTranslation } from "./wordFormat";

export type WordExportFieldKey =
  | "phonetic"
  | "translation"
  | "definition"
  | "examples"
  | "mnemonic"
  | "phrases"
  | "morphology"
  | "synonyms"
  | "etymology";

const WORD_EXPORT_FIELD_LABEL_KEYS: Record<WordExportFieldKey, string> = {
  phonetic: "word.field.phonetic",
  translation: "word.tab.translation",
  definition: "word.tab.definition",
  examples: "word.tab.examples",
  mnemonic: "word.tab.mnemonic",
  phrases: "word.tab.phrases",
  morphology: "word.tab.morphology",
  synonyms: "word.tab.synonyms",
  etymology: "word.tab.etymology",
};

const WORD_EXPORT_BASIC_FIELD_KEYS: WordExportFieldKey[] = [
  "phonetic",
  "translation",
  "examples",
  "mnemonic",
];

function mapExportFields(keys: WordExportFieldKey[]) {
  return keys.map((key) => ({
    key,
    label: i18n.t(WORD_EXPORT_FIELD_LABEL_KEYS[key]),
  }));
}

export function getWordExportFieldOptions(): Array<{ key: WordExportFieldKey; label: string }> {
  return mapExportFields(Object.keys(WORD_EXPORT_FIELD_LABEL_KEYS) as WordExportFieldKey[]);
}

/** @deprecated Use getWordExportFieldOptions() for locale-aware labels */
export const WORD_EXPORT_FIELD_OPTIONS = getWordExportFieldOptions();

/** 学习记录导出：只保留基础字段 */
export function getWordExportBasicFields(): Array<{ key: WordExportFieldKey; label: string }> {
  return mapExportFields(WORD_EXPORT_BASIC_FIELD_KEYS);
}

/** @deprecated Use getWordExportBasicFields() for locale-aware labels */
export const WORD_EXPORT_BASIC_FIELDS = getWordExportBasicFields();

function parseJSON<T>(raw?: string | null): T | null {
  if (!raw || raw === "[]" || raw === "") return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) && v.length === 0 ? null : v;
  } catch {
    return null;
  }
}

function stripTags(s: string): string {
  return s.replace(/<\/?b>/gi, "").replace(/<\/?i>/gi, "");
}

export function pickPhonetic(w: {
  phonetic?: string;
  phoneticUk?: string;
  phoneticUs?: string;
}): string {
  const p = w.phoneticUk || w.phoneticUs || w.phonetic || "";
  const inner = p
    .trim()
    .replace(/^[\[\/]+/, "")
    .replace(/[\]\/]+$/, "")
    .trim();
  return inner ? `/${inner}/` : "";
}

/** 从详情中取某一拓展字段的纯文本 */
export function formatWordExportField(detail: WordDetail | null | undefined, key: WordExportFieldKey): string {
  if (!detail) return "";
  switch (key) {
    case "phonetic":
      return pickPhonetic(detail);
    case "translation": {
      const pos = detail.partOfSpeech ? `${detail.partOfSpeech}. ` : "";
      return `${pos}${formatTranslation(detail.translation) || ""}`.trim();
    }
    case "definition":
      return (detail.definition || "").trim();
    case "examples": {
      const list = parseJSON<Array<{ en: string; cn: string }>>(detail.exampleSentences);
      if (!list?.length) return "";
      return list
        .slice(0, 5)
        .map((ex) => `${stripTags(ex.en)}${ex.cn ? `（${ex.cn}）` : ""}`)
        .join("\n");
    }
    case "mnemonic":
      return (detail.mnemonic || "").trim();
    case "phrases": {
      const list = parseJSON<Array<{ phrase: string; meanings: string[] }>>(detail.collocations);
      if (!list?.length) return "";
      return list.map((p) => `${p.phrase} ${(p.meanings || []).join("；")}`).join("；");
    }
    case "morphology": {
      const m = parseJSON<{ forms?: string[] }>(detail.morphology);
      return (m?.forms || []).join(" / ");
    }
    case "synonyms": {
      const list = parseJSON<Array<{ word: string; trans?: string }>>(detail.synonyms);
      if (!list?.length) return "";
      return list.map((s) => (s.trans ? `${s.word}(${s.trans})` : s.word)).join("；");
    }
    case "etymology":
      return (detail.etymology || "").trim();
    default:
      return "";
  }
}

export function needsWordDetail(fields: WordExportFieldKey[]): boolean {
  return fields.some((f) => f !== "phonetic" && f !== "translation");
}
