import { useEffect, useState } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, LayoutGrid, List, NotebookPen, Volume2, X } from "lucide-react";
import { CloudButton } from "./cloudsteps";
import { WordDetailPanel } from "./WordDetailPanel";
import { PRACTICE_TRANS_CLASS, PRACTICE_WORD_CLASS } from "./PracticeFontSettings";

export type MarkableWord = {
  id: number;
  word: string;
  phonetic?: string;
  translation?: string;
  audioUrl?: string;
  showTranslation?: boolean;
  /** 是否已点过发音（用于：第一次发音，第二次显示释义） */
  heard?: boolean;
  status: null | "correct" | "wrong";
};

export type WordViewMode = "list" | "card";

/** 勾选态优先；正确/点中均用青绿色，错误仍为红 */
export function markWordCardClass(
  status: MarkableWord["status"],
  tapped?: boolean
): string {
  if (status === "correct") return "bg-[#4ECDC4]/[0.06]";
  if (status === "wrong") return "bg-[#FF6B6B]/10";
  if (tapped) return "bg-[#4ECDC4]/[0.03]";
  return "bg-white";
}

/** 完整 inline 边框，避免被 theme 里 `* { border-color }` 盖掉 */
export function markWordCardStyle(
  status: MarkableWord["status"],
  tapped?: boolean
): {
  borderWidth: number;
  borderStyle: "solid";
  borderColor: string;
  backgroundColor: string;
} {
  if (status === "correct") {
    return {
      borderWidth: 2,
      borderStyle: "solid",
      borderColor: "#4ECDC4",
      backgroundColor: "rgba(78, 205, 196, 0.06)",
    };
  }
  if (status === "wrong") {
    return {
      borderWidth: 2,
      borderStyle: "solid",
      borderColor: "#FF6B6B",
      backgroundColor: "rgba(255, 107, 107, 0.1)",
    };
  }
  if (tapped) {
    return {
      borderWidth: 2,
      borderStyle: "solid",
      borderColor: "#4ECDC4",
      backgroundColor: "rgba(78, 205, 196, 0.03)",
    };
  }
  return {
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "#E2E8F0",
    backgroundColor: "#ffffff",
  };
}

/** 仅当前交互中的词高亮（heard / 释义 / 正在播放），不累积多张 */
export function isWordCardTapped(
  word: Pick<MarkableWord, "heard" | "showTranslation">,
  playingId?: number | null,
  wordId?: number
): boolean {
  return !!(word.heard || word.showTranslation || (playingId != null && playingId === wordId));
}

type StatsBarProps = {
  correctCount: number;
  wrongCount: number;
  total: number;
};

