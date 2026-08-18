import { useEffect, useMemo, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { CloudButton } from "./cloudsteps";
import { getWordDetail, type WordDetail } from "../api/wordbooks";
import { formatTranslation, formatTranslationShort, withPartOfSpeech } from "../utils/wordFormat";
import { playWordAudio } from "../utils/audioPlayer";
import { PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "./PracticeFontSettings";
import { readStudyNote } from "./StudyNotePanel";

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

type ExtKey =
  | "notes"
  | "translation"
  | "examples"
  | "mnemonic"
  | "phrases"
  | "morphology"
  | "image"
  | "derivations"
  | "synonyms"
  | "antonyms"
  | "etymology"
  | "collins"
  | "definition"
  | "family";

/** 简易模式下保留的标签（约一半） */
const SIMPLE_KEYS = new Set<ExtKey>([
  "notes",
  "translation",
  "examples",
  "mnemonic",
  "phrases",
  "morphology",
  "image",
]);

type ParsedDetail = {
  examples: Array<{ en: string; cn: string }> | null;
  phrases: Array<{ phrase: string; meanings: string[] }> | null;
  derivations: Array<{ word: string; meanings: Array<{ pos: string; meaning: string }> }> | null;
  synonyms: Array<{ pos: string; trans: string; word: string }> | null;
  antonyms: Array<{ pos?: string; word: string; trans?: string }> | null;
  wordFamily: Array<{ pos: string; word: string; meaning: string }> | null;
  morphology: { forms?: string[]; inflections?: string[] } | null;
  collins: Array<{
    def: string;
    posp: string;
    tran: string;
    example?: Array<{ ex: string; tran: string }>;
  }> | null;
};

type ExtTab = { key: ExtKey; label: string };

type Props = {
  wordId: number;
  wordText?: string;
  onClose?: () => void;
  /** tags：仅标签；inline：音标+释义+标签（词下展开）；full：含词头卡片 */
  variant?: "full" | "tags" | "inline";
  /** 简易：只展示部分拓展标签；默认 true */
  simpleMode?: boolean;
};

/**
 * 页内单词拓展：标签切换查看，非模态框。
 */
export function WordDetailPanel({
  wordId,
  wordText,
  variant = "full",
  simpleMode = true,
}: Props) {
  const [detail, setDetail] = useState<WordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [active, setActive] = useState<ExtKey | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setDetail(null);
    setError(false);
    setActive(null);
    getWordDetail(wordId)
      .then((res) => {
        if (!mounted) return;
        if (res.data) {
          setDetail(res.data);
          // 默认展开"释义"标签
          if (res.data.translation?.trim()) setActive("translation");
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [wordId]);

  // 切回简易时，若当前标签被隐藏则收起
  useEffect(() => {
    if (!simpleMode || !active) return;
    if (!SIMPLE_KEYS.has(active)) setActive(null);
  }, [simpleMode, active]);

  const parsed: ParsedDetail | null = useMemo(() => {
    if (!detail) return null;
    return {
      examples: parseJSON(detail.exampleSentences),
      phrases: parseJSON(detail.collocations),
      derivations: parseJSON(detail.derivations),
      synonyms: parseJSON(detail.synonyms),
      antonyms: parseJSON(detail.antonyms),
      wordFamily: parseJSON(detail.wordFamily),
      morphology: parseJSON(detail.morphology),
      collins: parseJSON(detail.usageNotes),
    };
  }, [detail]);

  const word = detail?.word || wordText || "";
  const noteText = readStudyNote(`study-note:word:${wordId}`);
  const tabs: ExtTab[] = useMemo(() => {
    if (!detail || !parsed) return [];
    const list: ExtTab[] = [];
    if (noteText.trim()) list.push({ key: "notes", label: "笔记" });
    if (detail.translation?.trim()) list.push({ key: "translation", label: "释义" });
    if (parsed.examples?.length) list.push({ key: "examples", label: "例句" });
    if (detail.mnemonic?.trim()) list.push({ key: "mnemonic", label: "助记" });
    if (parsed.phrases?.length) list.push({ key: "phrases", label: "词组" });
    if (parsed.morphology?.forms?.length) list.push({ key: "morphology", label: "变形" });
    if (detail.imageUrl?.trim()) list.push({ key: "image", label: "图片" });
    if (parsed.derivations?.length) list.push({ key: "derivations", label: "派生词" });
    if (parsed.synonyms?.length) list.push({ key: "synonyms", label: "同义词" });
    if (parsed.antonyms?.length) list.push({ key: "antonyms", label: "反义词" });
    if (detail.etymology?.trim()) list.push({ key: "etymology", label: "词源" });
    if (parsed.collins?.length) list.push({ key: "collins", label: "柯林斯" });
    if (detail.definition?.trim()) list.push({ key: "definition", label: "英译" });
    if (parsed.wordFamily?.length) list.push({ key: "family", label: "词族" });
    if (!simpleMode) return list;
    return list.filter((t) => SIMPLE_KEYS.has(t.key));
  }, [detail, parsed, simpleMode, noteText]);

  const phonetic = detail?.phoneticUk || detail?.phoneticUs || detail?.phonetic || "";
  const shortMeaning = detail
    ? withPartOfSpeech(detail.partOfSpeech, formatTranslationShort(detail.translation))
    : "";
  const fullMeaning = detail
    ? withPartOfSpeech(detail.partOfSpeech, formatTranslation(detail.translation))
    : "";
  const showFullInline = active === "translation";

  const tagsBlock = (
    <>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-[#4ECDC4]" />
        </div>
      ) : error ? (
        <p className="px-3 pb-4 text-center text-sm text-muted-foreground">加载失败，请稍后重试</p>
      ) : !detail || !parsed ? (
        <p className="px-3 pb-4 text-center text-sm text-muted-foreground">暂无数据</p>
      ) : (
        <>
          <div className="flex items-start gap-2 px-1 pb-1">
            {tabs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActive(t.key === active ? null : t.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      active === t.key
                        ? "bg-[#4ECDC4] text-white font-medium"
                        : "bg-[#F1F5F9] text-[#2D3748] hover:bg-[#E2E8F0]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground flex-1">该单词暂无拓展内容</p>
            )}
          </div>

          {active && active !== "translation" && (
            <div className="pt-2 border-t border-[#F1F5F9] max-h-[36vh] overflow-y-auto">
              {active === "notes" ? <p className="whitespace-pre-wrap px-1 text-sm leading-relaxed">{noteText}</p> : <ExtContent active={active} detail={detail} parsed={parsed} />}
            </div>
          )}
          {active === "translation" && (
            <div className="pt-2 border-t border-[#F1F5F9] max-h-[36vh] overflow-y-auto">
              <p className={`${PRACTICE_TRANS_CLASS} leading-relaxed`}>{fullMeaning}</p>
            </div>
          )}
        </>
      )}
    </>
  );

  if (variant === "tags") {
    return <div className="w-full">{tagsBlock}</div>;
  }

  if (variant === "inline") {
    // inline 只出拓展标签，音标/释义由父级卡片展示，避免拓展开关后重复叠两层
    return <div className="w-full pt-2 mt-2 border-t border-[#F1F5F9]">{tagsBlock}</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={`${PRACTICE_WORD_CLASS} !font-bold break-all`}>{word}</h2>
            {detail?.audioUrl && (
              <CloudButton
                type="button"
                variant="ghost"
                size="iconRound"
                onClick={() => playWordAudio(detail.audioUrl!, 200)}
                aria-label="播放发音"
              >
                <Volume2 size={18} className="text-[#4ECDC4]" />
              </CloudButton>
            )}
          </div>
          {phonetic && (
            <p className="text-sm text-[#718096] mt-1 font-mono">
              [{phonetic.replace(/^\[|\]$/g, "")}]
            </p>
          )}
          {(detail?.partOfSpeech || detail?.translation) && (
            <p className={`${PRACTICE_TRANS_CLASS} mt-2`}>
              {showFullInline ? fullMeaning : shortMeaning}
            </p>
          )}
        </div>
      </div>
      <div className="px-3 pb-4">{tagsBlock}</div>
    </div>
  );
}

function ExtContent({
  active,
  detail,
  parsed,
}: {
  active: ExtKey;
  detail: WordDetail;
  parsed: ParsedDetail;
}) {
  switch (active) {
    case "examples":
      return (
        <div className="space-y-3">
          {(parsed.examples || []).slice(0, 8).map((ex, i) => (
            <div key={i} className="pl-3 border-l-2 border-[#4ECDC4]/35">
              <p className="text-sm leading-relaxed">{stripTags(ex.en)}</p>
              <p className="text-xs text-[#718096] mt-1">{ex.cn}</p>
            </div>
          ))}
        </div>
      );
    case "mnemonic":
      return <p className="text-sm leading-relaxed whitespace-pre-wrap">{detail.mnemonic}</p>;
    case "phrases":
      return (
        <div className="space-y-2">
          {(parsed.phrases || []).map((p, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium text-[#1e3a5f]">{p.phrase}</span>
              <span className="text-[#718096] ml-2">{(p.meanings || []).join("；")}</span>
            </div>
          ))}
        </div>
      );
    case "morphology":
      return (
        <div className="flex flex-wrap gap-2">
          {(parsed.morphology?.forms || []).map((f, i) => (
            <span
              key={i}
              className="px-2 py-1 rounded-md bg-[#4ECDC4]/10 text-[#0d9488] text-xs font-medium"
            >
              {f}
            </span>
          ))}
        </div>
      );
    case "image":
      return detail.imageUrl ? (
        <img
          src={detail.imageUrl}
          alt={detail.word}
          className="max-h-48 rounded-lg mx-auto object-contain"
        />
      ) : null;
    case "derivations":
      return (
        <div className="space-y-2">
          {(parsed.derivations || []).map((d, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium text-[#1e3a5f]">{d.word}</span>
              <span className="text-[#718096] ml-2">
                {(d.meanings || []).map((m) => `${m.pos} ${m.meaning}`).join("；")}
              </span>
            </div>
          ))}
        </div>
      );
    case "synonyms":
      return (
        <div className="flex flex-wrap gap-2">
          {(parsed.synonyms || []).map((s, i) => (
            <span key={i} className="px-2 py-1 rounded-md bg-muted text-xs">
              <span className="font-medium">{s.word}</span>
              {s.trans && <span className="text-[#718096] ml-1">{s.trans}</span>}
            </span>
          ))}
        </div>
      );
    case "antonyms":
      return (
        <div className="flex flex-wrap gap-2">
          {(parsed.antonyms || []).map((s, i) => (
            <span key={i} className="px-2 py-1 rounded-md bg-muted text-xs">
              <span className="font-medium">{s.word}</span>
              {s.trans && <span className="text-[#718096] ml-1">{s.trans}</span>}
            </span>
          ))}
        </div>
      );
    case "etymology":
      return (
        <p className="text-sm leading-relaxed text-[#718096] whitespace-pre-wrap">{detail.etymology}</p>
      );
    case "collins":
      return (
        <div className="space-y-3">
          {(parsed.collins || []).slice(0, 4).map((c, i) => (
            <div key={i} className="pl-3 border-l-2 border-[#f8b4c4]/50">
              <p className="text-sm leading-relaxed">{c.def}</p>
              <p className="text-xs text-[#c45c78] mt-0.5">
                {c.posp} {c.tran}
              </p>
            </div>
          ))}
        </div>
      );
    case "definition":
      return <p className="text-sm leading-relaxed text-[#718096]">{detail.definition}</p>;
    case "family":
      return (
        <div className="space-y-1.5">
          {(parsed.wordFamily || []).map((w, i) => (
            <div key={i} className="text-sm">
              <span className="text-xs text-[#A0AEC0] mr-1">{w.pos}</span>
              <span className="font-medium text-[#1e3a5f]">{w.word}</span>
              <span className="text-[#718096] ml-2">{w.meaning}</span>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}
