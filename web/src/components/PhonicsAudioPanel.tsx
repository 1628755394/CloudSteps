import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
import { CloudButton } from "./cloudsteps";
import {
  isAudioMuted,
  parseAudioUrlSlots,
  playAudioAtIndex,
  playFirstWordAudio,
} from "../utils/audioPlayer";
import { getPhonicsParts } from "../utils/phonicsSplit";
import { splitSyllableParts } from "../utils/syllableSplit";

type Mode = "split" | "blend";

type Props = {
  word: string;
  syllables?: string | null;
  phonetic?: string | null;
  audioUrl?: string | null;
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 拓展区：拆分 / 拼读。
 * - 拆分：按音标块展示（\ b \ · \ əʊ \ …），顺序高亮后播整词
 * - 拼读：播放完整单词音频（优先「连读」槽位）
 */
export function PhonicsAudioPanel({ word, syllables, phonetic, audioUrl }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("split");
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const cancelSeq = useRef(false);

  const phoneticParts = useMemo(
    () => getPhonicsParts({ syllables, phonetic })?.parts || [],
    [syllables, phonetic]
  );
  const syllableParts = useMemo(
    () => splitSyllableParts({ syllables, word }) || [],
    [syllables, word]
  );
  const parts = mode === "split" ? phoneticParts : syllableParts;
  const hasAudio = Boolean(audioUrl && parseAudioUrlSlots(audioUrl).some(Boolean));

  const modeOptions = useMemo(
    () =>
      [
        { id: "split" as const, label: t("word.phonics.split") },
        { id: "blend" as const, label: t("word.phonics.blend") },
      ] as const,
    [t]
  );

  useEffect(() => {
    return () => {
      cancelSeq.current = true;
      abortRef.current?.();
    };
  }, []);

  useEffect(() => {
    cancelSeq.current = true;
    abortRef.current?.();
    abortRef.current = null;
    setActiveIdx(null);
    setPlaying(false);
    cancelSeq.current = false;
  }, [word, mode]);

  if (phoneticParts.length === 0 && syllableParts.length === 0 && !hasAudio) return null;

  const stopAll = () => {
    cancelSeq.current = true;
    abortRef.current?.();
    abortRef.current = null;
    setPlaying(false);
    setActiveIdx(null);
  };

  const playBlend = () => {
    if (isAudioMuted() || !audioUrl) return;
    stopAll();
    cancelSeq.current = false;
    setPlaying(true);
    const slots = parseAudioUrlSlots(audioUrl);
    const preferBlend = slots[1] ? 1 : 0;
    const done = () => {
      setPlaying(false);
      setActiveIdx(null);
    };
    abortRef.current =
      preferBlend === 1 ? playAudioAtIndex(audioUrl, 1, done) : playFirstWordAudio(audioUrl, done);
  };

  const playSplitSequence = async () => {
    if (isAudioMuted()) return;
    if (parts.length === 0) {
      playBlend();
      return;
    }
    stopAll();
    cancelSeq.current = false;
    setPlaying(true);
    for (let i = 0; i < parts.length; i++) {
      if (cancelSeq.current) break;
      setActiveIdx(i);
      await delay(340);
      if (cancelSeq.current) break;
      await delay(80);
    }
    if (!cancelSeq.current && audioUrl) {
      setActiveIdx(null);
      await new Promise<void>((resolve) => {
        abortRef.current = playFirstWordAudio(audioUrl, () => resolve());
      });
    }
    if (!cancelSeq.current) {
      setPlaying(false);
      setActiveIdx(null);
    }
  };

  const onPlayClick = () => {
    if (playing) {
      stopAll();
      return;
    }
    if (mode === "blend") playBlend();
    else void playSplitSequence();
  };

  const playAriaLabel = playing
    ? t("word.phonics.stop")
    : mode === "blend"
      ? t("word.phonics.play_blend")
      : t("word.phonics.play_split");

  return (
    <div className="mb-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="inline-flex rounded-full bg-[#EEF2F7] p-0.5">
          {modeOptions.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`h-7 min-w-[3.25rem] rounded-full px-3 text-xs font-medium transition-colors ${
                mode === m.id
                  ? "bg-[#4ECDC4] text-white shadow-sm"
                  : "text-[#64748B] hover:text-[#2D3748]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <CloudButton
          type="button"
          variant="ghost"
          size="iconRound"
          className="size-8"
          aria-label={playAriaLabel}
          onClick={onPlayClick}
          disabled={
            isAudioMuted() || (mode === "blend" ? !hasAudio : parts.length === 0 && !hasAudio)
          }
        >
          <Volume2
            size={16}
            className={playing ? "text-[#4ECDC4] animate-pulse" : "text-[#4ECDC4]"}
          />
        </CloudButton>
      </div>

      {mode === "blend" && <p className="mb-2 text-sm font-semibold text-[#475569]">自然拼读</p>}
      {parts.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {parts.map((p, i) => (
            <button
              key={`${p}-${i}`}
              type="button"
              disabled={mode === "blend"}
              onClick={() => {
                if (mode !== "split" || isAudioMuted()) return;
                setActiveIdx(i);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-sm font-mono transition-colors ${
                activeIdx === i
                  ? "bg-[#4ECDC4] text-white"
                  : mode === "split"
                    ? "bg-white text-[#0d9488] border border-[#4ECDC4]/25 hover:bg-[#4ECDC4]/10"
                    : "bg-white/70 text-[#94A3B8] border border-transparent"
              }`}
            >
              {mode === "split" ? `\\ ${p} \\` : p}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[#718096]">
          {mode === "blend" ? "暂无自然拼读数据" : t("word.phonics.no_split")}
        </p>
      )}
    </div>
  );
}