export function WordMarkStatsBar({ correctCount, wrongCount, total }: StatsBarProps) {
  const marked = correctCount + wrongCount;
  const rate = marked > 0 ? Math.round((correctCount / marked) * 100) : 0;
  const progress = total > 0 ? Math.min(100, Math.round((marked / total) * 100)) : 0;

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 mb-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>
          正确: <span className="text-[#4ECDC4] font-semibold">{correctCount}</span>
          {" / "}
          错误: <span className="text-[#FF6B6B] font-semibold">{wrongCount}</span>
        </span>
        <span>
          正确率: <span className="text-foreground font-semibold">{rate}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

type CardProps = {
  words: MarkableWord[];
  index: number;
  onIndexChange: (index: number) => void;
  playingId: number | null;
  onPlay: (word: MarkableWord) => void;
  onWordClick: (word: MarkableWord) => void;
  onStatus: (id: number, status: "correct" | "wrong") => void;
  onNote?: (word: MarkableWord) => void;
  /** 外部控制：展开该词的拓展面板（页内，非模态） */
  detailWordId?: number | null;
  onDetailClose?: () => void;
  simpleMode?: boolean;
  /**
   * 拓展增幅：跟点词节奏联动，仅在 showTranslation 时展示详情，
   * 不单独劫持第一次读音。
   */
  amplifyDetail?: boolean;
  /** 只看单词，不显示 ✓ / ✗ */
  hideStatus?: boolean;
};

export function WordCardPanel({
  words,
  index,
  onIndexChange,
  playingId,
  onPlay,
  onWordClick,
  onStatus,
  onNote,
  detailWordId,
  onDetailClose,
  simpleMode = true,
  amplifyDetail = false,
  hideStatus = false,
}: CardProps) {
  const safeIndex = words.length ? Math.min(Math.max(0, index), words.length - 1) : 0;
  const word = words[safeIndex];
  const [localDetail, setLocalDetail] = useState(false);

  const detailControlled = detailWordId !== undefined;
  const detailOpen = amplifyDetail
    ? !!word?.showTranslation
    : detailControlled
      ? detailWordId === word?.id
      : localDetail;

  // 切换单词时收起本地详情
  useEffect(() => {
    setLocalDetail(false);
  }, [safeIndex]);

  if (!word) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">暂无单词</div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="flex items-center gap-3 w-full max-w-2xl">
        <CloudButton
          type="button"
          variant="ghost"
          size="iconRound"
          disabled={safeIndex <= 0}
          onClick={() => onIndexChange(safeIndex - 1)}
          aria-label="上一个"
          className="shrink-0 bg-muted disabled:opacity-40"
        >
          <ChevronLeft size={22} />
        </CloudButton>

        <div
          className={`flex-1 min-h-[220px] rounded-2xl shadow-sm px-5 py-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${markWordCardClass(
            word.status,
            isWordCardTapped(word, playingId, word.id)
          )}`}
          style={markWordCardStyle(word.status, isWordCardTapped(word, playingId, word.id))}
          onClick={() => onWordClick(word)}
        >
          <p className="text-xs text-muted-foreground mb-4">
            {safeIndex + 1} / {words.length}
          </p>
          <h2 className={`${PRACTICE_WORD_CLASS} !font-bold text-[#1e3a5f] text-center break-all`}>
            {word.word}
          </h2>
          {word.showTranslation && (
            <>
              {word.phonetic ? (
                <p className="text-sm text-[#718096] font-mono mt-3 text-center">{word.phonetic}</p>
              ) : null}
              {word.translation ? (
                <p className={`${PRACTICE_TRANS_CLASS} mt-2 text-center animate-in fade-in`}>
                  {word.translation}
                </p>
              ) : null}
            </>
          )}
        </div>

        <CloudButton
          type="button"
          variant="ghost"
          size="iconRound"
          disabled={safeIndex >= words.length - 1}
          onClick={() => onIndexChange(safeIndex + 1)}
          aria-label="下一个"
          className="shrink-0 bg-[#f8b4c4]/60 text-[#c45c78] hover:bg-[#f8b4c4] disabled:opacity-40"
        >
          <ChevronRight size={22} />
        </CloudButton>
      </div>

      <div className="flex items-center gap-3">
        <CloudButton type="button" variant="ghost" size="iconRound" onClick={() => onPlay(word)}>
          <Volume2 size={20} className={playingId === word.id ? "text-[#4ECDC4] animate-pulse" : "text-[#4ECDC4]"} />
        </CloudButton>
        {onNote && <CloudButton type="button" variant="ghost" size="iconRound" onClick={() => onNote(word)} aria-label="单词笔记" title="单词笔记"><NotebookPen size={18} className="text-[#c45c78]" /></CloudButton>}
        <CloudButton
          type="button"
          variant="ghost"
          size="iconRound"
          onClick={() => {
            if (amplifyDetail) return;
            if (detailControlled) {
              if (detailOpen) onDetailClose?.();
              else onWordClick(word);
            } else {
              setLocalDetail((v) => !v);
            }
          }}
          aria-label="单词详情"
          className={`text-[#4ECDC4] hover:bg-[#4ECDC4]/10 ${amplifyDetail ? "opacity-60" : ""}`}
          title={amplifyDetail ? "拓展已开启：点单词显示释义时自动展开" : "单词详情"}
        >
          <BookOpen size={20} />
        </CloudButton>
        {!hideStatus && (
          <>
            <CloudButton
              type="button"
              variant={word.status === "correct" ? "mint" : "ghost"}
              size="iconRound"
              onClick={() => onStatus(word.id, "correct")}
            >
              <Check size={20} />
            </CloudButton>
            <CloudButton
              type="button"
              variant={word.status === "wrong" ? "destructive" : "ghost"}
              size="iconRound"
              onClick={() => onStatus(word.id, "wrong")}
            >
              <X size={20} />
            </CloudButton>
          </>
        )}
      </div>

      {detailOpen && (
        <div className="w-full max-w-2xl px-1">
          <WordDetailPanel
            wordId={word.id}
            wordText={word.word}
            variant="inline"
            simpleMode={simpleMode}
            onClose={() => {
              setLocalDetail(false);
              onDetailClose?.();
            }}
          />
        </div>
      )}
    </div>
  );
}

export function WordViewModeToggle({
  mode,
  onChange,
}: {
  mode: WordViewMode;
  onChange: (mode: WordViewMode) => void;
}) {
  const isCard = mode === "card";
  return (
    <CloudButton
      type="button"
      variant="outline"
      size="pill"
      onClick={() => onChange(isCard ? "list" : "card")}
      aria-label={isCard ? "切换列表" : "切换词卡"}
    >
      {isCard ? <List size={16} /> : <LayoutGrid size={16} />}
      {isCard ? "列表" : "词卡"}
    </CloudButton>
  );
}
