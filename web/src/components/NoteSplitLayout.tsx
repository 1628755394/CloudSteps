import { StudyNotePanel } from "./StudyNotePanel";
import { useNote } from "./NoteContext";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  defaultStorageKey?: string;
  defaultTitle?: string;
};

export function NoteSplitLayout({ children, defaultStorageKey = "", defaultTitle = "随心记" }: Props) {
  const { open, setOpen, side, setSide, width, isDesktop, startResize, storageKey, noteTitle } = useNote();

  const key = storageKey || defaultStorageKey;
  const title = noteTitle || defaultTitle;
  const split = open && isDesktop;

  return (
    <>
      <div
        className={`box-border w-full ${
          split
            ? // 由外层 flex-1 提供高度；词表列按内容高度，笔记列铺满
              "min-h-0 flex-1 lg:flex lg:items-start lg:gap-2 lg:max-w-none lg:px-2 lg:py-2"
            : "mt-6 pb-20 min-h-[calc(100dvh-11rem)] max-w-2xl lg:max-w-5xl mx-auto px-4"
        }`}
      >
        <div
          className={`${
            split
              ? "lg:flex-1 lg:min-w-0 lg:max-h-full lg:overflow-y-auto lg:overscroll-contain lg:px-2"
              : ""
          } ${split && side === "left" ? "lg:order-2" : ""}`}
        >
          {children}
        </div>
        {split && (
          <>
            <div
              className={`group hidden lg:flex lg:self-stretch lg:items-center lg:justify-center lg:cursor-ew-resize lg:touch-none lg:select-none ${
                side === "right" ? "lg:order-2" : "lg:order-1"
              }`}
              style={{ width: "10px", flexShrink: 0 }}
              onPointerDown={startResize}
              title="拖动调整随心记宽度"
              aria-label="拖动调整随心记宽度"
            >
              <span className="h-16 w-1 rounded-full bg-[#A0AEC0]/30 transition-all group-hover:w-1.5 group-hover:bg-[#4ECDC4]/60" />
            </div>
            <div
              className={`lg:flex lg:flex-col lg:self-stretch lg:min-h-0 lg:h-full ${
                side === "right" ? "lg:order-3" : "lg:order-1"
              }`}
              style={{ width: `${width}px`, flexShrink: 0 }}
            >
              <StudyNotePanel
                open={open}
                onClose={() => setOpen(false)}
                storageKey={key}
                title={title}
                side={side}
                split
                onSideChange={setSide}
              />
            </div>
          </>
        )}
      </div>
      {open && !isDesktop && (
        <StudyNotePanel
          open={open}
          onClose={() => setOpen(false)}
          storageKey={key}
          title={title}
          side={side}
          onSideChange={setSide}
        />
      )}
    </>
  );
}
