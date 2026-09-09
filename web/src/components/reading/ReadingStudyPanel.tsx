import { Button, Spin } from "@arco-design/web-react";
import { ChevronDown, ChevronLeft, Copy, Layers, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../utils/cn";

export type ReadingStudyComponent = {
  label: string;
  text: string;
};

export type ReadingStudyPhrase = {
  text: string;
  explanation: string;
};

export type ReadingStudyItem = {
  id: string;
  sentence: string;
  translation: string;
  components: ReadingStudyComponent[];
  keyPhrases: ReadingStudyPhrase[];
};

type Props = {
  items: ReadingStudyItem[];
  loading?: boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  prevLabel: string;
  nextLabel: string;
  emptyLabel: string;
  translationLabel: string;
  componentsLabel: string;
  phrasesLabel: string;
  sentenceLabel: (n: number) => string;
  copyLabel: string;
};

export function ReadingStudyPanel({
  items,
  loading,
  onPrevStep,
  onNextStep,
  prevLabel,
  nextLabel,
  emptyLabel,
  translationLabel,
  componentsLabel,
  phrasesLabel,
  sentenceLabel,
  copyLabel,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    setOpenId(items[0]?.id ?? null);
  }, [items]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#94A3B8] py-4">{emptyLabel}</p>
      ) : (
        items.map((item, idx) => {
          const open = openId === item.id;
          return (
            <div
              key={item.id}
              className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden"
            >
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-[#F8FAFC] transition-colors"
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <span className="shrink-0 mt-0.5 text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary)]/10 rounded px-1.5 py-0.5">
                  {sentenceLabel(idx + 1)}
                </span>
                <span className="flex-1 min-w-0 text-sm text-[#2D3748] leading-6">
                  {item.sentence}
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "shrink-0 mt-1 text-[#94A3B8] transition-transform",
                    open && "rotate-180"
                  )}
                />
              </button>

              {open ? (
                <div className="px-3 pb-3 space-y-3 border-t border-[#F1F5F9]">
                  <div className="pt-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[#64748B] mb-1">
                        {translationLabel}
                      </p>
                      <p className="text-sm text-[#475569] leading-6">
                        {item.translation || "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={copyLabel}
                      className="shrink-0 text-[#94A3B8] hover:text-[var(--primary)]"
                      onClick={() =>
                        void copyText(
                          [item.sentence, item.translation].filter(Boolean).join("\n")
                        )
                      }
                    >
                      <Copy size={14} />
                    </button>
                  </div>

                  {item.components.length > 0 ? (
                    <div>
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] mb-1.5">
                        <Layers size={12} />
                        {componentsLabel}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.components.map((c, i) => (
                          <span
                            key={`${c.label}-${i}`}
                            className="inline-flex items-baseline gap-1 rounded-md bg-[#F1F5F9] px-2 py-1 text-[12px] text-[#334155]"
                          >
                            <span className="text-[10px] font-semibold text-[#64748B]">
                              {c.label}
                            </span>
                            <span>{c.text}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {item.keyPhrases.length > 0 ? (
                    <div className="space-y-2">
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B]">
                        <Quote size={12} />
                        {phrasesLabel}
                      </p>
                      {item.keyPhrases.map((p, i) => (
                        <div
                          key={`${p.text}-${i}`}
                          className="rounded-lg bg-[#FFFBEB]/80 border border-[#FDE68A]/60 px-2.5 py-2"
                        >
                          <p className="text-sm font-semibold text-[#2D3748]">{p.text}</p>
                          {p.explanation ? (
                            <p className="text-[13px] text-[#78716C] mt-1 leading-5">
                              {p.explanation}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button className="flex-1 !inline-flex !items-center !justify-center !gap-1" onClick={onPrevStep}>
          <ChevronLeft size={16} className="shrink-0" />
          <span>{prevLabel}</span>
        </Button>
        <Button className="flex-1 !inline-flex !items-center !justify-center" type="primary" onClick={onNextStep}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
