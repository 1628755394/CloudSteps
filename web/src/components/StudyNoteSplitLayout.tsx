import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StudyNotePanel } from "./StudyNotePanel";

type NoteSide = "left" | "right";

type Props = {
  children: ReactNode;
  open: boolean;
  isDesktop: boolean;
  side: NoteSide;
  width: number;
  storageKey: string;
  onClose: () => void;
  onSideChange: (side: NoteSide) => void;
  onResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function StudyNoteSplitLayout({
  children,
  open,
  isDesktop,
  side,
  width,
  storageKey,
  onClose,
  onSideChange,
  onResize,
}: Props) {
  const { t } = useTranslation();
  const split = open && isDesktop;

  return (
    <>
      <div
        className={`box-border min-h-[calc(100dvh-9.5rem)] w-full ${
          split
            ? "pb-4 lg:flex lg:gap-2 lg:max-w-none lg:px-2"
            : "pb-20 max-w-2xl lg:max-w-5xl mx-auto px-4"
        }`}
        style={split ? { height: "calc(100dvh - 3.5rem - 6rem)" } : undefined}
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
              onPointerDown={onResize}
              title={t("studyNote.resizeWidth")}
              aria-label={t("studyNote.resizeWidth")}
            >
              <span className="h-16 w-1 rounded-full bg-[#A0AEC0]/30 transition-all group-hover:w-1.5 group-hover:bg-[#4ECDC4]/60" />
            </div>
            <div
              className={`lg:flex lg:flex-col ${side === "right" ? "lg:order-3" : "lg:order-1"}`}
              style={{ width: `${width}px`, flexShrink: 0 }}
            >
              <StudyNotePanel
                open={open}
                onClose={onClose}
                storageKey={storageKey}
                title={t("studyNote.title")}
                side={side}
                split
                onSideChange={onSideChange}
              />
            </div>
          </>
        )}
      </div>
      {open && !isDesktop && (
        <StudyNotePanel
          open={open}
          onClose={onClose}
          storageKey={storageKey}
          title={t("studyNote.title")}
          side={side}
          onSideChange={onSideChange}
        />
      )}
    </>
  );
}
