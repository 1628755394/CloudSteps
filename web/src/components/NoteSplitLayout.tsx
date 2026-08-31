import { StudyNotePanel } from "./StudyNotePanel";
import { useNote } from "./NoteContext";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

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
        className={`box-border mt-6 min-h-[calc(100dvh-11rem)] w-full ${
          split
            ? "pb-4 lg:flex lg:gap-2 lg:max-w-none lg:px-2"
            : "pb-20 max-w-2xl lg:max-w-5xl mx-auto px-4"
        }`}
        style={split ? { height: "calc(100dvh - 3.5rem - 7.5rem)" } : undefined}
      >
        <div
          className={`${split ? "lg:flex lg:flex-1 lg:min-w-0 lg:flex-col lg:overflow-hidden" : ""} ${
            split && side === "left" ? "lg:order-2" : ""
          }`}
        >
          {children}
        </div>
        {split && (
          <>
            <div
              className={`group hidden lg:flex lg:items-center lg:justify-center lg:cursor-ew-resize lg:touch-none lg:select-none ${
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
              className={`lg:flex lg:flex-col ${side === "right" ? "lg:order-3" : "lg:order-1"}`}
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
